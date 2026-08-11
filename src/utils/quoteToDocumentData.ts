import type { DocumentData, DocumentLineItem, DocumentParty } from '@so360/shell-context';
import type { Quote, QuoteLine, Lead } from '../types/crm';

function lineLabel(line: QuoteLine): string {
    const base = line.description || line.item_name || '—';
    const sku = line.sku
        ? `${line.sku}${line.sub_sku && line.sub_sku !== 'NIL' ? ` / ${line.sub_sku}` : ''}`
        : '';
    return sku ? `${base} (${sku})` : base;
}

function lineAmount(line: QuoteLine): number {
    if (typeof line.line_total === 'number') return line.line_total;
    const sub = line.quantity * line.unit_price;
    const disc = sub * ((line.discount_percent || 0) / 100);
    const net = sub - disc;
    return net + net * ((line.tax_rate || 0) / 100);
}

function lineToDocumentItem(line: QuoteLine): DocumentLineItem {
    return {
        description: lineLabel(line),
        hsn_code: line.hsn_code,
        qty: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        discount_pct: line.discount_percent,
        tax_rate: line.tax_rate,
        amount: lineAmount(line),
    };
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
    opts: { currency: string; seller: DocumentParty; customer?: Partial<Lead> | null },
): DocumentData {
    const lines = quote.lines || [];
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
        subtotal: quote.subtotal,
        discount_amount: quote.discount_total,
        tax_amount: quote.tax_total,
        total: quote.grand_total,
        payment_terms: quote.payment_terms,
        delivery_terms: quote.delivery_terms,
        incoterm: quote.incoterm,
        notes: [quote.terms_and_conditions, quote.notes]
            .map((t) => (typeof t === 'string' ? t.trim() : ''))
            .filter(Boolean)
            .join('\n\n') || undefined,
    };
}
