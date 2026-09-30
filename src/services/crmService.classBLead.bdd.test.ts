/**
 * Feature: Class B custom fields on leads do not collide with legacy meta_data.
 *
 * FE `lead.custom_fields` has always been the legacy `meta_data` mapping. The
 * Data Layer's Class B values live in the lead row's own `custom_fields` column,
 * so the mapper exposes them separately as `class_b_custom_fields`, and the
 * native PATCH sends them raw as `custom_fields`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { leadsApi } from './crmService';

function ok(data: any) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  });
}

const LEAD = { id: 'l1', company_name: 'Acme', contact_name: 'Ann', status: 'new' };

describe('Feature: lead Class B custom_fields mapping', () => {
  beforeEach(() => fetchMock.mockReset());

  it('Given a lead with both meta_data and custom_fields / When mapped / Then legacy stays in custom_fields and Class B in class_b_custom_fields', async () => {
    ok({ ...LEAD, meta_data: { legacy: 'x' }, custom_fields: { plate: 'KL-01' } });
    const lead: any = await leadsApi.update('l1', { custom_fields: { plate: 'KL-01' } });
    expect(lead.custom_fields).toEqual({ legacy: 'x' });
    expect(lead.class_b_custom_fields).toEqual({ plate: 'KL-01' });
  });

  it('Given a lead without a custom_fields column / When mapped / Then class_b_custom_fields is absent', async () => {
    ok({ ...LEAD, meta_data: { legacy: 'x' } });
    const lead: any = await leadsApi.update('l1', { status: 'new' });
    expect('class_b_custom_fields' in lead).toBe(false);
  });

  it('Given Class B values / When saved natively / Then they are PATCHed raw as custom_fields (not meta_data)', async () => {
    ok({ ...LEAD, custom_fields: { plate: 'KL-01' } });
    await leadsApi.update('l1', { custom_fields: { plate: 'KL-01' } });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/leads/l1');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ custom_fields: { plate: 'KL-01' } });
  });
});
