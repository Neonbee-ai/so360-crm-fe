import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { leadsApi, crmService } from './crmService';

function mockErrorResponse(status: number, body: any) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function mockSuccess(data: any) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

/**
 * These cover the seam that let an authorization failure masquerade as a missing
 * record. The API layer discarded the HTTP status when turning a failed response
 * into an Error, and getLeadById then collapsed every failure to `undefined` — so
 * "you may not see this lead" and "this lead does not exist" arrived at the UI
 * completely indistinguishable, and Lead Detail rendered "Lead not found."
 */
describe('crmService — HTTP status is preserved on failures', () => {
  describe('Given the backend rejects a request with 403', () => {
    it('When the call fails / Then the thrown Error carries status 403', async () => {
      mockErrorResponse(403, { message: 'This action requires one of these permissions: leads.read' });

      await expect(leadsApi.getById('lead-1')).rejects.toMatchObject({ status: 403 });
    });

    it('When the call fails / Then the server message is still surfaced', async () => {
      mockErrorResponse(403, { message: 'This action requires one of these permissions: leads.read' });

      await expect(leadsApi.getById('lead-1')).rejects.toThrow(/leads\.read/);
    });
  });

  describe('Given the backend rejects a request with 404', () => {
    it('When the call fails / Then the thrown Error carries status 404, not 403', async () => {
      mockErrorResponse(404, { message: 'Lead not found' });

      await expect(leadsApi.getById('missing')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('Given the backend rejects a request with 500', () => {
    it('When the call fails / Then the thrown Error carries status 500', async () => {
      mockErrorResponse(500, { message: 'boom' });

      await expect(leadsApi.getById('lead-1')).rejects.toMatchObject({ status: 500 });
    });
  });
});

describe('crmService.getLeadById — denial and absence are different outcomes', () => {
  describe('Given the caller is not permitted to read the lead', () => {
    it('When getLeadById is called / Then the 403 propagates instead of becoming undefined', async () => {
      mockErrorResponse(403, { message: 'Forbidden' });

      // The regression: swallowing this made the page render "Lead not found."
      await expect(crmService.getLeadById('lead-1')).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('Given the lead genuinely does not exist', () => {
    it('When getLeadById is called / Then it still resolves to undefined', async () => {
      mockErrorResponse(404, { message: 'Not found' });

      await expect(crmService.getLeadById('missing')).resolves.toBeUndefined();
    });
  });

  describe('Given the request fails for any other reason', () => {
    it('When the server errors / Then the historical soft-fail is preserved', async () => {
      mockErrorResponse(500, { message: 'boom' });

      await expect(crmService.getLeadById('lead-1')).resolves.toBeUndefined();
    });

    it('When the network is down / Then it resolves to undefined rather than throwing', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Network error'));

      await expect(crmService.getLeadById('lead-1')).resolves.toBeUndefined();
    });
  });

  describe('Given the caller is permitted', () => {
    it('When getLeadById succeeds / Then the lead is returned', async () => {
      mockSuccess({ id: 'lead-1', status: 'NEW', notes: [], documents: [], deals: [], tasks: [], activities: [] });

      await expect(crmService.getLeadById('lead-1')).resolves.toMatchObject({ id: 'lead-1' });
    });
  });
});
