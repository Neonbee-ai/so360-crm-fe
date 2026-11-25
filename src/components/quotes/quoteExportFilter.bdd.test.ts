import { describe, it, expect } from 'vitest';
import type { Quote } from '../../types/crm';
import {
  EMPTY_EXPORT_CRITERIA, filterQuotesForExport, validateExportCriteria, hasAnyCriteria,
} from './quoteExportFilter';

const q = (over: Partial<Quote>): Quote => ({
  id: 'q', quote_number: 'Q-1', deal_id: 'd', status: 'draft', lines: [], created_at: '2026-06-10T10:00:00Z',
  created_by: { id: 'u1', full_name: 'Ann', email: 'a@x.com' }, ...over,
} as Quote);

const QUOTES = [
  q({ id: '1', quote_number: 'Q-001', status: 'draft', customer_name: 'Acme Ltd', created_at: '2026-06-01T00:00:00Z' }),
  q({ id: '2', quote_number: 'Q-002', status: 'approved', customer_name: 'Beta Co', created_at: '2026-06-15T23:59:00Z', created_by: { id: 'u2', full_name: 'Bob', email: 'b@x.com' } }),
  q({ id: '3', quote_number: 'Q-003', status: 'approved', customer_name: 'Acme Ltd', created_at: '2026-07-01T00:00:00Z' }),
];
const name = (x: Quote) => x.customer_name ?? '';
const ids = (rows: Quote[]) => rows.map((r) => r.id);

describe('filterQuotesForExport (Pulse 222d6d31)', () => {
  it('given no criteria, when filtered, then every quote is kept', () => {
    expect(ids(filterQuotesForExport(QUOTES, EMPTY_EXPORT_CRITERIA, name))).toEqual(['1', '2', '3']);
  });
  it('given a status, when filtered, then only that status remains', () => {
    expect(ids(filterQuotesForExport(QUOTES, { ...EMPTY_EXPORT_CRITERIA, status: 'approved' }, name))).toEqual(['2', '3']);
  });
  it('given a date range, when filtered, then both boundary days are inclusive', () => {
    const c = { ...EMPTY_EXPORT_CRITERIA, dateFrom: '2026-06-01', dateTo: '2026-06-15' };
    expect(ids(filterQuotesForExport(QUOTES, c, name))).toEqual(['1', '2']);
  });
  it('given customer text, when filtered, then it matches case-insensitively', () => {
    expect(ids(filterQuotesForExport(QUOTES, { ...EMPTY_EXPORT_CRITERIA, customer: 'acme' }, name))).toEqual(['1', '3']);
  });
  it('given a quote number fragment, when filtered, then it matches', () => {
    expect(ids(filterQuotesForExport(QUOTES, { ...EMPTY_EXPORT_CRITERIA, quoteNumber: '002' }, name))).toEqual(['2']);
  });
  it('given a creator, when filtered, then only their quotes remain', () => {
    expect(ids(filterQuotesForExport(QUOTES, { ...EMPTY_EXPORT_CRITERIA, createdBy: 'u2' }, name))).toEqual(['2']);
  });
  it('given combined criteria, when filtered, then they are ANDed', () => {
    const c = { ...EMPTY_EXPORT_CRITERIA, status: 'approved', customer: 'acme' };
    expect(ids(filterQuotesForExport(QUOTES, c, name))).toEqual(['3']);
  });
  it('given criteria that match nothing, when filtered, then the result is empty', () => {
    expect(filterQuotesForExport(QUOTES, { ...EMPTY_EXPORT_CRITERIA, status: 'rejected' }, name)).toEqual([]);
  });
});

describe('validateExportCriteria / hasAnyCriteria', () => {
  it('given From after To, when validated, then a message is returned', () => {
    expect(validateExportCriteria({ ...EMPTY_EXPORT_CRITERIA, dateFrom: '2026-07-02', dateTo: '2026-07-01' })).toMatch(/cannot be later/);
  });
  it('given an ascending range, when validated, then it is accepted', () => {
    expect(validateExportCriteria({ ...EMPTY_EXPORT_CRITERIA, dateFrom: '2026-07-01', dateTo: '2026-07-01' })).toBeNull();
  });
  it('given whitespace-only text, when checked, then it does not count as a criterion', () => {
    expect(hasAnyCriteria({ ...EMPTY_EXPORT_CRITERIA, customer: '   ' })).toBe(false);
  });
});
