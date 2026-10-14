import type { QuoteLine } from '../types/crm';

type AmountLine = Pick<QuoteLine, 'quantity' | 'unit_price' | 'discount_percent' | 'tax_rate'>;

const toNumber = (value: unknown): number => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Task a171957e: a quote line's "Amount" — Qty × Unit Price after the line
 * discount, before tax (the convention Zoho, QuickBooks and Odoo use, and what
 * Accounting stores as an invoice line's net amount). Tax is only added in the
 * totals block, so the final payable figure appears once, in the last Total.
 *
 * Deliberately ignores the persisted `line_total`: crm-be stores it after
 * discount and tax, and it still feeds sales orders and invoices unchanged.
 */
export function quoteLinePreTaxAmount(line: AmountLine): number {
    const gross = toNumber(line.quantity) * toNumber(line.unit_price);
    return gross * (1 - toNumber(line.discount_percent) / 100);
}

/** Tax on a line, charged on its after-discount amount (unchanged rule). */
export function quoteLineTax(line: AmountLine): number {
    return quoteLinePreTaxAmount(line) * (toNumber(line.tax_rate) / 100);
}

/**
 * Totals block for a quote. Subtotal is the sum of the line Amounts (already
 * net of line discounts, so there is no separate Discount row), and Total is
 * Subtotal + Tax — the same figure as the previous Subtotal − Discount + Tax.
 */
export function quoteTotals(lines: AmountLine[]): { subtotal: number; taxTotal: number; grandTotal: number } {
    let subtotal = 0;
    let taxTotal = 0;
    for (const line of lines) {
        subtotal += quoteLinePreTaxAmount(line);
        taxTotal += quoteLineTax(line);
    }
    return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
}
