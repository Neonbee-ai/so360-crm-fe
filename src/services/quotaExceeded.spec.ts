import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmService } from './crmService';

/**
 * BDD: the CRM API client surfaces a 402 (quota exceeded) to the Shell's
 * upgrade modal through the shared `__so360_quota_exceeded` event, and stays
 * silent for every other failure status.
 */
const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Feature: quota-exceeded interceptor on the CRM API client', () => {
    let received: CustomEvent[];
    const listener = (e: Event) => { received.push(e as CustomEvent); };

    beforeEach(() => {
        received = [];
        crmService.setTenantId('3cf1c619-c8f6-49ac-9207-447418d5beee');
        vi.spyOn(console, 'error').mockImplementation(() => {});
        window.addEventListener('__so360_quota_exceeded', listener);
    });
    afterEach(() => {
        window.removeEventListener('__so360_quota_exceeded', listener);
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('Given the backend answers 402 with a resolution hint', () => {
        it('When apiClient.request runs / Then __so360_quota_exceeded is dispatched with the resolution and the call still rejects', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(402, {
                code: 'QUOTA_EXCEEDED', resolution: { action: 'upgrade', plan: 'growth' },
            })));

            await expect(crmService.getDeals()).rejects.toMatchObject({ status: 402 });

            expect(received).toHaveLength(1);
            expect(received[0].detail).toEqual({ action: 'upgrade', plan: 'growth' });
        });
    });

    describe('Given the backend answers 402 without a resolution', () => {
        it('When the inventory stock lookup runs / Then the raw body is the event detail and the lookup degrades to { items: [] }', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(402, { code: 'QUOTA_EXCEEDED' })));

            await expect(crmService.getStockAvailability(['item-1'])).resolves.toEqual({ items: [] });

            expect(received).toHaveLength(1);
            expect(received[0].detail).toEqual({ code: 'QUOTA_EXCEEDED' });
        });
    });

    describe('Given the backend answers 500', () => {
        it('When apiClient.request runs / Then no quota event is dispatched and the error propagates', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { message: 'boom' })));

            await expect(crmService.getDeals()).rejects.toMatchObject({ status: 500 });

            expect(received).toHaveLength(0);
        });
    });
});
