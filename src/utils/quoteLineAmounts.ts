import type { QuoteLine } from '../types/crm';

const toNumber = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Task a171957e: the amount a quote line shows in its own "Total" column, the
 * printed document and the PDF — Qty × Unit Price, before the line discount and
 * tax. Discount and tax are only summed into the totals block, so the final
 * payable figure appears once, in the last Total row.
 *
 * Deliberately ignores the persisted `line_total`: crm-be stores it after
 * discount and tax, and it still feeds sales orders and invoices unchanged.
 */
export function quoteLinePreTaxAmount(line: Pick<QuoteLine, 'quantity' | 'unit_price'>): number {
    return toNumber(line.quantity) * toNumber(line.unit_price);
}
