import { describe, it, expect } from 'vitest';
import { quoteLinePreTaxAmount, quoteLineDiscount, quoteLineTax, quoteTotals } from './quoteLineAmounts';

describe('quoteLinePreTaxAmount', () => {
    it('Given a line with discount and tax / When the amount is computed / Then the discount is applied but the tax is not', () => {
        expect(quoteLinePreTaxAmount({ quantity: 1, unit_price: 15999, discount_percent: 10, tax_rate: 18 })).toBeCloseTo(14399.1);
    });

    it('Given tax but no discount / When the amount is computed / Then it is Qty × Unit Price, with no tax added', () => {
        expect(quoteLinePreTaxAmount({ quantity: 2, unit_price: 50, tax_rate: 18 })).toBe(100);
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

describe('quoteLineDiscount', () => {
    it('Given a discounted line / When the discount is computed / Then it is Qty × Unit Price × Disc %', () => {
        expect(quoteLineDiscount({ quantity: 1, unit_price: 15999, discount_percent: 10 })).toBeCloseTo(1599.9);
    });

    it('Given no discount / When the discount is computed / Then it is 0', () => {
        expect(quoteLineDiscount({ quantity: 2, unit_price: 50 })).toBe(0);
    });
});

describe('quoteLineTax', () => {
    it('Given a discounted line / When tax is computed / Then it is charged on the after-discount amount', () => {
        expect(quoteLineTax({ quantity: 1, unit_price: 15999, discount_percent: 10, tax_rate: 18 })).toBeCloseTo(2591.838);
    });

    it('Given no tax rate / When tax is computed / Then it is 0', () => {
        expect(quoteLineTax({ quantity: 1, unit_price: 100, discount_percent: 10 })).toBe(0);
    });
});

describe('quoteTotals', () => {
    it('Given the reported quote / When totals are computed / Then Subtotal, Discount, Tax and Total are unchanged from before', () => {
        const totals = quoteTotals([{ quantity: 1, unit_price: 15999, discount_percent: 10, tax_rate: 18 }]);
        expect(totals.subtotal).toBe(15999);
        expect(totals.discountTotal).toBeCloseTo(1599.9);
        expect(totals.taxTotal).toBeCloseTo(2591.838);
        expect(totals.grandTotal).toBeCloseTo(16990.938);
    });

    it('Given mixed lines / When totals are computed / Then Total = Subtotal − Discount + Tax', () => {
        const totals = quoteTotals([
            { quantity: 2, unit_price: 100, discount_percent: 10, tax_rate: 5 },
            { quantity: 1, unit_price: 50 },
        ]);
        expect(totals.subtotal).toBe(250);
        expect(totals.discountTotal).toBe(20);
        expect(totals.taxTotal).toBeCloseTo(9);
        expect(totals.grandTotal).toBeCloseTo(239);
    });

    it('Given no lines / When totals are computed / Then everything is 0', () => {
        expect(quoteTotals([])).toEqual({ subtotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 });
    });
});
