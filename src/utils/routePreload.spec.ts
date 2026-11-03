import { describe, it, expect, vi } from 'vitest';
import { preloadRouteChunk } from './routePreload';

const routes = (lead = vi.fn(() => Promise.resolve()), deal = vi.fn(() => Promise.resolve())) => ({
    lead, deal,
    list: [
        { pattern: /\/leads\/[^/]+\/?$/, load: lead },
        { pattern: /\/deals?\/[^/]+\/?$/, load: deal },
    ],
});

describe('preloadRouteChunk', () => {
    it('given a lead detail deep link, when the MFE loads, then only the lead detail chunk starts downloading', () => {
        const r = routes();
        expect(preloadRouteChunk('/crm/leads/c6bb120c-57c9', r.list)).toBe(true);
        expect(r.lead).toHaveBeenCalledTimes(1);
        expect(r.deal).not.toHaveBeenCalled();
    });

    it('given a deal detail deep link, when the MFE loads, then the deal detail chunk starts downloading', () => {
        const r = routes();
        expect(preloadRouteChunk('/crm/deals/410c8a10/', r.list)).toBe(true);
        expect(r.deal).toHaveBeenCalledTimes(1);
    });

    it('given a list route, when the MFE loads, then no chunk is preloaded', () => {
        const r = routes();
        expect(preloadRouteChunk('/crm/leads', r.list)).toBe(false);
        expect(r.lead).not.toHaveBeenCalled();
        expect(r.deal).not.toHaveBeenCalled();
    });

    it('given the chunk download fails, when preloading, then the error is swallowed so React.lazy can retry', async () => {
        const failing = vi.fn(() => Promise.reject(new Error('chunk 404')));
        expect(preloadRouteChunk('/crm/leads/x', [{ pattern: /\/leads\/[^/]+$/, load: failing }])).toBe(true);
        await Promise.resolve();
        expect(failing).toHaveBeenCalledTimes(1);
    });
});
