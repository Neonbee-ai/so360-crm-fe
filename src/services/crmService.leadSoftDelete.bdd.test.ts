/**
 * Feature: the lead API client speaks soft delete
 *
 * Deleting a lead is reversible now, and "deleted" is a scope the list
 * endpoint understands rather than a row that no longer exists. These specs
 * pin the wire contract the pages depend on: the restore routes, and the
 * recycle-bin scope riding on the same list endpoint (so search, sort and
 * paging behave identically in every scope).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { leadsApi, crmService } from './crmService';

function ok(data: any) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  });
}

function fail(status: number, body: any) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

const LEAD = { id: 'l1', company_name: 'Acme', contact_name: 'Ann', status: 'new' };

describe('Feature: lead soft-delete API client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('Scenario: restoring a lead', () => {
    it('When restore is called / Then it POSTs to /leads/:id/restore', async () => {
      ok(LEAD);

      await leadsApi.restore('l1');

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/leads/l1/restore');
      expect(opts.method).toBe('POST');
    });

    it('When the lead is not deleted / Then the 404 surfaces to the caller', async () => {
      // The Undo affordance must be able to tell the user it did nothing,
      // rather than silently claiming a restore that never happened.
      fail(404, { message: 'Deleted lead l1 not found' });

      await expect(crmService.restoreLead('l1')).rejects.toBeTruthy();
    });

    it('When bulkRestore is called / Then it POSTs the ids to /leads/bulk/restore', async () => {
      ok({ requested: 2, restored: ['l1'], failed: [{ id: 'l2', error: 'not deleted' }] });

      const res = await crmService.bulkRestoreLeads(['l1', 'l2']);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/leads/bulk/restore');
      expect(JSON.parse(opts.body)).toEqual({ ids: ['l1', 'l2'] });
      // Callers must be able to distinguish restored from failed, per id.
      expect(res.restored).toEqual(['l1']);
      expect(res.failed).toHaveLength(1);
    });
  });

  describe('Scenario: reading the recycle bin', () => {
    it('When getDeleted is called / Then it asks the list endpoint for only_deleted', async () => {
      ok([LEAD]);

      await crmService.getDeletedLeads({ take: 25 });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('only_deleted=true');
      // Same endpoint as the active list — one filter/sort/paging pipeline,
      // so the two views can never drift apart.
      expect(url).toContain('/leads?');
    });

    it('When the active list is read / Then it does NOT ask for deleted leads', async () => {
      ok([LEAD]);

      await leadsApi.getAll();

      const [url] = fetchMock.mock.calls[0];
      expect(url).not.toContain('only_deleted');
      expect(url).not.toContain('include_deleted');
    });
  });

  describe('Scenario: bulk delete reporting', () => {
    it('When some ids fail / Then the per-id report reaches the caller intact', async () => {
      // The grid removes only `deleted`; collapsing this response into a
      // boolean is what let refused rows vanish from the screen.
      ok({ requested: 2, deleted: ['l1'], failed: [{ id: 'l2', error: 'Lead l2 not found' }] });

      const res = await crmService.bulkDeleteLeads(['l1', 'l2']);

      expect(res.deleted).toEqual(['l1']);
      expect(res.failed[0]).toEqual({ id: 'l2', error: 'Lead l2 not found' });
    });
  });
});
