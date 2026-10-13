import { describe, it, expect } from 'vitest';
import { quoteLinePreTaxAmount } from './quoteLineAmounts';

describe('quoteLinePreTaxAmount', () => {
    it('Given a line with discount and tax / When the amount is computed / Then it is Qty × Unit Price only', () => {
        expect(quoteLinePreTaxAmount({ quantity: 1, unit_price: 15999, discount_percent: 10, tax_rate: 18 } as any)).toBe(15999);
    });

    it('Given a 100% discount / When the amount is computed / Then the pre-tax amount is unaffected', () => {
        expect(quoteLinePreTaxAmount({ quantity: 2, unit_price: 50, discount_percent: 100 } as any)).toBe(100);
    });

    it('Given decimal quantity and price / When the amount is computed / Then it multiplies them', () => {
        expect(quoteLinePreTaxAmount({ quantity: 3, unit_price: 33.33 })).toBeCloseTo(99.99);
    });

    it('Given DECIMAL values returned as strings / When the amount is computed / Then they are coerced', () => {
        expect(quoteLinePreTaxAmount({ quantity: '2' as any, unit_price: '12.5' as any })).toBe(25);
    });

    it('Given a missing or non-numeric quantity or price / When the amount is computed / Then it is 0', () => {
        expect(quoteLinePreTaxAmount({ quantity: undefined as any, unit_price: 10 })).toBe(0);
        expect(quoteLinePreTaxAmount({ quantity: 1, unit_price: 'abc' as any })).toBe(0);
    });
});
