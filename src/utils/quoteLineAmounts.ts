import type { QuoteLine } from '../types/crm';

type AmountLine = Pick<QuoteLine, 'quantity' | 'unit_price' | 'discount_percent' | 'tax_rate'>;

const toNumber = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Task a171957e: a quote line's "Amount" — Qty × Unit Price only. The line
 * discount and tax are shown once each, in the totals block (Discount, Tax),
 * so neither is duplicated on the line and the final payable figure appears
 * only in the last Total.
 *
 * Deliberately ignores the persisted `line_total`: crm-be stores it after
 * discount and tax, and it still feeds sales orders and invoices unchanged.
 */
export function quoteLinePreTaxAmount(line: AmountLine): number {
    return toNumber(line.quantity) * toNumber(line.unit_price);
}

/** The line's discount, in money (Amount × Disc %). */
export function quoteLineDiscount(line: AmountLine): number {
    return quoteLinePreTaxAmount(line) * (toNumber(line.discount_percent) / 100);
}

/** Tax on a line, charged on its after-discount amount (unchanged rule). */
export function quoteLineTax(line: AmountLine): number {
    return (quoteLinePreTaxAmount(line) - quoteLineDiscount(line)) * (toNumber(line.tax_rate) / 100);
}

/**
 * Totals block for a quote: Subtotal (sum of line Amounts), Discount, Tax and
 * Total = Subtotal − Discount + Tax — the same rules as before this task.
 */
export function quoteTotals(lines: AmountLine[]): {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
} {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    for (const line of lines) {
        subtotal += quoteLinePreTaxAmount(line);
        discountTotal += quoteLineDiscount(line);
        taxTotal += quoteLineTax(line);
    }
    return { subtotal, discountTotal, taxTotal, grandTotal: subtotal - discountTotal + taxTotal };
}
