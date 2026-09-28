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

describe('Given loosely typed widget rows', () => {
    describe('When lists contain nulls, primitives and odd value types', () => {
        it('Then non-object rows drop, numbers default to 0 and numeric labels are stringified', () => {
            const d = normalizeREWidgets({
                pipeline_by_project: [null, 3, 'x', { project: 101, value: true, count: '4' }, { project: '  ', value: 9 }],
            }, NOW);
            expect(d.pipeline_by_project).toEqual([{ project: '101', value: 0, count: 4 }]);
        });
    });

    describe('When holds miss their project or both identifiers', () => {
        it('Then the project reads null and an unidentified hold is dropped', () => {
            const d = normalizeREWidgets({
                holds_expiring: [
                    { unit_number: 'C-3', project: null, hours_left: 2 },
                    { unit_number: '', item_id: null, hours_left: 1 },
                    { hours_left: 1 },
                ],
            }, NOW);
            expect(d.holds_expiring).toEqual([{ item_id: null, unit_number: 'C-3', project: null, hours_left: 2 }]);
        });
    });

    describe('When sources lack a label', () => {
        it('Then they are dropped', () => {
            const d = normalizeREWidgets({ source_performance: [{ source: '', rate: 90 }, { source: 'Web', leads: 4, won: 1 }] }, NOW);
            expect(d.source_performance).toEqual([{ source: 'Web', leads: 4, won: 1, rate: 25 }]);
        });
    });
});

describe('Given hoursLeft edge values', () => {
    it('When hours_left is not numeric / Then expires_at is used instead', () => {
        expect(hoursLeft({ hours_left: 'soon', expires_at: '2026-09-28T15:00:00Z' }, NOW)).toBe(3);
    });
    it('When hours_left is negative or fractional / Then it is clamped and rounded', () => {
        expect(hoursLeft({ hours_left: -5 }, NOW)).toBe(0);
        expect(hoursLeft({ hours_left: '2.6' }, NOW)).toBe(3);
    });
    it('When no clock is passed / Then the current time is used', () => {
        const inTwoHours = new Date(Date.now() + 2 * 3_600_000 + 60_000).toISOString();
        expect(hoursLeft({ expires_at: inTwoHours })).toBe(2);
    });
});

describe('Given conversionRate with a non-numeric rate', () => {
    it('Then won / leads is used', () => {
        expect(conversionRate({ rate: 'n/a', leads: '10', won: 5 })).toBe(50);
        expect(conversionRate({})).toBe(0);
    });
});

describe('Given normalizeREWidgets without a clock', () => {
    it('Then holds are measured against now', () => {
        const at = new Date(Date.now() + 5 * 3_600_000 + 60_000).toISOString();
        expect(normalizeREWidgets({ holds_expiring: [{ unit_number: 'Z', expires_at: at }] }).holds_expiring[0].hours_left).toBe(5);
    });
});

describe('Given isREWidgetsEmpty', () => {
    const empty = normalizeREWidgets({}, NOW);
    it('When any single section has a row / Then it is not empty', () => {
        expect(isREWidgetsEmpty({ ...empty, inventory_by_project: [{ project: 'P', available: 1, held: 0, sold: 0 }] })).toBe(false);
        expect(isREWidgetsEmpty({ ...empty, pipeline_by_project: [{ project: 'P', value: 1, count: 1 }] })).toBe(false);
        expect(isREWidgetsEmpty({ ...empty, holds_expiring: [{ item_id: null, unit_number: 'U', project: null, hours_left: 1 }] })).toBe(false);
        expect(isREWidgetsEmpty({ ...empty, source_performance: [{ source: 'S', leads: 1, won: 0, rate: 0 }] })).toBe(false);
    });
});
