import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printQuote } from './printQuote';
import type { Quote, QuoteLine } from '../types/crm';

const fmt = {
    formatCurrency: (v: number) => `$${v.toFixed(2)}`,
    formatDate: (d: string) => d,
};

const makeLine = (overrides: Partial<QuoteLine> = {}): QuoteLine => ({
    description: 'Widget A',
    quantity: 2,
    unit_price: 50,
    discount_percent: 0,
    tax_rate: 0,
    ...overrides,
});

const makeQuote = (overrides: Partial<Quote> = {}): Quote => ({
    id: 'q-abc-12345678',
    quote_number: 'Q-2025-001',
    deal_id: 'd-1',
    status: 'approved',
    lines: [makeLine()],
    subtotal: 100,
    tax_total: 0,
    discount_total: 0,
    grand_total: 100,
    created_at: '2025-06-01T00:00:00Z',
    created_by: { id: 'u-1', full_name: 'Alice', email: 'alice@test.com' },
    ...overrides,
});

let mockDocWrite: ReturnType<typeof vi.fn>;
let mockDocClose: ReturnType<typeof vi.fn>;
let mockPrint: ReturnType<typeof vi.fn>;
let mockFocus: ReturnType<typeof vi.fn>;
let mockWinClose: ReturnType<typeof vi.fn>;
let mockAddEventListener: ReturnType<typeof vi.fn>;
let capturedHtml: string;

beforeEach(() => {
    capturedHtml = '';
    mockDocWrite = vi.fn((html: string) => { capturedHtml += html; });
    mockDocClose = vi.fn();
    mockPrint = vi.fn();
    mockFocus = vi.fn();
    mockWinClose = vi.fn();
    mockAddEventListener = vi.fn();

    vi.spyOn(window, 'open').mockReturnValue({
        document: { write: mockDocWrite, close: mockDocClose },
        print: mockPrint,
        focus: mockFocus,
        close: mockWinClose,
        addEventListener: mockAddEventListener,
    } as unknown as Window);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('printQuote', () => {
    describe('Given a valid quote', () => {
        it('When called / Then opens a new browser window', () => {
            printQuote(makeQuote(), fmt);
            expect(window.open).toHaveBeenCalledWith('', '_blank', 'width=900,height=700');
        });

        it('When called / Then writes HTML to the window document', () => {
            printQuote(makeQuote(), fmt);
            expect(mockDocWrite).toHaveBeenCalled();
            expect(capturedHtml).toContain('<!DOCTYPE html>');
        });

        it('When called / Then triggers the browser print dialog', () => {
            printQuote(makeQuote(), fmt);
            expect(mockPrint).toHaveBeenCalled();
        });

        it('When called / Then registers afterprint listener to auto-close', () => {
            printQuote(makeQuote(), fmt);
            expect(mockAddEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function));
        });
    });

    describe('Given a quote with a quote_number', () => {
        it('When printed / Then HTML contains the quote number', () => {
            printQuote(makeQuote({ quote_number: 'Q-2025-001' }), fmt);
            expect(capturedHtml).toContain('Q-2025-001');
        });
    });

    describe('Given a quote without a quote_number', () => {
        it('When printed / Then HTML falls back to a short ID prefix', () => {
            printQuote(makeQuote({ quote_number: '' as any, id: 'abcdef123456' }), fmt);
            expect(capturedHtml).toContain('abcdef12');
        });
    });

    describe('Given a quote with line items', () => {
        it('When printed / Then HTML contains each line description', () => {
            const lines = [makeLine({ description: 'Product Alpha' }), makeLine({ description: 'Product Beta' })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('Product Alpha');
            expect(capturedHtml).toContain('Product Beta');
        });

        it('When printed / Then HTML contains line quantities', () => {
            const lines = [makeLine({ quantity: 5 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('>5<');
        });

        it('When printed / Then HTML contains formatted unit prices', () => {
            const lines = [makeLine({ unit_price: 75 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('$75.00');
        });

        it('When printed / Then HTML contains formatted line totals', () => {
            const lines = [makeLine({ quantity: 3, unit_price: 40, discount_percent: 0, tax_rate: 0 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('$120.00');
        });

        it('When a line has a discount / Then HTML shows the discount percentage', () => {
            const lines = [makeLine({ discount_percent: 10 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('10%');
        });

        it('When a line has a tax rate / Then HTML shows the tax percentage', () => {
            const lines = [makeLine({ tax_rate: 5 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('5%');
        });

        it('When a line has a SKU / Then HTML contains the SKU', () => {
            const lines = [makeLine({ sku: 'SKU-001' })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('SKU-001');
        });
    });

    describe('Given a quote with no line items', () => {
        it('When printed / Then HTML shows the empty-state message', () => {
            printQuote(makeQuote({ lines: [] }), fmt);
            expect(capturedHtml).toContain('No line items');
        });
    });

    describe('Given a quote with totals', () => {
        it('When printed / Then HTML contains the subtotal', () => {
            const lines = [makeLine({ quantity: 2, unit_price: 50 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('Subtotal');
            expect(capturedHtml).toContain('$100.00');
        });

        it('When discount > 0 / Then HTML contains the discount row', () => {
            const lines = [makeLine({ quantity: 1, unit_price: 100, discount_percent: 20 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('Discount');
            expect(capturedHtml).toContain('$20.00');
        });

        it('When tax > 0 / Then HTML contains the tax row', () => {
            const lines = [makeLine({ quantity: 1, unit_price: 100, tax_rate: 10 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('Tax');
            expect(capturedHtml).toContain('$10.00');
        });

        it('When printed / Then HTML contains Grand Total', () => {
            const lines = [makeLine({ quantity: 2, unit_price: 50 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).toContain('Grand Total');
        });

        it('When discount = 0 / Then HTML does NOT render a discount row', () => {
            const lines = [makeLine({ discount_percent: 0 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).not.toContain('>Discount<');
        });

        it('When tax = 0 / Then HTML does NOT render a tax row', () => {
            const lines = [makeLine({ tax_rate: 0 })];
            printQuote(makeQuote({ lines }), fmt);
            expect(capturedHtml).not.toContain('>Tax<');
        });
    });

    describe('Given a quote with notes and terms', () => {
        it('When printed / Then HTML contains the notes', () => {
            printQuote(makeQuote({ notes: 'Delivery in 3 days' }), fmt);
            expect(capturedHtml).toContain('Delivery in 3 days');
        });

        it('When printed / Then HTML contains the terms', () => {
            printQuote(makeQuote({ terms_and_conditions: 'Net 30 payment' }), fmt);
            expect(capturedHtml).toContain('Net 30 payment');
        });
    });

    describe('Given a quote with no notes and no terms', () => {
        it('When printed / Then HTML does NOT render the notes/terms box', () => {
            printQuote(makeQuote({ notes: undefined, terms_and_conditions: undefined }), fmt);
            expect(capturedHtml).not.toContain('<div class="notes-box">');
        });
    });

    describe('Given a rejected quote with a rejection reason', () => {
        it('When printed / Then HTML contains the rejection reason', () => {
            printQuote(makeQuote({ status: 'rejected', rejection_reason: 'Price too high' }), fmt);
            expect(capturedHtml).toContain('Price too high');
            expect(capturedHtml).toContain('Rejection Reason');
        });
    });

    describe('Given a quote without a rejection reason', () => {
        it('When printed / Then HTML does NOT render the rejection block', () => {
            printQuote(makeQuote({ rejection_reason: undefined }), fmt);
            expect(capturedHtml).not.toContain('rejection-reason');
            expect(capturedHtml).not.toContain('Rejection Reason');
        });
    });

    describe('Given an orgProfile is provided', () => {
        it('When printed / Then HTML contains the org name', () => {
            printQuote(makeQuote(), fmt, { name: 'Acme Corp' });
            expect(capturedHtml).toContain('Acme Corp');
        });

        it('When printed / Then HTML contains the org address', () => {
            printQuote(makeQuote(), fmt, { address: '123 Main St, Dubai' });
            expect(capturedHtml).toContain('123 Main St, Dubai');
        });

        it('When printed / Then HTML contains the tax ID', () => {
            printQuote(makeQuote(), fmt, { tax_id: 'TRN-123456' });
            expect(capturedHtml).toContain('TRN-123456');
        });

        it('When a logo_url is provided / Then HTML renders an img tag', () => {
            printQuote(makeQuote(), fmt, { logo_url: 'https://example.com/logo.png' });
            expect(capturedHtml).toContain('https://example.com/logo.png');
            expect(capturedHtml).toContain('<img');
        });
    });

    describe('Given no orgProfile is provided', () => {
        it('When printed / Then HTML renders without crashing', () => {
            expect(() => printQuote(makeQuote(), fmt, undefined)).not.toThrow();
        });

        it('When printed / Then HTML does NOT contain a logo tag', () => {
            printQuote(makeQuote(), fmt);
            expect(capturedHtml).not.toContain('<img');
        });
    });

    describe('Given a quote with a valid_until date', () => {
        it('When printed / Then HTML contains the valid until date', () => {
            printQuote(makeQuote({ valid_until: '2025-07-15T00:00:00Z' }), fmt);
            expect(capturedHtml).toContain('Valid Until');
            expect(capturedHtml).toContain('2025-07-15');
        });
    });

    describe('Given a quote linked to a deal', () => {
        it('When printed / Then HTML contains the deal company name', () => {
            const deal = { id: 'd-1', name: 'Project Phoenix', company_name: 'TechCorp Ltd' } as any;
            printQuote(makeQuote({ deal }), fmt);
            expect(capturedHtml).toContain('TechCorp Ltd');
        });

        it('When printed / Then HTML contains the deal name', () => {
            const deal = { id: 'd-1', name: 'Project Phoenix', company_name: 'TechCorp Ltd' } as any;
            printQuote(makeQuote({ deal }), fmt);
            expect(capturedHtml).toContain('Project Phoenix');
        });
    });

    describe('Given window.open returns null (popup blocked)', () => {
        it('When called / Then returns without throwing', () => {
            vi.spyOn(window, 'open').mockReturnValue(null);
            expect(() => printQuote(makeQuote(), fmt)).not.toThrow();
        });
    });
});
