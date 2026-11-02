import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

/**
 * AutoQA r153: opening a detail page with a placeholder id (e.g. ":id") fired
 * GET /tasks?deal_id=:id and GET /deals?lead_id=:id, which the BE answers 400.
 * A non-UUID id cannot match a row, so the scoped list helpers must not call the API.
 */
const REAL_TENANT = '3cf1c619-c8f6-49ac-9207-447418d5beee';
const VALID_ID = 'c4deff86-ba44-43b0-9013-4d7965298514';

const mockFetchOk = (body: unknown) =>
    vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(body)),
        json: async () => body,
    });

describe('crmService scoped list helpers with non-UUID ids', () => {
    beforeEach(() => {
        crmService.setTenantId(REAL_TENANT);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it.each([
        ['getTasksByDealId', (id: string) => crmService.getTasksByDealId(id)],
        ['getTasksByLeadId', (id: string) => crmService.getTasksByLeadId(id)],
        ['getDealsByLeadId', (id: string) => crmService.getDealsByLeadId(id)],
    ])('Given a placeholder id / When %s is called / Then it resolves [] and sends no request', async (_n, call) => {
        const fetchSpy = mockFetchOk([]);
        vi.stubGlobal('fetch', fetchSpy);
        await expect(call(':id')).resolves.toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Given a valid UUID / When getTasksByDealId is called / Then it GETs /tasks with deal_id', async () => {
        const fetchSpy = mockFetchOk([]);
        vi.stubGlobal('fetch', fetchSpy);
        await crmService.getTasksByDealId(VALID_ID);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(String(fetchSpy.mock.calls[0][0])).toContain(`deal_id=${VALID_ID}`);
    });
});
