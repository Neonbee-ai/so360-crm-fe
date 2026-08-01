/**
 * quoteToDocumentData — BDD specs.
 *
 * Maps a CRM Quote into the shared DocumentData contract for printing through
 * the org's Core template. Invariants:
 *   - Totals come straight from the Quote (subtotal/discount/tax/grand_total)
 *   - Per-line amount prefers line_total, else is computed (qty·price − disc + tax)
 *   - SKU is folded into the line description when present (NIL sub_sku dropped)
 *   - Buyer falls back customer_name → deal.company_name → deal.name → ''
 *   - document_title is left unset so the template label drives it
 */

import { describe, it, expect } from 'vitest';
import { quoteToDocumentData } from './quoteToDocumentData';
import type { Quote } from '../types/crm';

const SELLER = { name: 'Naiz Trading LLC', tax_number: 'TRN-1' };

function baseQuote(overrides: Partial<Quote> = {}): Quote {
    return {
        id: 'abcdef1234',
        quote_number: 'Q-2026-001',
        deal_id: 'd1',
        status: 'draft' as any,
        lines: [],
        subtotal: 100,
        tax_total: 5,
        discount_total: 10,
        grand_total: 95,
        created_at: '2026-06-01',
        created_by: {} as any,
        ...overrides,
    };
}

describe('quoteToDocumentData > header & totals', () => {
    it('Given a quote, Then it carries number, date and currency', () => {
        const d = quoteToDocumentData(baseQuote(), { currency: 'AED', seller: SELLER });
        expect(d.document_number).toBe('Q-2026-001');
        expect(d.date).toBe('2026-06-01');
        expect(d.currency).toBe('AED');
    });

    it('Given a quote, Then totals map straight through from the quote', () => {
        const d = quoteToDocumentData(baseQuote(), { currency: 'AED', seller: SELLER });
        expect(d.subtotal).toBe(100);
        expect(d.discount_amount).toBe(10);
        expect(d.tax_amount).toBe(5);
        expect(d.total).toBe(95);
    });

    it('Given no quote_number, Then it falls back to a short id label', () => {
        const d = quoteToDocumentData(baseQuote({ quote_number: '' }), { currency: 'AED', seller: SELLER });
        expect(d.document_number).toBe('Quote #abcdef12');
    });

    it('Then document_title is left unset so the template label wins', () => {
        const d = quoteToDocumentData(baseQuote(), { currency: 'AED', seller: SELLER });
        expect(d.document_title).toBeUndefined();
    });
});

describe('quoteToDocumentData > buyer resolution', () => {
    it('Given a customer_name, Then it is used as the buyer', () => {
        const d = quoteToDocumentData(baseQuote({ customer_name: 'ACME' }), { currency: 'AED', seller: SELLER });
        expect(d.buyer.name).toBe('ACME');
    });

    it('Given no customer_name but a deal, Then it falls back to the deal company/name', () => {
        const d = quoteToDocumentData(
            baseQuote({ deal: { company_name: 'Globex' } as any }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.buyer.name).toBe('Globex');
    });

    it('Given nothing identifying the buyer, Then the name is empty', () => {
        const d = quoteToDocumentData(baseQuote(), { currency: 'AED', seller: SELLER });
        expect(d.buyer.name).toBe('');
    });
});

describe('quoteToDocumentData > line items', () => {
    it('Given a line with line_total, Then that amount is used verbatim', () => {
        const d = quoteToDocumentData(
            baseQuote({ lines: [{ description: 'Widget', quantity: 2, unit_price: 50, line_total: 99 } as any] }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items[0].amount).toBe(99);
    });

    it('Given no line_total, Then amount is computed from qty/price/discount/tax', () => {
        const d = quoteToDocumentData(
            baseQuote({ lines: [{ description: 'Widget', quantity: 2, unit_price: 50, discount_percent: 10, tax_rate: 5 } as any] }),
            { currency: 'AED', seller: SELLER },
        );
        // 100 - 10% = 90, + 5% tax = 94.5
        expect(d.line_items[0].amount).toBeCloseTo(94.5);
    });

    it('Given a sku and sub_sku, Then they are folded into the description', () => {
        const d = quoteToDocumentData(
            baseQuote({ lines: [{ description: 'Widget', quantity: 1, unit_price: 1, sku: 'SKU1', sub_sku: 'V2' } as any] }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items[0].description).toBe('Widget (SKU1 / V2)');
    });

    it('Given a NIL sub_sku, Then it is dropped from the description', () => {
        const d = quoteToDocumentData(
            baseQuote({ lines: [{ description: 'Widget', quantity: 1, unit_price: 1, sku: 'SKU1', sub_sku: 'NIL' } as any] }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items[0].description).toBe('Widget (SKU1)');
    });
});
