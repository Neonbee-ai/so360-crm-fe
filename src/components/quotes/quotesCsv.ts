/**
 * quotesCsv.ts — client-side CSV export for the Quotes listing.
 */
import type { Quote, Deal } from '../../types/crm';
import { escapeCsvField, downloadCsv } from '../leads/leadsCsv';

interface QuoteCsvColumn {
  header: string;
  value: (quote: Quote, dealsMap: Map<string, Deal>) => string;
}

const QUOTE_COLUMNS: QuoteCsvColumn[] = [
  { header: 'Quote #', value: (q) => q.quote_number || `Q-${q.id.slice(0, 8)}` },
  { header: 'Title', value: (q) => q.title || '' },
  {
    header: 'Customer',
    value: (q, map) => {
      const deal = q.deal_id ? map.get(q.deal_id) : undefined;
      const anyDeal = deal as any;
      return (
        q.customer_name ||
        deal?.company_name ||
        deal?.company ||
        anyDeal?.contact_name ||
        anyDeal?.lead?.company_name ||
        ''
      );
    },
  },
  {
    header: 'Deal',
    value: (q, map) => {
      const deal = q.deal_id ? map.get(q.deal_id) : undefined;
      return deal?.name || q.deal?.name || '';
    },
  },
  { header: 'Total Amount', value: (q) => String(q.total_amount ?? q.grand_total ?? 0) },
  { header: 'Status', value: (q) => q.status || '' },
  { header: 'Valid Until', value: (q) => (q.valid_until ? q.valid_until.split('T')[0] : '') },
  { header: 'Created At', value: (q) => (q.created_at ? q.created_at.split('T')[0] : '') },
];

export function quotesToCsv(quotes: Quote[], deals: Deal[] = []): string {
  const dealsMap = new Map<string, Deal>(deals.map((d) => [d.id, d]));
  const header = QUOTE_COLUMNS.map((c) => escapeCsvField(c.header)).join(',');
  const body = quotes.map((quote) =>
    QUOTE_COLUMNS.map((c) => escapeCsvField(c.value(quote, dealsMap))).join(','),
  );
  return [header, ...body].join('\r\n');
}

export { downloadCsv };
