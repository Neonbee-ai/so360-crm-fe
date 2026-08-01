import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { crmService, orgStaticCache } from './crmService';

// getSettings fans out to 8 endpoints; getUsers hits one. Both are wrapped in a
// shared org-keyed coalescer + TTL cache. These tests assert concurrent reads
// collapse, repeat reads are served from cache, and mutations invalidate it.

function ok(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  } as any);
}

beforeEach(() => {
  fetchMock.mockReset();
  orgStaticCache.invalidate();
});
afterEach(() => vi.restoreAllMocks());

describe('crmService org-static cache', () => {
  describe('Given getSettings fans out to 8 endpoints', () => {
    it('When two callers ask at once / Then only one fan-out (8 requests) is made', async () => {
      fetchMock.mockImplementation(() => ok([]));

      const [a, b] = await Promise.all([
        crmService.getSettings(),
        crmService.getSettings(),
      ]);

      // Coalesced: a single fan-out of 8 requests, not 16.
      expect(fetchMock).toHaveBeenCalledTimes(8);
      expect(a).toEqual(b);
    });

    it('When called again within the TTL / Then the cached settings are served', async () => {
      fetchMock.mockImplementation(() => ok([]));

      await crmService.getSettings();
      expect(fetchMock).toHaveBeenCalledTimes(8);

      await crmService.getSettings();
      // Second read hits the cache — still 8 total.
      expect(fetchMock).toHaveBeenCalledTimes(8);
    });
  });

  describe('Given getUsers', () => {
    it('When called concurrently / Then only one request is made', async () => {
      fetchMock.mockImplementation(() => ok([{ id: 'u1', full_name: 'Alice', email: 'a@b.com' }]));

      const [a, b] = await Promise.all([
        crmService.getUsers(),
        crmService.getUsers(),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(a).toEqual(b);
      expect(a[0].full_name).toBe('Alice');
    });

    it('When called again within the TTL / Then the cached users are served', async () => {
      fetchMock.mockImplementation(() => ok([{ id: 'u1', full_name: 'Alice', email: 'a@b.com' }]));

      await crmService.getUsers();
      await crmService.getUsers();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given updateSettings runs', () => {
    it('When settings are saved / Then the next getSettings re-fetches', async () => {
      fetchMock.mockImplementation(() => ok([]));

      await crmService.getSettings();
      expect(fetchMock).toHaveBeenCalledTimes(8);

      // updateSettings issues its own writes then invalidates the settings cache.
      await crmService.updateSettings({
        deal_stages: [],
        lead_stages: [],
        default_owner_id: '',
        lead_sources: [],
        source_type_options: [],
        lead_custom_fields: [],
        deal_custom_fields: [],
        partner_custom_fields: [],
        lead_scoring: [],
        score_categories: [],
      } as any);

      const callsAfterUpdate = fetchMock.mock.calls.length;
      await crmService.getSettings();
      // The post-update getSettings is a cache miss → another 8-request fan-out.
      expect(fetchMock.mock.calls.length).toBe(callsAfterUpdate + 8);
    });
  });
});
