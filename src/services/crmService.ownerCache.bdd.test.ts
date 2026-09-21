import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { crmService, orgStaticCache } from './crmService';

/**
 * Regression coverage for Pulse b764367a: USERS_CACHE was a single module-level
 * Map keyed only by user id, populated by getUsers() and never cleared or
 * org-scoped. Switching organizations in the same tab left previously-cached
 * User objects in place, so a lead's owner_id could resolve against a stale
 * entry from a different org — producing a name/avatar pair that belonged to
 * someone else entirely. The fix keys cache entries by `${orgId}:${userId}`
 * and clears the cache on setOrgId().
 */
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
  crmService.setOrgId('org-a');
});
afterEach(() => vi.restoreAllMocks());

describe('crmService — users cache is org-scoped (b764367a)', () => {
  describe('Given the same user id resolves to different profiles in two orgs', () => {
    it('When org A\'s users are cached, then we switch to org B and fetch its lead / Then the lead owner resolves to org B\'s user record, not org A\'s stale cache entry', async () => {
      // Org A: user u1 is "Alice (Org A)"
      crmService.setOrgId('org-a');
      fetchMock.mockImplementation(() => ok([{ id: 'u1', full_name: 'Alice (Org A)', email: 'alice@a.com', avatar_url: 'alice-a.png' }]));
      await crmService.getUsers();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Switch to org B: user u1 is a completely different person, "Bob (Org B)"
      crmService.setOrgId('org-b');
      fetchMock.mockReset();
      fetchMock.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/users')) {
          return ok([{ id: 'u1', full_name: 'Bob (Org B)', email: 'bob@b.com', avatar_url: 'bob-b.png' }]);
        }
        // A lead owned by u1, with no embedded owner object — forces mapUser() to
        // resolve owner_id against USERS_CACHE.
        return ok([{ id: 'lead-1', owner_id: 'u1', value: '100' }]);
      });

      await crmService.getUsers();
      const leads = await crmService.getLeads();

      expect(leads[0].owner?.full_name).toBe('Bob (Org B)');
      expect(leads[0].owner?.full_name).not.toBe('Alice (Org A)');
      expect(leads[0].owner?.avatar_url).toBe('bob-b.png');
    });

    it('When switching back to org A after visiting org B / Then org A\'s own cached user data is used again (not org B\'s)', async () => {
      crmService.setOrgId('org-a');
      fetchMock.mockImplementation(() => ok([{ id: 'u1', full_name: 'Alice (Org A)', email: 'alice@a.com', avatar_url: 'alice-a.png' }]));
      await crmService.getUsers();

      crmService.setOrgId('org-b');
      fetchMock.mockReset();
      fetchMock.mockImplementation(() => ok([{ id: 'u1', full_name: 'Bob (Org B)', email: 'bob@b.com', avatar_url: 'bob-b.png' }]));
      await crmService.getUsers();

      crmService.setOrgId('org-a');
      fetchMock.mockReset();
      fetchMock.mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/users')) {
          return ok([{ id: 'u1', full_name: 'Alice (Org A)', email: 'alice@a.com', avatar_url: 'alice-a.png' }]);
        }
        return ok([{ id: 'lead-1', owner_id: 'u1', value: '100' }]);
      });
      await crmService.getUsers();
      const leads = await crmService.getLeads();

      expect(leads[0].owner?.full_name).toBe('Alice (Org A)');
    });
  });

  describe('Given setOrgId is called with the same org id (no real switch)', () => {
    it('When getUsers has already populated the cache / Then the cache is NOT cleared (no unnecessary re-fetch invalidation)', async () => {
      crmService.setOrgId('org-a');
      fetchMock.mockImplementation(() => ok([{ id: 'u1', full_name: 'Alice (Org A)', email: 'alice@a.com', avatar_url: 'alice-a.png' }]));
      await crmService.getUsers();

      // Re-affirm the same org id — should be a no-op for the cache.
      crmService.setOrgId('org-a');
      fetchMock.mockReset();
      fetchMock.mockImplementation((url: string) => ok([{ id: 'lead-1', owner_id: 'u1', value: '100' }]));

      const leads = await crmService.getLeads();

      // Owner still resolves correctly from the still-populated org-a cache.
      expect(leads[0].owner?.full_name).toBe('Alice (Org A)');
    });
  });
});
