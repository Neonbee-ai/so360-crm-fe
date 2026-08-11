import type { DocumentData, DocumentLineItem, DocumentParty } from '@so360/shell-context';
import type { Quote, QuoteLine, Lead } from '../types/crm';

function lineLabel(line: QuoteLine): string {
    const base = line.description || line.item_name || '—';
    const sku = line.sku
        ? `${line.sku}${line.sub_sku && line.sub_sku !== 'NIL' ? ` / ${line.sub_sku}` : ''}`
        : '';
    return sku ? `${base} (${sku})` : base;
}

/**
 * Coerce a loosely-typed API value to a finite number. Postgres DECIMAL columns
 * come back as strings through some paths, and optional columns come back
 * `null`/absent — both must never reach the print layer as `undefined`.
 */
function num(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function numOr0(value: unknown): number {
    return num(value) ?? 0;
}

function lineAmount(line: QuoteLine): number {
    const persisted = num(line.line_total);
    if (persisted !== undefined) return persisted;
    const sub = numOr0(line.quantity) * numOr0(line.unit_price);
    const disc = sub * (numOr0(line.discount_percent) / 100);
    const net = sub - disc;
    return net + net * (numOr0(line.tax_rate) / 100);
}


/**
 * Split an item's free-text description into a headline and specification bullets.
 *
 * The approved quotation layout shows the item name on its own line with the
 * material/finish/dimension/warranty details bulleted beneath it. Our schema keeps
 * all of that in one `description` field, so the first line becomes the headline
 * and each subsequent line becomes a bullet. Leading list markers the user typed
 * ("-", "*", "•") are stripped so they aren't doubled by the rendered bullet.
 */
export function splitItemSpecs(line: QuoteLine): { name: string; specs: string[] } {
    const raw = (line.description || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const stripMarker = (l: string) => l.replace(/^[-*\u2022]\s*/, '').trim();

    // An explicit item name always wins; every description line is then a spec.
    if (line.item_name && line.item_name.trim()) {
        return { name: line.item_name.trim(), specs: raw.map(stripMarker).filter(Boolean) };
    }
    if (raw.length === 0) return { name: '\u2014', specs: [] };
    return { name: stripMarker(raw[0]), specs: raw.slice(1).map(stripMarker).filter(Boolean) };
}

/**
 * Parse the standing terms blob into the headed, numbered sections the approved
 * layout renders.
 *
 * A line that carries no sentence punctuation and is followed by list content is
 * treated as a heading ("Warranty", "Production & Delivery Timeline"); everything
 * else becomes a numbered clause. Text with no discernible headings degrades to a
 * single "Terms and Conditions" section, so nothing is ever dropped.
 */
export function parseTermsSections(
    text: string | null | undefined,
    defaultHeading = 'Terms and Conditions',
): Array<{ heading: string; items: string[] }> | undefined {
    const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return undefined;

    const isHeading = (l: string) =>
        l.length <= 60 && !/[.:;]$/.test(l) && !/^\s*(\d+[.)]|[-*\u2022])/.test(l);

    const sections: Array<{ heading: string; items: string[] }> = [];
    let current = { heading: defaultHeading, items: [] as string[] };

    for (const line of lines) {
        const next = lines[lines.indexOf(line) + 1];
        if (isHeading(line) && next !== undefined) {
            if (current.items.length) sections.push(current);
            current = { heading: line, items: [] };
        } else {
            current.items.push(line.replace(/^\s*(\d+[.)]|[-*\u2022])\s*/, ''));
        }
    }
    if (current.items.length) sections.push(current);
    return sections.length ? sections : undefined;
}

/** Read a state name from whichever field the record happens to carry it in. */
function stateOf(party: Partial<Lead> | null | undefined): string {
    if (!party) return '';
    const cf = (party.custom_fields ?? {}) as Record<string, unknown>;
    const v = (party as Record<string, unknown>)['state'] ?? cf['state'];
    return typeof v === 'string' ? v.trim() : '';
}

function countryOf(party: Partial<Lead> | null | undefined): string {
    if (!party) return '';
    const cf = (party.custom_fields ?? {}) as Record<string, unknown>;
    const v = (party as Record<string, unknown>)['country'] ?? cf['country'];
    return typeof v === 'string' ? v.trim() : '';
}

function lineToDocumentItem(line: QuoteLine): DocumentLineItem {
    const { name, specs } = splitItemSpecs(line);
    const sku = line.sku
        ? `${line.sku}${line.sub_sku && line.sub_sku !== 'NIL' ? ` / ${line.sub_sku}` : ''}`
        : '';
    return {
        description: sku ? `${name} (${sku})` : name,
        specs: specs.length ? specs : undefined,
        image_url: line.item_image_url || undefined,
        hsn_code: line.hsn_code,
        qty: num(line.quantity) ?? 0,
        unit: line.unit,
        unit_price: num(line.unit_price) ?? 0,
        discount_pct: num(line.discount_percent),
        tax_rate: num(line.tax_rate),
        amount: lineAmount(line),
    };
}

/**
 * Resolve the document totals.
 *
 * The totals are derived from the quote's own lines using the same arithmetic
 * the Quote detail page renders, so the printed document and the on-screen
 * quote can never disagree. The persisted columns are only used when the quote
 * carries no lines to derive from — and both the real column names
 * (`total_amount`, `total_tax`, `total_discount`) and the older `*_total`
 * aliases are read, since reading only the aliases is what left `total`
 * `undefined` and broke printing.
 *
 * No commercial calculation changes here: this mirrors the existing per-line
 * formula exactly, it only guarantees a finite number reaches the renderer.
 */
function resolveTotals(quote: Quote, lines: QuoteLine[]) {
    if (lines.length > 0) {
        let subtotal = 0;
        let discount = 0;
        let tax = 0;
        for (const line of lines) {
            const lineSubtotal = numOr0(line.quantity) * numOr0(line.unit_price);
            const lineDiscount = lineSubtotal * (numOr0(line.discount_percent) / 100);
            subtotal += lineSubtotal;
            discount += lineDiscount;
            tax += (lineSubtotal - lineDiscount) * (numOr0(line.tax_rate) / 100);
        }
        return { subtotal, discount, tax, total: subtotal - discount + tax };
    }

    const subtotal = numOr0(quote.subtotal);
    const discount = numOr0(quote.total_discount ?? quote.discount_total);
    const tax = numOr0(quote.total_tax ?? quote.tax_total);
    const total = num(quote.total_amount ?? quote.grand_total);
    return { subtotal, discount, tax, total: total ?? subtotal - discount + tax };
}

/**
 * Compose a postal address from the loosely-typed location fields a CRM record
 * carries. Leads keep city/state/country under `custom_fields` rather than as
 * first-class columns, so both shapes are read.
 */
function composeAddress(customer: Partial<Lead> | null | undefined): string | undefined {
    if (!customer) return undefined;
    const cf = (customer.custom_fields ?? {}) as Record<string, unknown>;
    const pick = (key: string): string => {
        const direct = (customer as Record<string, unknown>)[key];
        const value = typeof direct === 'string' && direct.trim() ? direct : cf[key];
        return typeof value === 'string' ? value.trim() : '';
    };
    const parts = [
        pick('address_line1') || pick('street') || pick('address'),
        pick('city'),
        pick('state'),
        [pick('country'), pick('postal_code') || pick('zip')].filter(Boolean).join(' '),
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
}

/**
 * Build the "Quotation To" party block.
 *
 * This used to emit `{ name }` alone, so a quotation printed the customer as a
 * bare line with no address, tax registration or contact — while the seller side
 * carried all three. On an international quotation the buyer's tax registration
 * in particular is not decoration: it is what determines the tax treatment of the
 * offer, and its absence makes the document unusable for the buyer's own records.
 */
export function buildBuyerParty(
    quote: Quote,
    customer?: Partial<Lead> | null,
): DocumentParty {
    const name =
        customer?.company_name ||
        quote.customer_name ||
        quote.deal?.company_name ||
        quote.deal?.name ||
        '';

    return {
        name,
        address: composeAddress(customer),
        tax_number: customer?.tax_id || undefined,
        email: customer?.contact_email || undefined,
        phone: customer?.phone || undefined,
    };
}

/**
 * Maps a CRM Quote into the shared DocumentData contract so it can be printed
 * through the org's configured Core template via shell.printDocument().
 *
 * Commercial terms are passed as the distinct obligations they are — payment,
 * delivery and the governing Incoterm each print under their own heading.
 * Previously the standing T&C text was passed as `payment_terms`, so a delivery
 * or warranty clause appeared to the customer under a "Payment Terms" label.
 *
 * Document title is intentionally left unset so the org's template label drives
 * it (e.g. "QUOTATION" vs "ESTIMATE"). The Shell supplies letterhead + branding.
 */
export function quoteToDocumentData(
    quote: Quote,
    opts: {
        currency: string;
        seller: DocumentParty;
        customer?: Partial<Lead> | null;
        /** Seller's state, compared with the place of supply for the GST split. */
        sellerState?: string;
        sellerCountry?: string;
    },
): DocumentData {
    const lines = quote.lines || [];
    const totals = resolveTotals(quote, lines);
    return {
        document_number: quote.quote_number || `Quote #${quote.id.slice(0, 8)}`,
        date: quote.created_at,
        due_date: quote.valid_until,
        // The buyer's own RFQ/PO number, so they can reconcile the offer against
        // their procurement record.
        po_reference: quote.customer_reference,
        currency: opts.currency,
        seller: opts.seller,
        buyer: buildBuyerParty(quote, opts.customer),
        line_items: lines.map(lineToDocumentItem),
        subtotal: totals.subtotal,
        discount_amount: totals.discount,
        tax_amount: totals.tax,
        total: totals.total,
        payment_terms: quote.payment_terms,
        delivery_terms: quote.delivery_terms,
        incoterm: quote.incoterm,
        // Place of supply decides the CGST/SGST vs IGST split on an Indian
        // document, so it is derived from the two parties' states rather than
        // assumed.
        country_of_supply: countryOf(opts.customer) || opts.sellerCountry || undefined,
        place_of_supply: stateOf(opts.customer) || undefined,
        is_interstate: isInterstateSupply(opts.sellerState, stateOf(opts.customer)),
        terms_sections: parseTermsSections(quote.terms_and_conditions),
        notes: [quote.terms_and_conditions, quote.notes]
            .map((t) => (typeof t === 'string' ? t.trim() : ''))
            .filter(Boolean)
            .join('\n\n') || undefined,
    };
}

/**
 * True when the supply crosses a state border, which replaces CGST+SGST with a
 * single IGST charge. Unknown states are treated as intra-state, matching the
 * conservative default used elsewhere in the platform.
 */
export function isInterstateSupply(sellerState?: string, buyerState?: string): boolean {
    const a = (sellerState || '').trim().toLowerCase();
    const b = (buyerState || '').trim().toLowerCase();
    if (!a || !b) return false;
    return a !== b;
}
