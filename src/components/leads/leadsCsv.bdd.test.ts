import { describe, it, expect } from 'vitest';
import { escapeCsvField, leadsToCsv } from './leadsCsv';
import type { Lead } from '../../types/crm';

const lead = (over: Partial<Lead> = {}): Lead =>
  ({
    id: 'l1',
    company_name: 'Acme',
    contact_name: 'Jane Doe',
    contact_email: 'jane@acme.com',
    phone: '555-1',
    status: 'New',
    source: 'Website',
    owner: { id: 'u1', full_name: 'Alice', email: 'a@t.com' },
    created_at: '2026-01-01T00:00:00Z',
    activities: [],
    ...(over as object),
  } as Lead);

describe('escapeCsvField', () => {
  it('leaves a plain value untouched', () => {
    expect(escapeCsvField('Acme')).toBe('Acme');
  });
  it('quotes values containing commas, quotes or newlines and doubles quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
  it('defuses spreadsheet formula injection on leading =/+/-/@', () => {
    expect(escapeCsvField('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(escapeCsvField('+1')).toBe('"\'+1"');
    expect(escapeCsvField('@x')).toBe('"\'@x"');
  });
  it('treats null/undefined as empty', () => {
    expect(escapeCsvField(undefined as any)).toBe('');
  });
});

describe('leadsToCsv', () => {
  it('emits a header row plus one CRLF-delimited row per lead', () => {
    const csv = leadsToCsv([lead(), lead({ id: 'l2', company_name: 'Beta', status: 'Lost' as any })]);
    const rows = csv.split('\r\n');
    expect(rows[0]).toBe('Company,Contact,Email,Phone,Status,Source,Owner,Created');
    expect(rows).toHaveLength(3);
    expect(rows[1].startsWith('Acme,Jane Doe,jane@acme.com')).toBe(true);
    expect(rows[2].startsWith('Beta,')).toBe(true);
  });

  it('falls back to first+last name when contact_name is absent', () => {
    const csv = leadsToCsv([lead({ contact_name: undefined, first_name: 'John', last_name: 'Roe' })]);
    expect(csv.split('\r\n')[1]).toContain('John Roe');
  });

  it('escapes a company name containing a comma', () => {
    const csv = leadsToCsv([lead({ company_name: 'Acme, Inc' })]);
    expect(csv.split('\r\n')[1].startsWith('"Acme, Inc",')).toBe(true);
  });

  it('handles an empty list (header only)', () => {
    expect(leadsToCsv([])).toBe('Company,Contact,Email,Phone,Status,Source,Owner,Created');
  });
});
