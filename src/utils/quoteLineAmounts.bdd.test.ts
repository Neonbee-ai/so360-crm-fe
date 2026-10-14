import { describe, it, expect } from 'vitest';
import { quoteLinePreTaxAmount, quoteLineTax, quoteTotals } from './quoteLineAmounts';

describe('quoteLinePreTaxAmount', () => {
    it('Given a line with discount and tax / When the amount is computed / Then it is Qty × Unit Price after discount, before tax', () => {
        expect(quoteLinePreTaxAmount({ quantity: 1, unit_price: 15999, discount_percent: 10, tax_rate: 18 })).toBeCloseTo(14399.1);
    });

    it('Given no discount / When the amount is computed / Then it is Qty × Unit Price', () => {
        expect(quoteLinePreTaxAmount({ quantity: 2, unit_price: 50, tax_rate: 5 })).toBe(100);
    });

    it('Given a 100% discount / When the amount is computed / Then the line amount is 0', () => {
        expect(quoteLinePreTaxAmount({ quantity: 2, unit_price: 50, discount_percent: 100 })).toBe(0);
    });

    it('Given decimal quantity and price / When the amount is computed / Then it multiplies them', () => {
        expect(quoteLinePreTaxAmount({ quantity: 3, unit_price: 33.33 })).toBeCloseTo(99.99);
    });

    it('Given DECIMAL values returned as strings / When the amount is computed / Then they are coerced', () => {
        expect(quoteLinePreTaxAmount({ quantity: '2' as any, unit_price: '12.5' as any, discount_percent: '20' as any })).toBe(20);
    });

    it('Given a missing or non-numeric quantity or price / When the amount is computed / Then it is 0', () => {
        expect(quoteLinePreTaxAmount({ quantity: undefined as any, unit_price: 10 })).toBe(0);
        expect(quoteLinePreTaxAmount({ quantity: 1, unit_price: 'abc' as any })).toBe(0);
    });
});

describe('quoteLineTax', () => {
    it('Given a discounted line / When tax is computed / Then it is charged on the after-discount amount', () => {
        expect(quoteLineTax({ quantity: 1, unit_price: 15999, discount_percent: 10, tax_rate: 18 })).toBeCloseTo(2591.838);
    });

    it('Given no tax rate / When tax is computed / Then it is 0', () => {
        expect(quoteLineTax({ quantity: 1, unit_price: 100 })).toBe(0);
    });
});

describe('quoteTotals', () => {
    it('Given mixed lines / When totals are computed / Then Subtotal is the sum of line amounts and Total = Subtotal + Tax', () => {
        const totals = quoteTotals([
            { quantity: 2, unit_price: 100, discount_percent: 10, tax_rate: 5 },
            { quantity: 1, unit_price: 50 },
        ]);
        expect(totals.subtotal).toBe(230);
        expect(totals.taxTotal).toBeCloseTo(9);
        expect(totals.grandTotal).toBeCloseTo(239);
    });

    it('Given the reported quote / When totals are computed / Then the final Total equals the previous Subtotal − Discount + Tax', () => {
        const totals = quoteTotals([{ quantity: 1, unit_price: 15999, discount_percent: 10, tax_rate: 18 }]);
        expect(totals.grandTotal).toBeCloseTo(15999 - 1599.9 + 2591.838);
    });

    it('Given no lines / When totals are computed / Then everything is 0', () => {
        expect(quoteTotals([])).toEqual({ subtotal: 0, taxTotal: 0, grandTotal: 0 });
    });
});
