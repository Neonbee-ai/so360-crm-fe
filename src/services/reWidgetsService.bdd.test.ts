import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    reWidgetsService,
    normalizeREWidgets,
    hoursLeft,
    conversionRate,
    isREWidgetsEmpty,
} from './reWidgetsService';

const NOW = new Date('2026-09-28T12:00:00Z');

beforeEach(() => vi.clearAllMocks());

describe('Given the RE widgets service', () => {
    describe('When the widgets are fetched', () => {
        it('Then GET /dashboard/re-widgets is called and the payload is normalised', async () => {
            api.get.mockResolvedValueOnce({
                inventory_by_project: [{ project: 'Marina', available: 84, held: 12, sold: 24 }],
                pipeline_by_project: [{ project: 'Marina', value: 38000000, count: 9 }],
                holds_expiring: [{ item_id: 'i1', unit_number: 'MH-A-1201', project: 'Marina', hours_left: 6 }],
                source_performance: [{ source: 'Meta', leads: 50, won: 19, rate: 38 }],
            });
            const d = await reWidgetsService.get();
            expect(api.get).toHaveBeenCalledWith('/dashboard/re-widgets');
            expect(d.inventory_by_project).toEqual([{ project: 'Marina', available: 84, held: 12, sold: 24 }]);
            expect(d.pipeline_by_project).toEqual([{ project: 'Marina', value: 38000000, count: 9 }]);
            expect(d.holds_expiring).toEqual([{ item_id: 'i1', unit_number: 'MH-A-1201', project: 'Marina', hours_left: 6 }]);
            expect(d.source_performance).toEqual([{ source: 'Meta', leads: 50, won: 19, rate: 38 }]);
        });
    });

    describe('When the payload is missing or malformed', () => {
        it('Then every section reads as an empty list', () => {
            for (const raw of [null, undefined, 'oops', {}, { inventory_by_project: 'x', holds_expiring: null }]) {
                const d = normalizeREWidgets(raw, NOW);
                expect(isREWidgetsEmpty(d)).toBe(true);
            }
        });

        it('Then rows without a label are dropped and bad numbers become 0', () => {
            const d = normalizeREWidgets({
                inventory_by_project: [{ project: '', available: 1 }, { project: 'Palm', available: 'abc', held: '3', sold: null }],
            }, NOW);
            expect(d.inventory_by_project).toEqual([{ project: 'Palm', available: 0, held: 3, sold: 0 }]);
        });
    });

    describe('When holds carry expires_at instead of hours_left', () => {
        it('Then hours left are derived from now, never negative, soonest first', () => {
            const d = normalizeREWidgets({
                holds_expiring: [
                    { unit_number: 'B-2', expires_at: '2026-09-28T22:00:00Z' },
                    { unit_number: 'A-1', expires_at: '2026-09-28T18:00:00Z' },
                    { item_id: 'item-9', expires_at: '2026-09-28T10:00:00Z' },
                ],
            }, NOW);
            expect(d.holds_expiring.map((h) => [h.unit_number, h.hours_left])).toEqual([
                ['item-9', 0], ['A-1', 6], ['B-2', 10],
            ]);
        });

        it('Then an unreadable expiry reads as 0 hours', () => {
            expect(hoursLeft({ expires_at: 'not-a-date' }, NOW)).toBe(0);
            expect(hoursLeft({}, NOW)).toBe(0);
        });
    });

    describe('When a source has no rate', () => {
        it('Then the rate is won / leads, and 0 when there are no leads', () => {
            expect(conversionRate({ leads: 40, won: 9 })).toBe(23);
            expect(conversionRate({ leads: 0, won: 0 })).toBe(0);
            expect(conversionRate({ rate: 37.6 })).toBe(38);
        });

        it('Then sources are ordered best converting first', () => {
            const d = normalizeREWidgets({
                source_performance: [{ source: 'Bayut', rate: 22 }, { source: 'Meta', rate: 38 }],
            }, NOW);
            expect(d.source_performance.map((s) => s.source)).toEqual(['Meta', 'Bayut']);
        });
    });

    describe('When the request fails', () => {
        it('Then the error propagates to the caller', async () => {
            api.get.mockRejectedValueOnce(new Error('404'));
            await expect(reWidgetsService.get()).rejects.toThrow('404');
        });
    });
});
