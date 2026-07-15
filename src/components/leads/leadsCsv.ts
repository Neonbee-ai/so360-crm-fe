/**
 * leadsCsv.ts — client-side CSV export for the leads grid (Phase 6, bulk actions).
 *
 * `leadsToCsv` is pure and unit-tested; `downloadCsv` performs the (untestable)
 * DOM download. Export is a client-only convenience over the already-loaded rows,
 * so it needs no backend endpoint.
 */
import type { Lead } from '../../types/crm';

interface CsvColumn {
  header: string;
  value: (lead: Lead) => string;
}

const COLUMNS: CsvColumn[] = [
  { header: 'Company', value: (l) => l.company_name ?? '' },
  {
    header: 'Contact',
    value: (l) =>
      l.contact_name ?? [l.first_name, l.last_name].filter(Boolean).join(' '),
  },
  { header: 'Email', value: (l) => l.contact_email ?? '' },
  { header: 'Phone', value: (l) => l.phone ?? '' },
  { header: 'Status', value: (l) => String(l.status ?? '') },
  { header: 'Source', value: (l) => l.source ?? '' },
  { header: 'Owner', value: (l) => l.owner?.full_name ?? '' },
  { header: 'Created', value: (l) => l.created_at ?? '' },
];

/**
 * Escape a single CSV field per RFC 4180: wrap in quotes when it contains a
 * comma, quote, or newline, doubling any embedded quotes. Guarding leading
 * =/+/-/@ with a quote defuses spreadsheet formula injection.
 */
export function escapeCsvField(raw: string): string {
  const s = raw ?? '';
  const needsQuote = /[",\r\n]/.test(s);
  const risky = /^[=+\-@]/.test(s);
  let out = s;
  if (risky) out = `'${out}`;
  if (needsQuote || risky) out = `"${out.replace(/"/g, '""')}"`;
  return out;
}

/** Render leads to a CSV string (header row + one row per lead). */
export function leadsToCsv(leads: Lead[]): string {
  const header = COLUMNS.map((c) => escapeCsvField(c.header)).join(',');
  const body = leads.map((lead) =>
    COLUMNS.map((c) => escapeCsvField(c.value(lead))).join(','),
  );
  return [header, ...body].join('\r\n');
}

/** Trigger a browser download of the given CSV text. No-op outside a DOM. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
