import { describe, it, expect } from 'vitest';
import {
    parseStoredTimestamp,
    toDatetimeLocalInputValue,
    toDateInputValue,
    inputValueToIso,
    hasTimeComponent,
} from './datetime';

/**
 * Regression cover for "every reminder card shows 12:00 AM".
 *
 * Three separate defects converged on midnight:
 *   1. a zone-less stored timestamp read as browser-local, then re-formatted into
 *      an org timezone — double-shifted;
 *   2. a UTC wall clock fed into a `datetime-local` input, which is always local;
 *   3. a bare `YYYY-MM-DD` submitted for a reminder, which `new Date()` parses as
 *      UTC midnight.
 */

describe('Given parseStoredTimestamp', () => {
    it('When the value has no timezone designator / Then the wall clock is read as UTC', () => {
        expect(parseStoredTimestamp('2026-08-07T10:30:00').toISOString()).toBe('2026-08-07T10:30:00.000Z');
    });

    it('When the value uses a space separator (Postgres style) / Then it still parses as UTC', () => {
        expect(parseStoredTimestamp('2026-08-07 10:30:00').toISOString()).toBe('2026-08-07T10:30:00.000Z');
    });

    it('When the value already carries Z / Then it is left untouched', () => {
        expect(parseStoredTimestamp('2026-08-07T10:30:00Z').toISOString()).toBe('2026-08-07T10:30:00.000Z');
    });

    it('When the value carries a numeric offset (timestamptz) / Then the offset is honoured', () => {
        expect(parseStoredTimestamp('2026-08-07T16:00:00+05:30').toISOString()).toBe('2026-08-07T10:30:00.000Z');
    });

    it('When a Date is passed / Then it is returned as-is', () => {
        const d = new Date('2026-08-07T10:30:00Z');
        expect(parseStoredTimestamp(d)).toBe(d);
    });
});

describe('Given toDatetimeLocalInputValue', () => {
    it('When formatting a stored instant / Then it yields the LOCAL wall clock, not UTC', () => {
        const iso = '2026-08-07T10:30:00Z';
        const out = toDatetimeLocalInputValue(iso);
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        expect(out).toBe(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
        );
    });

    it('When the value round-trips back through inputValueToIso / Then the instant is unchanged', () => {
        const original = '2026-08-07T10:30:00.000Z';
        const roundTripped = inputValueToIso(toDatetimeLocalInputValue(original));
        expect(roundTripped).toBe(original);
    });

    it('When the value is unparseable / Then it yields an empty string rather than "NaN"', () => {
        expect(toDatetimeLocalInputValue('not-a-date')).toBe('');
    });
});

describe('Given toDateInputValue', () => {
    it('When formatting a stored instant / Then it yields the local calendar day', () => {
        const d = new Date('2026-08-07T10:30:00Z');
        const pad = (n: number) => String(n).padStart(2, '0');
        expect(toDateInputValue('2026-08-07T10:30:00Z')).toBe(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        );
    });
});

describe('Given inputValueToIso', () => {
    it('When the input carries a time / Then that local wall clock becomes the stored instant', () => {
        expect(inputValueToIso('2026-08-07T10:30')).toBe(new Date('2026-08-07T10:30:00').toISOString());
    });

    it('When the input is date-only / Then it anchors to LOCAL midnight, not UTC midnight', () => {
        expect(inputValueToIso('2026-08-07')).toBe(new Date('2026-08-07T00:00:00').toISOString());
    });

    it('When the input is date-only / Then the stored instant keeps the day the user picked', () => {
        const stored = inputValueToIso('2026-08-07');
        expect(toDateInputValue(stored)).toBe('2026-08-07');
    });
});

describe('Given hasTimeComponent', () => {
    it('When the instant is midnight UTC / Then it reports no meaningful time', () => {
        expect(hasTimeComponent('2026-08-07T00:00:00Z')).toBe(false);
    });

    it('When the instant carries a time / Then it reports true', () => {
        expect(hasTimeComponent('2026-08-07T10:30:00Z')).toBe(true);
    });

    it('When the value is missing / Then it reports false instead of throwing', () => {
        expect(hasTimeComponent(null)).toBe(false);
        expect(hasTimeComponent(undefined)).toBe(false);
    });
});
