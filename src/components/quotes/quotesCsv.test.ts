import { describe, it, expect } from 'vitest';
import { quotesToCsv } from './quotesCsv';
import type { Quote, Deal } from '../../types/crm';

describe('quotesToCsv', () => {
  it('renders header and rows correctly with deal lookup', () => {
    const deals: Deal[] = [
      { id: 'd1', name: 'Deal One', company_name: 'Acme Corp' } as Deal,
    ];
    const quotes: Quote[] = [
      {
        id: 'q1',
        quote_number: 'QT-2026-00001',
        title: 'Office Equipment',
        deal_id: 'd1',
        grand_total: 1250,
        status: 'draft',
        valid_until: '2026-10-01T00:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
      } as Quote,
    ];

    const csv = quotesToCsv(quotes, deals);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Quote #,Title,Customer,Deal,Total Amount,Status,Valid Until,Created At');
    expect(lines[1]).toContain('QT-2026-00001');
    expect(lines[1]).toContain('Office Equipment');
    expect(lines[1]).toContain('Acme Corp');
    expect(lines[1]).toContain('Deal One');
    expect(lines[1]).toContain('1250');
  });

  it('handles empty quotes array', () => {
    const csv = quotesToCsv([]);
    expect(csv).toBe('Quote #,Title,Customer,Deal,Total Amount,Status,Valid Until,Created At');
  });
});
