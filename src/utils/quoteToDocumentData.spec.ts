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

// ── International ERP quotation standard ─────────────────────────────────────
// A quotation must carry the buyer's identity and the commercial terms being
// offered. Previously the buyer was a bare name and the standing T&C text was
// passed as `payment_terms`, so a delivery or warranty clause printed to the
// customer under a "Payment Terms" heading.
describe('Given a quote with a resolved customer record', () => {
  const customer = {
    id: 'cust-1',
    company_name: 'Acme Industries FZE',
    contact_email: 'procurement@acme.example',
    phone: '+971 4 555 0100',
    tax_id: 'TRN-100200300',
    custom_fields: { city: 'Dubai', country: 'United Arab Emirates', postal_code: '00000' },
  } as any;

  it('When mapped / Then the buyer block carries the customer tax registration', () => {
    const doc = quoteToDocumentData(baseQuote(), { currency: 'AED', seller: SELLER, customer });
    expect(doc.buyer.tax_number).toBe('TRN-100200300');
  });

  it('When mapped / Then the buyer block carries contact details, not just a name', () => {
    const doc = quoteToDocumentData(baseQuote(), { currency: 'AED', seller: SELLER, customer });
    expect(doc.buyer.email).toBe('procurement@acme.example');
    expect(doc.buyer.phone).toBe('+971 4 555 0100');
  });

  it('When the address lives in custom_fields / Then it is composed into one line', () => {
    const doc = quoteToDocumentData(baseQuote(), { currency: 'AED', seller: SELLER, customer });
    expect(doc.buyer.address).toBe('Dubai, United Arab Emirates 00000');
  });

  it('When the customer record supplies a company name / Then it wins over the denormalized copy', () => {
    const doc = quoteToDocumentData(
      baseQuote({ customer_name: 'Stale Name Ltd' }),
      { currency: 'AED', seller: SELLER, customer },
    );
    expect(doc.buyer.name).toBe('Acme Industries FZE');
  });
});

describe('Given no customer record could be resolved', () => {
  it('When mapped / Then it still prints, falling back to the name on the quote', () => {
    const doc = quoteToDocumentData(
      baseQuote({ customer_name: 'Fallback Ltd' }),
      { currency: 'AED', seller: SELLER, customer: null },
    );
    expect(doc.buyer.name).toBe('Fallback Ltd');
    expect(doc.buyer.address).toBeUndefined();
    expect(doc.buyer.tax_number).toBeUndefined();
  });
});

describe('Given a quote carrying commercial terms', () => {
  const quote = baseQuote({
    payment_terms: 'Net 30',
    delivery_terms: 'Ex-stock, 2-3 weeks from PO',
    incoterm: 'CIF',
    customer_reference: 'RFQ-2026-0042',
    terms_and_conditions: 'Prices exclude installation.',
    notes: 'Volume pricing available above 500 units.',
  });

  it('When mapped / Then payment terms carry the payment obligation alone', () => {
    const doc = quoteToDocumentData(quote, { currency: 'AED', seller: SELLER });
    expect(doc.payment_terms).toBe('Net 30');
  });

  it('When mapped / Then delivery terms are their own field, not folded into payment terms', () => {
    const doc = quoteToDocumentData(quote, { currency: 'AED', seller: SELLER });
    expect(doc.delivery_terms).toBe('Ex-stock, 2-3 weeks from PO');
    expect(doc.payment_terms).not.toContain('Ex-stock');
  });

  it('When mapped / Then the Incoterm is passed through for explicit display', () => {
    const doc = quoteToDocumentData(quote, { currency: 'AED', seller: SELLER });
    expect(doc.incoterm).toBe('CIF');
  });

  it("When mapped / Then the buyer's own reference prints as the PO reference", () => {
    const doc = quoteToDocumentData(quote, { currency: 'AED', seller: SELLER });
    expect(doc.po_reference).toBe('RFQ-2026-0042');
  });

  it('When mapped / Then T&C and notes both survive into the notes block', () => {
    const doc = quoteToDocumentData(quote, { currency: 'AED', seller: SELLER });
    expect(doc.notes).toContain('Prices exclude installation.');
    expect(doc.notes).toContain('Volume pricing available above 500 units.');
  });

  it('When no terms are set at all / Then notes is undefined rather than an empty block', () => {
    const doc = quoteToDocumentData(baseQuote(), { currency: 'AED', seller: SELLER });
    expect(doc.notes).toBeUndefined();
  });

  it('When the T&C text used to be sent as payment_terms / Then that regression cannot recur', () => {
    const doc = quoteToDocumentData(
      baseQuote({ terms_and_conditions: 'Governing law: DIFC.' }),
      { currency: 'AED', seller: SELLER },
    );
    expect(doc.payment_terms).toBeUndefined();
    expect(doc.notes).toContain('Governing law: DIFC.');
  });
});

describe('Given line items with tax classification and unit of measure', () => {
  it('When mapped / Then HSN/SAC and unit reach the renderer for per-line verification', () => {
    const doc = quoteToDocumentData(
      baseQuote({
        lines: [{
          description: 'Steel bracket', quantity: 10, unit_price: 25,
          unit: 'pcs', hsn_code: '7308', tax_rate: 5,
        } as any],
      }),
      { currency: 'AED', seller: SELLER },
    );
    expect(doc.line_items[0].hsn_code).toBe('7308');
    expect(doc.line_items[0].unit).toBe('pcs');
  });
});
