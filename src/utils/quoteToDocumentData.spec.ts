/**
 * quoteToDocumentData — BDD specs.
 *
 * Maps a CRM Quote into the shared DocumentData contract for printing through
 * the org's Core template. Invariants:
 *   - Totals are derived from the lines (matching the Quote detail page), and
 *     fall back to the persisted columns when the quote carries no lines
 *   - Totals are always finite numbers — never undefined, which used to crash
 *     the print renderer on `.toFixed()`
 *   - Per-line amount prefers line_total, else is computed (qty·price − disc + tax)
 *   - SKU is folded into the line description when present (NIL sub_sku dropped)
 *   - Buyer falls back customer_name → deal.company_name → deal.name → ''
 *   - document_title is left unset so the template label drives it
 */

import { describe, it, expect } from 'vitest';
import {
  quoteToDocumentData,
  splitItemSpecs,
  parseTermsSections,
  isInterstateSupply,
} from './quoteToDocumentData';
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

    it('Given the API returns the real column names, Then totals still resolve', () => {
        // The `quotes` table stores total_amount/total_tax/total_discount. Reading
        // only the grand_total/*_total aliases left `total` undefined and the
        // print renderer crashed on `.toFixed()`.
        const d = quoteToDocumentData(
            baseQuote({
                grand_total: undefined,
                tax_total: undefined,
                discount_total: undefined,
                total_amount: 95,
                total_tax: 5,
                total_discount: 10,
            }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.total).toBe(95);
        expect(d.tax_amount).toBe(5);
        expect(d.discount_amount).toBe(10);
    });

    it('Given no persisted totals at all, Then every total is 0 rather than undefined', () => {
        const d = quoteToDocumentData(
            baseQuote({ subtotal: undefined, grand_total: undefined, tax_total: undefined, discount_total: undefined }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.subtotal).toBe(0);
        expect(d.discount_amount).toBe(0);
        expect(d.tax_amount).toBe(0);
        expect(d.total).toBe(0);
        expect(typeof d.total).toBe('number');
    });

    it('Given lines, Then totals are derived from them so print matches the detail page', () => {
        const d = quoteToDocumentData(
            baseQuote({
                lines: [
                    { description: 'A', quantity: 2, unit_price: 100, discount_percent: 10, tax_rate: 5 },
                    { description: 'B', quantity: 1, unit_price: 50 },
                ] as any,
                // Stale persisted values must not win over the lines on screen.
                subtotal: 999, total_amount: 999, total_tax: 999, total_discount: 999,
            }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.subtotal).toBe(250);      // 200 + 50
        expect(d.discount_amount).toBe(20); // 10% of 200
        expect(d.tax_amount).toBe(9);       // 5% of 180
        expect(d.total).toBe(239);          // 250 − 20 + 9
    });

    it('Given a single line with no discount and no tax, Then the total is qty × price', () => {
        const d = quoteToDocumentData(
            baseQuote({ lines: [{ description: 'A', quantity: 3, unit_price: 25 }] as any }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.subtotal).toBe(75);
        expect(d.discount_amount).toBe(0);
        expect(d.tax_amount).toBe(0);
        expect(d.total).toBe(75);
    });

    it('Given a zero-value discount, Then it contributes nothing and does not break totals', () => {
        const d = quoteToDocumentData(
            baseQuote({ lines: [{ description: 'A', quantity: 1, unit_price: 100, discount_percent: 0, tax_rate: 0 }] as any }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.discount_amount).toBe(0);
        expect(d.total).toBe(100);
    });

    it('Given DECIMAL columns returned as strings, Then they are coerced to numbers', () => {
        const d = quoteToDocumentData(
            baseQuote({ subtotal: '100' as any, total_amount: '95' as any, total_tax: '5' as any, total_discount: '10' as any, grand_total: undefined, tax_total: undefined, discount_total: undefined }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.total).toBe(95);
        expect(d.subtotal).toBe(100);
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

    it('Given a line missing quantity and unit_price, Then qty/price/amount are 0, not undefined', () => {
        const d = quoteToDocumentData(
            baseQuote({ lines: [{ description: 'Widget' } as any] }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items[0].qty).toBe(0);
        expect(d.line_items[0].unit_price).toBe(0);
        expect(d.line_items[0].amount).toBe(0);
    });

    it('Given numeric line values returned as strings, Then they are coerced', () => {
        const d = quoteToDocumentData(
            baseQuote({ lines: [{ description: 'Widget', quantity: '2', unit_price: '50' } as any] }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items[0].qty).toBe(2);
        expect(d.line_items[0].amount).toBe(100);
    });

    it('Given multiple lines, Then each carries its own finite amount', () => {
        const d = quoteToDocumentData(
            baseQuote({
                lines: [
                    { description: 'A', quantity: 2, unit_price: 50 },
                    { description: 'B', quantity: 1, unit_price: 30, tax_rate: 10 },
                    { description: 'C' },
                ] as any,
            }),
            { currency: 'AED', seller: SELLER },
        );
        expect(d.line_items.map(l => l.amount)).toEqual([100, 33, 0]);
        expect(d.line_items.every(l => Number.isFinite(l.amount))).toBe(true);
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

// ── Approved quotation template mapping ──────────────────────────────────────
describe('Given an item whose description carries specification lines', () => {
  it('When mapped / Then the first line is the name and the rest become bullets', () => {
    const doc = quoteToDocumentData(
      baseQuote({
        lines: [{
          description: 'Jerico Queen Bed\nWood - Pre-Seasoned European Ash Wood\nWarranty 3 years',
          quantity: 1, unit_price: 185900,
        } as any],
      }),
      { currency: 'INR', seller: SELLER },
    );
    expect(doc.line_items[0].description).toBe('Jerico Queen Bed');
    expect(doc.line_items[0].specs).toEqual([
      'Wood - Pre-Seasoned European Ash Wood',
      'Warranty 3 years',
    ]);
  });

  it('When the user typed their own bullet markers / Then they are not doubled', () => {
    const { specs } = splitItemSpecs({
      description: 'Sofa\n- Wood: Ash\n• Warranty 3 years\n* Finish: Matte',
      quantity: 1, unit_price: 1,
    } as any);
    expect(specs).toEqual(['Wood: Ash', 'Warranty 3 years', 'Finish: Matte']);
  });

  it('When an explicit item_name exists / Then every description line is a spec', () => {
    const { name, specs } = splitItemSpecs({
      item_name: 'Halo Coffee Table',
      description: 'Wood: Ash\nWarranty 3 years',
      quantity: 1, unit_price: 1,
    } as any);
    expect(name).toBe('Halo Coffee Table');
    expect(specs).toEqual(['Wood: Ash', 'Warranty 3 years']);
  });

  it('When there are no spec lines / Then specs is omitted rather than an empty list', () => {
    const doc = quoteToDocumentData(
      baseQuote({ lines: [{ description: 'Plain item', quantity: 1, unit_price: 10 } as any] }),
      { currency: 'INR', seller: SELLER },
    );
    expect(doc.line_items[0].specs).toBeUndefined();
  });

  it('When the item has a picture / Then it is passed as the row thumbnail', () => {
    const doc = quoteToDocumentData(
      baseQuote({
        lines: [{ description: 'Bed', quantity: 1, unit_price: 10, item_image_url: 'https://cdn/bed.jpg' } as any],
      }),
      { currency: 'INR', seller: SELLER },
    );
    expect(doc.line_items[0].image_url).toBe('https://cdn/bed.jpg');
  });
});

describe('Given the place of supply', () => {
  const kerala = { custom_fields: { state: 'Kerala', country: 'India' } } as any;

  it('When buyer and seller are in the same state / Then the supply is intra-state', () => {
    expect(isInterstateSupply('Kerala', 'Kerala')).toBe(false);
    expect(isInterstateSupply('kerala', ' KERALA ')).toBe(false);
  });

  it('When the states differ / Then the supply is inter-state, so IGST applies', () => {
    expect(isInterstateSupply('Karnataka', 'Kerala')).toBe(true);
  });

  it('When either state is unknown / Then it defaults to intra-state', () => {
    expect(isInterstateSupply(undefined, 'Kerala')).toBe(false);
    expect(isInterstateSupply('Kerala', '')).toBe(false);
  });

  it('When mapped / Then place and country of supply reach the document', () => {
    const doc = quoteToDocumentData(baseQuote(), {
      currency: 'INR', seller: SELLER, customer: kerala, sellerState: 'Karnataka',
    });
    expect(doc.place_of_supply).toBe('Kerala');
    expect(doc.country_of_supply).toBe('India');
    expect(doc.is_interstate).toBe(true);
  });
});

describe('Given standing terms text', () => {
  it('When it has headings and clauses / Then it becomes headed sections', () => {
    const sections = parseTermsSections(
      'Terms and Conditions\n1. Quote valid 15 days.\n2. GST extra.\nWarranty\n1. Three year warranty.',
    );
    expect(sections?.map((s) => s.heading)).toEqual(['Terms and Conditions', 'Warranty']);
    expect(sections?.[0].items).toEqual(['Quote valid 15 days.', 'GST extra.']);
    expect(sections?.[1].items).toEqual(['Three year warranty.']);
  });

  it('When there are no headings / Then everything lands under one default section', () => {
    const sections = parseTermsSections('Prices exclude installation.');
    expect(sections).toHaveLength(1);
    expect(sections?.[0].heading).toBe('Terms and Conditions');
    expect(sections?.[0].items).toEqual(['Prices exclude installation.']);
  });

  it('When the text is empty / Then no sections are produced', () => {
    expect(parseTermsSections('')).toBeUndefined();
    expect(parseTermsSections(null)).toBeUndefined();
  });

  it('When mapped / Then the quote terms reach the document as sections', () => {
    const doc = quoteToDocumentData(
      baseQuote({ terms_and_conditions: 'Warranty\n1. Three year warranty.' }),
      { currency: 'INR', seller: SELLER },
    );
    expect(doc.terms_sections?.[0].heading).toBe('Warranty');
  });
});
