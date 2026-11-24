/**
 * Pure helpers for the Quotes export dialog (Pulse 222d6d31).
 *
 * The Quotes page already holds every quote the caller is allowed to see (the
 * API applies access control when the list is loaded) and builds the CSV from
 * those rows, so filtering here can only narrow what the user could already
 * see - it never widens access.
 */
import type { Quote } from '../../types/crm';

export interface QuoteExportCriteria {
  dateFrom: string;
  dateTo: string;
  status: string;
  customer: string;
  quoteNumber: string;
  createdBy: string;
}

export const EMPTY_EXPORT_CRITERIA: QuoteExportCriteria = {
  dateFrom: '', dateTo: '', status: '', customer: '', quoteNumber: '', createdBy: '',
};

/** `null` when the criteria are usable, otherwise a message to show the user. */
export function validateExportCriteria(c: QuoteExportCriteria): string | null {
  if (c.dateFrom && c.dateTo && c.dateFrom > c.dateTo) {
    return 'From date cannot be later than To date.';
  }
  return null;
}

export function hasAnyCriteria(c: QuoteExportCriteria): boolean {
  return Boolean(c.dateFrom || c.dateTo || c.status || c.customer.trim() || c.quoteNumber.trim() || c.createdBy);
}

/** Calendar day (YYYY-MM-DD) of an ISO timestamp, so date boundaries are inclusive. */
const dayOf = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

/** All criteria combine with AND; blank criteria are ignored. */
export function filterQuotesForExport(
  quotes: Quote[],
  c: QuoteExportCriteria,
  customerName: (q: Quote) => string,
): Quote[] {
  const customer = c.customer.trim().toLowerCase();
  const number = c.quoteNumber.trim().toLowerCase();
  return quotes.filter((q) => {
    const day = dayOf(q.created_at);
    if (c.dateFrom && (!day || day < c.dateFrom)) return false;
    if (c.dateTo && (!day || day > c.dateTo)) return false;
    if (c.status && (q.effective_status ?? q.status) !== c.status) return false;
    if (customer && !customerName(q).toLowerCase().includes(customer)) return false;
    if (number && !(q.quote_number ?? '').toLowerCase().includes(number)) return false;
    if (c.createdBy && (q.created_by?.id ?? '') !== c.createdBy) return false;
    return true;
  });
}
