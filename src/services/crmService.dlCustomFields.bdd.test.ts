import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { crmService } from './crmService';

const ok = (data: any) => fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(data)) });

beforeEach(() => fetchMock.mockReset());

describe('crmService data-layer custom fields', () => {
  it('Given a lead / When saving DL fields / Then PATCH body is custom_fields keyed by field_key plus the version', async () => {
    ok({ id: 'l1', custom_fields: { budget: 9 }, custom_fields_version: 4, meta_data: {} });
    const lead = await crmService.updateLeadCustomFields('l1', { budget: 9 }, 3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/leads/l1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ custom_fields: { budget: 9 }, custom_fields_version: 3 });
    expect(lead.dl_custom_fields).toEqual({ budget: 9 });
    expect(lead.custom_fields_version).toBe(4);
  });

  it('Given a deal / When saving DL fields / Then PATCH body carries custom_fields and version', async () => {
    ok({ id: 'd1', custom_fields: { tier: 'a' }, custom_fields_version: 2 });
    await crmService.updateDealCustomFields('d1', { tier: 'a' }, 1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/deals/d1');
    expect(JSON.parse(init.body)).toEqual({ custom_fields: { tier: 'a' }, custom_fields_version: 1 });
  });

  it('Given no version / Then custom_fields_version is omitted', async () => {
    ok({ id: 'l1' });
    await crmService.updateLeadCustomFields('l1', { a: 1 }, null);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ custom_fields: { a: 1 } });
  });

  it('Given a stale version / Then the 409 Error carries status 409', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, text: () => Promise.resolve(JSON.stringify({ message: 'stale' })) });
    await expect(crmService.updateLeadCustomFields('l1', { a: 1 }, 1)).rejects.toMatchObject({ status: 409 });
  });

  it('Given Core validation is down / Then the 503 Error carries status 503', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve(JSON.stringify({ message: 'down' })) });
    await expect(crmService.updateDealCustomFields('d1', { a: 1 }, 1)).rejects.toMatchObject({ status: 503 });
  });
});
