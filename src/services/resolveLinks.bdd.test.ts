import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { crmService } from './crmService';

// BDD specs for crmService.resolveLinks — the CRM FE entry point into the
// cross-link layer. It posts a batch of (type,id) refs to the Core aggregator
// (/v1/links/resolve) and returns the resolved display payloads.

const okResponse = (body: unknown) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
});

describe('crmService.resolveLinks', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('Given an empty list of refs', () => {
        it('Then it returns an empty array without calling the aggregator', async () => {
            const result = await crmService.resolveLinks([]);

            expect(result).toEqual([]);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('Given a batch of refs and a well-formed aggregator response', () => {
        it('Then it POSTs the refs to /v1/links/resolve and returns the resolved links', async () => {
            const links = [
                { type: 'accounting.invoice', id: 'inv-1', label: 'INV-001', status: 'paid' },
                { type: 'projects.project', id: 'prj-1', label: 'Website Revamp' },
            ];
            fetchMock.mockResolvedValueOnce(okResponse({ links }));

            const refs = [
                { type: 'accounting.invoice', id: 'inv-1' },
                { type: 'projects.project', id: 'prj-1' },
            ];
            const result = await crmService.resolveLinks(refs);

            expect(result).toEqual(links);
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toMatch(/\/v1\/links\/resolve$/);
            expect(init.method).toBe('POST');
            expect(JSON.parse(init.body)).toEqual({ refs });
        });
    });

    describe('Given an aggregator response missing the links field', () => {
        it('Then it returns an empty array', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({}));

            const result = await crmService.resolveLinks([{ type: 'crm.deal', id: 'd-1' }]);

            expect(result).toEqual([]);
        });
    });

    describe('Given an aggregator response where links is not an array', () => {
        it('Then it returns an empty array', async () => {
            fetchMock.mockResolvedValueOnce(okResponse({ links: 'oops' }));

            const result = await crmService.resolveLinks([{ type: 'crm.deal', id: 'd-1' }]);

            expect(result).toEqual([]);
        });
    });
});
