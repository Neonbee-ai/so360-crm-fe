import type { QuoteLine } from '../types/crm';

type AmountLine = Pick<QuoteLine, 'quantity' | 'unit_price' | 'discount_percent' | 'tax_rate'>;

const toNumber = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

const grossAmount = (line: AmountLine): number => toNumber(line.quantity) * toNumber(line.unit_price);

/** The line's discount, in money (Qty × Unit Price × Disc %). */
export function quoteLineDiscount(line: AmountLine): number {
    return grossAmount(line) * (toNumber(line.discount_percent) / 100);
}

/**
 * Task a171957e: a quote line's "Amount" — Qty × Unit Price less the line
 * discount (the existing discount flow, unchanged), and WITHOUT tax. Tax is
 * shown only in the Tax row of the totals block, so the after-tax figure
 * appears once, in the last Total.
 *
 * Deliberately ignores the persisted `line_total`: crm-be stores it after
 * discount and tax, and it still feeds sales orders and invoices unchanged.
 */
export function quoteLinePreTaxAmount(line: AmountLine): number {
    return grossAmount(line) - quoteLineDiscount(line);
}

/** Tax on a line, charged on its after-discount amount (unchanged rule). */
export function quoteLineTax(line: AmountLine): number {
    return quoteLinePreTaxAmount(line) * (toNumber(line.tax_rate) / 100);
}

/**
 * Totals block, unchanged from before this task: Subtotal (Σ Qty × Unit
 * Price), Discount, Tax and Total = Subtotal − Discount + Tax.
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
        subtotal += grossAmount(line);
        discountTotal += quoteLineDiscount(line);
        taxTotal += quoteLineTax(line);
    }
    return { subtotal, discountTotal, taxTotal, grandTotal: subtotal - discountTotal + taxTotal };
}
