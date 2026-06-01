import type { DocumentData, DocumentLineItem, DocumentParty } from '@so360/shell-context';
import type { Quote, QuoteLine } from '../types/crm';

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
        qty: line.quantity,
        unit_price: line.unit_price,
        discount_pct: line.discount_percent,
        tax_rate: line.tax_rate,
        amount: lineAmount(line),
    };
}

/**
 * Maps a CRM Quote into the shared DocumentData contract so it can be printed
 * through the org's configured Core template via shell.printDocument().
 *
 * Document title is intentionally left unset so the org's template label drives
 * it (e.g. "QUOTATION" vs "ESTIMATE"). The Shell supplies letterhead + branding.
 */
export function quoteToDocumentData(
    quote: Quote,
    opts: { currency: string; seller: DocumentParty },
): DocumentData {
    const lines = quote.lines || [];
    return {
        document_number: quote.quote_number || `Quote #${quote.id.slice(0, 8)}`,
        date: quote.created_at,
        due_date: quote.valid_until,
        currency: opts.currency,
        seller: opts.seller,
        buyer: {
            name: quote.customer_name || quote.deal?.company_name || quote.deal?.name || '',
        },
        line_items: lines.map(lineToDocumentItem),
        subtotal: quote.subtotal,
        discount_amount: quote.discount_total,
        tax_amount: quote.tax_total,
        total: quote.grand_total,
        payment_terms: quote.terms_and_conditions,
        notes: quote.notes,
    };
}
