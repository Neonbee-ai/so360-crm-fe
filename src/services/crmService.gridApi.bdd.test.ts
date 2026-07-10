import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { leadsApi, gridPrefsApi } from './crmService';

// BDD specs for the enterprise-grid additions to the CRM API layer:
//   • leadsApi.getPaged     — server-side paging + X-Total-Count header
//   • leadsApi.bulk*        — bulk update / delete / tags
//   • gridPrefsApi.*        — saved views + column layout CRUD

const okResponse = (body: unknown, headers: Record<string, string> = {}) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    headers: { get: (k: string) => headers[k] ?? null },
});

const errorResponse = (status: number, body: unknown) => ({
    ok: false,
    status,
    text: async () => JSON.stringify(body),
    headers: { get: () => null },
});

describe('grid API layer', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('leadsApi.getPaged', () => {
        it('sends meta=true + sort/filter and returns { data, total } from the header', async () => {
            fetchMock.mockResolvedValueOnce(okResponse([{ id: '1', status: 'new' }], { 'X-Total-Count': '57' }));

            const res = await leadsApi.getPaged({ skip: 0, take: 50, sort: 'status:asc', filter: '{"combinator":"and","rules":[]}' });

            expect(res.total).toBe(57);
            expect(res.data).toHaveLength(1);
            const url = String(fetchMock.mock.calls[0][0]);
            expect(url).toContain('/leads');
            expect(url).toContain('meta=true');
            expect(url).toContain('sort=status');
            expect(url).toContain('filter=');
        });

        it('returns total=null when the header is absent (older backend)', async () => {
            fetchMock.mockResolvedValueOnce(okResponse([]));
            const res = await leadsApi.getPaged({ skip: 0, take: 50 });
            expect(res.total).toBeNull();
            expect(res.data).toEqual([]);
        });

        it('throws with the backend message on error', async () => {
            fetchMock.mockResolvedValueOnce(errorResponse(400, { message: 'bad filter' }));
            await expect(leadsApi.getPaged({})).rejects.toThrow('bad filter');
        });
    });

    describe('leadsApi.bulk operations', () => {
        it('bulkUpdate posts ids + patch to /leads/bulk/update', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ requested: 2, updated: ['a', 'b'], failed: [] }));
            const res = await leadsApi.bulkUpdate(['a', 'b'], { owner_id: 'u1' });
            expect(res.updated).toEqual(['a', 'b']);
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toContain('/leads/bulk/update');
            expect(init.method).toBe('POST');
            expect(JSON.parse(init.body)).toEqual({ ids: ['a', 'b'], patch: { owner_id: 'u1' } });
        });

        it('bulkDelete posts ids to /leads/bulk/delete', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ requested: 1, deleted: ['a'], failed: [] }));
            await leadsApi.bulkDelete(['a']);
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toContain('/leads/bulk/delete');
            expect(JSON.parse(init.body)).toEqual({ ids: ['a'] });
        });

        it('bulkTags posts ids + add/remove to /leads/bulk/tags', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ requested: 1, updated: ['a'], failed: [] }));
            await leadsApi.bulkTags(['a'], ['vip'], ['cold']);
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toContain('/leads/bulk/tags');
            expect(JSON.parse(init.body)).toEqual({ ids: ['a'], add: ['vip'], remove: ['cold'] });
        });
    });

    describe('gridPrefsApi', () => {
        it('listViews GETs /grid/views with entity_type', async () => {
            fetchMock.mockResolvedValueOnce(okResponse([{ id: 'v1' }]));
            const res = await gridPrefsApi.listViews('lead');
            expect(res).toEqual([{ id: 'v1' }]);
            expect(String(fetchMock.mock.calls[0][0])).toContain('/grid/views?entity_type=lead');
        });

        it('createView POSTs the dto', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ id: 'v-new' }));
            await gridPrefsApi.createView({ name: 'My View', config: { a: 1 } });
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toContain('/grid/views');
            expect(init.method).toBe('POST');
            expect(JSON.parse(init.body)).toEqual({ name: 'My View', config: { a: 1 } });
        });

        it('setDefaultView POSTs to /grid/views/:id/default', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ id: 'v1', is_default: true }));
            await gridPrefsApi.setDefaultView('v1');
            expect(String(fetchMock.mock.calls[0][0])).toContain('/grid/views/v1/default');
        });

        it('duplicateView POSTs to /grid/views/:id/duplicate', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ id: 'v-copy' }));
            await gridPrefsApi.duplicateView('v1');
            expect(String(fetchMock.mock.calls[0][0])).toContain('/grid/views/v1/duplicate');
        });

        it('deleteView DELETEs /grid/views/:id', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ deleted: true }));
            await gridPrefsApi.deleteView('v1');
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toContain('/grid/views/v1');
            expect(init.method).toBe('DELETE');
        });

        it('saveColumns PUTs the prefs payload', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ prefs: { order: ['a'] } }));
            await gridPrefsApi.saveColumns({ order: ['a'] }, 'lead');
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toContain('/grid/columns');
            expect(init.method).toBe('PUT');
            expect(JSON.parse(init.body)).toEqual({ entity_type: 'lead', prefs: { order: ['a'] } });
        });

        it('getColumns GETs /grid/columns with entity_type', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ prefs: {} }));
            await gridPrefsApi.getColumns('lead');
            expect(String(fetchMock.mock.calls[0][0])).toContain('/grid/columns?entity_type=lead');
        });

        it('resetColumns DELETEs /grid/columns with entity_type query', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ reset: true }));
            await gridPrefsApi.resetColumns('lead');
            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toContain('/grid/columns?entity_type=lead');
            expect(init.method).toBe('DELETE');
        });
    });
});
