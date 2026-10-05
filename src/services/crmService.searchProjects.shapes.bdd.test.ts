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

describe('crmService.searchProjects() response shapes and defaults', () => {
    beforeEach(() => {
        crmService.setTenantId(REAL_TENANT);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('Given it is called with no arguments / When it runs / Then it asks for page 1 with the default page size and no search', async () => {
        const fetchSpy = mockFetchOk({ data: [], pagination: { totalPages: 1 } });
        vi.stubGlobal('fetch', fetchSpy);
        await crmService.searchProjects();
        const [url] = fetchSpy.mock.calls[0];
        expect(url).toContain('page=1');
        expect(url).toContain('limit=25');
        expect(url).not.toContain('search=');
    });

    it('Given pagination exists but has no totalPages / When it runs / Then a full page still means "more"', async () => {
        vi.stubGlobal('fetch', mockFetchOk({ data: [{ id: 'a' }, { id: 'b' }], pagination: {} }));
        expect((await crmService.searchProjects({ limit: 2 })).hasMore).toBe(true);
    });

    it('Given the body is neither an array nor { data } / When it runs / Then the result is empty with no more pages', async () => {
        vi.stubGlobal('fetch', mockFetchOk({ unexpected: true }));
        const res = await crmService.searchProjects({ limit: 5 });
        expect(res).toEqual({ data: [], hasMore: false });
    });
});

describe('crmService.searchProjects() double quotes', () => {
    beforeEach(() => {
        crmService.setTenantId(REAL_TENANT);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('Given a term with double quotes / When it runs / Then they are stripped so they cannot reshape the backend filter', async () => {
        const fetchSpy = mockFetchOk({ data: [], pagination: { totalPages: 0 } });
        vi.stubGlobal('fetch', fetchSpy);
        await crmService.searchProjects({ search: '"quoted" name' });
        const [url] = fetchSpy.mock.calls[0];
        expect(new URL(url, 'http://x').searchParams.get('search')).toBe('quoted name');
    });
});
