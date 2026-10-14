import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

const REAL_TENANT = '3cf1c619-c8f6-49ac-9207-447418d5beee';

const mockFetchOk = (body: unknown) =>
    vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(body)),
        json: async () => body,
    });

const mockFetchFail = (status: number, message: string) =>
    vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: () => Promise.resolve(JSON.stringify({ message })),
        json: async () => ({ message }),
    });

// The Project picker used to load one capped page (limit 100) and swallow every
// failure as "no projects". searchProjects() pages and searches on the Projects
// backend, and lets failures through so the UI can offer a retry.
describe('crmService.searchProjects()', () => {
    beforeEach(() => {
        crmService.setTenantId(REAL_TENANT);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('Given a search term and page / When called / Then it GETs /projects with search, page and limit', async () => {
        const fetchSpy = mockFetchOk({ data: [{ id: 'p1' }], pagination: { page: 2, limit: 25, total: 60, totalPages: 3 } });
        vi.stubGlobal('fetch', fetchSpy);

        const result = await crmService.searchProjects({ search: 'sobha', page: 2, limit: 25 });

        const [url] = fetchSpy.mock.calls[0];
        expect(url).toContain('/projects');
        expect(url).toContain('search=sobha');
        expect(url).toContain('page=2');
        expect(url).toContain('limit=25');
        expect(result.data).toEqual([{ id: 'p1' }]);
    });

    it('Given more pages exist / When called / Then hasMore is true until the last page', async () => {
        vi.stubGlobal('fetch', mockFetchOk({ data: [{ id: 'p1' }], pagination: { totalPages: 3 } }));
        expect((await crmService.searchProjects({ page: 2 })).hasMore).toBe(true);

        vi.stubGlobal('fetch', mockFetchOk({ data: [{ id: 'p1' }], pagination: { totalPages: 3 } }));
        expect((await crmService.searchProjects({ page: 3 })).hasMore).toBe(false);
    });

    it('Given the response has no pagination metadata / When a full page returns / Then hasMore is true, a short page false', async () => {
        vi.stubGlobal('fetch', mockFetchOk(Array.from({ length: 5 }, (_, i) => ({ id: `p${i}` }))));
        expect((await crmService.searchProjects({ limit: 5 })).hasMore).toBe(true);

        vi.stubGlobal('fetch', mockFetchOk([{ id: 'p1' }]));
        expect((await crmService.searchProjects({ limit: 5 })).hasMore).toBe(false);
    });

    it('Given search text with PostgREST filter syntax / When called / Then , ( ) % * are stripped so the backend filter cannot be reshaped', async () => {
        const fetchSpy = mockFetchOk({ data: [], pagination: { totalPages: 0 } });
        vi.stubGlobal('fetch', fetchSpy);

        await crmService.searchProjects({ search: 'a,b(c)%d*' });

        const [url] = fetchSpy.mock.calls[0];
        const search = new URL(url, 'http://x').searchParams.get('search');
        expect(search).toBe('a b c d');
    });

    it('Given a blank search / When called / Then no search param is sent', async () => {
        const fetchSpy = mockFetchOk({ data: [] });
        vi.stubGlobal('fetch', fetchSpy);

        await crmService.searchProjects({ search: '  ,  ' });

        const [url] = fetchSpy.mock.calls[0];
        expect(url).not.toContain('search=');
    });

    it('Given the Projects API fails / When called / Then the error propagates (not swallowed into an empty list)', async () => {
        vi.stubGlobal('fetch', mockFetchFail(503, 'Projects unavailable'));
        await expect(crmService.searchProjects({ search: 'x' })).rejects.toBeTruthy();
    });
});
