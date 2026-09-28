import { describe, it, expect } from 'vitest';
import {
    HOLD_HOUR_OPTIONS, DEFAULT_HOLD_HOURS, holdHoursLabel, filterAvailable, describeReservation,
} from './unitBooking';
import type { InventoryItem } from '../../types/crm';

const item = (id: string, available_stock?: number): InventoryItem =>
    ({ id, name: id, sku: id, price: 0, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [], available_stock } as unknown as InventoryItem);

const NOW = Date.parse('2026-09-28T10:00:00Z');
const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

describe('Given the unit booking helpers', () => {
    describe('When reading the hold options', () => {
        it('Then 48 hours is the default and is one of the options', () => {
            expect(DEFAULT_HOLD_HOURS).toBe(48);
            expect(HOLD_HOUR_OPTIONS).toContain(48);
        });
        it('Then whole days read as days', () => {
            expect(holdHoursLabel(24)).toBe('1 day');
            expect(holdHoursLabel(48)).toBe('2 days');
            expect(holdHoursLabel(168)).toBe('7 days');
            expect(holdHoursLabel(12)).toBe('12h');
        });
    });

    describe('When filtering for available units', () => {
        const items = [item('a', 1), item('b', 0), item('c'), item('d', -2)];
        it('Then the toggle off keeps every item', () => {
            expect(filterAvailable(items, false)).toHaveLength(4);
        });
        it('Then the toggle on drops sold-out units but keeps items without a stock figure', () => {
            expect(filterAvailable(items, true).map(i => i.id)).toEqual(['a', 'c']);
        });
    });

    describe('When describing a reservation', () => {
        it('Then no status means no chip', () => {
            expect(describeReservation(null, null, NOW)).toBeNull();
            expect(describeReservation(undefined, undefined, NOW)).toBeNull();
            expect(describeReservation('something-else', null, NOW)).toBeNull();
        });
        it('Then a sold unit reads Sold', () => {
            expect(describeReservation('sold', null, NOW)).toEqual({ label: 'Sold', tone: 'sold' });
        });
        it('Then a hold shows the time left', () => {
            expect(describeReservation('held', inHours(30), NOW)).toEqual({ label: 'Held · 1d 6h left', tone: 'held' });
            expect(describeReservation('held', inHours(5), NOW)).toEqual({ label: 'Held · 5h left', tone: 'held' });
            expect(describeReservation('held', inHours(0.5), NOW)).toEqual({ label: 'Held · 30m left', tone: 'held' });
        });
        it('Then a hold without a readable expiry reads Held', () => {
            expect(describeReservation('held', null, NOW)?.label).toBe('Held');
            expect(describeReservation('held', 'not-a-date', NOW)?.label).toBe('Held');
        });
        it('Then a hold past its expiry reads Hold expired before the backend sweep runs', () => {
            expect(describeReservation('held', inHours(-1), NOW)).toEqual({ label: 'Hold expired', tone: 'muted' });
        });
        it('Then expired and released statuses read muted', () => {
            expect(describeReservation('expired', null, NOW)).toEqual({ label: 'Hold expired', tone: 'muted' });
            expect(describeReservation('released', null, NOW)).toEqual({ label: 'Released', tone: 'muted' });
        });
    });
});

describe('Given describeReservation edge timings', () => {
    describe('When a hold has under a minute left', () => {
        it('Then it reads at least 1m left', () => {
            expect(describeReservation('held', new Date(NOW + 10_000).toISOString(), NOW)).toEqual({ label: 'Held · 1m left', tone: 'held' });
        });
    });
    describe('When a hold has exactly one hour or exactly one day left', () => {
        it('Then the hour and day thresholds are inclusive', () => {
            expect(describeReservation('held', inHours(1), NOW)?.label).toBe('Held · 1h left');
            expect(describeReservation('held', inHours(24), NOW)?.label).toBe('Held · 1d 0h left');
        });
    });
    describe('When a hold expires exactly now', () => {
        it('Then zero milliseconds left reads Hold expired', () => {
            expect(describeReservation('held', new Date(NOW).toISOString(), NOW)?.label).toBe('Hold expired');
        });
    });
    describe('When no clock is passed', () => {
        it('Then the default Date.now() is used', () => {
            const farFuture = new Date(Date.now() + 5 * 24 * 3_600_000 + 60_000).toISOString();
            expect(describeReservation('held', farFuture)).toEqual({ label: 'Held · 5d 0h left', tone: 'held' });
            expect(describeReservation('held', '2000-01-01T00:00:00Z')?.label).toBe('Hold expired');
        });
    });
    describe('When the hold option list is read', () => {
        it('Then every option has a label', () => {
            expect(HOLD_HOUR_OPTIONS.map(holdHoursLabel)).toEqual(['1 day', '2 days', '3 days', '7 days']);
        });
    });
});
