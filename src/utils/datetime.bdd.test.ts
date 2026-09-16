import { describe, it, expect } from 'vitest';
import {
    parseStoredTimestamp,
    toDatetimeLocalInputValue,
    toDateInputValue,
    inputValueToIso,
    inputValueToApiValue,
    localOffsetSuffix,
    dueDateCalendarDay,
    splitStoredDueDate,
    composeDueDate,
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

/**
 * Root-cause cover for "Due date cannot be in the past" on a date the user
 * picked as today.
 *
 * `new Date('2026-08-13T00:00:00').toISOString()` is `2026-08-12T18:30:00.000Z`
 * east of Greenwich — the calendar day silently rolls back, and the server then
 * reads the wrong day off the value. Nothing sent to the API may lose the day
 * the user actually saw.
 */
describe('Given a picked date is prepared for the API', () => {
    it('Given a date with no time / Then it travels as a bare calendar date, with no instant to misread', () => {
        expect(inputValueToApiValue('2026-08-13')).toBe('2026-08-13');
    });

    it('Given a date with a time / Then the wall clock survives and the value states its zone', () => {
        const sent = inputValueToApiValue('2026-08-13T14:30');
        expect(sent.startsWith('2026-08-13T14:30:00')).toBe(true);
        expect(sent).toMatch(/[+-]\d{2}:\d{2}$/);
        // Same instant as the local wall clock the user chose.
        expect(new Date(sent).getTime()).toBe(new Date('2026-08-13T14:30:00').getTime());
    });

    it('Given the old helper / Then it still normalises to UTC — which is exactly what lost the day', () => {
        // Kept as the contrast the fix exists to avoid.
        expect(inputValueToIso('2026-08-13')).toBe(new Date('2026-08-13T00:00:00').toISOString());
    });

    it('Given an empty value / Then nothing is fabricated', () => {
        expect(inputValueToApiValue('')).toBe('');
        expect(composeDueDate('', '09:00')).toBe('');
    });
});

describe('Given localOffsetSuffix', () => {
    it('When called / Then it reports the browser offset in ±HH:MM form', () => {
        expect(localOffsetSuffix()).toMatch(/^[+-]\d{2}:\d{2}$/);
    });

    it('Given a zone 330 minutes east of UTC / Then it reads +05:30', () => {
        const ist = { getTimezoneOffset: () => -330 } as Date;
        expect(localOffsetSuffix(ist)).toBe('+05:30');
    });

    it('Given a zone 480 minutes west of UTC / Then it reads -08:00', () => {
        const pacific = { getTimezoneOffset: () => 480 } as Date;
        expect(localOffsetSuffix(pacific)).toBe('-08:00');
    });
});

describe('Given a stored due date is read back', () => {
    it('Given a date-only task (UTC midnight) / Then its day is read in UTC, so it cannot slip backwards', () => {
        // Rendered in a negative-offset zone this instant is the previous
        // evening; the calendar day the user picked is the UTC one.
        expect(dueDateCalendarDay('2026-08-13T00:00:00.000Z')).toBe('2026-08-13');
    });

    it('Given a date-only task / Then it splits into a date with no time', () => {
        expect(splitStoredDueDate('2026-08-13T00:00:00.000Z')).toEqual({ date: '2026-08-13', time: '' });
    });

    it('Given a timed task / Then it splits into the local date and wall clock it was saved with', () => {
        const saved = new Date('2026-08-13T14:30:00').toISOString();
        expect(splitStoredDueDate(saved)).toEqual({ date: '2026-08-13', time: '14:30' });
    });

    it('Given nothing stored / Then both halves come back empty', () => {
        expect(splitStoredDueDate(null)).toEqual({ date: '', time: '' });
        expect(splitStoredDueDate(undefined)).toEqual({ date: '', time: '' });
    });

    it('Given a split value / When recomposed / Then it round-trips to the same instant', () => {
        const saved = new Date('2026-08-13T14:30:00').toISOString();
        const { date, time } = splitStoredDueDate(saved);
        expect(new Date(composeDueDate(date, time)).toISOString()).toBe(saved);
    });

    it('Given a date-only value / When recomposed / Then it stays date-only', () => {
        const { date, time } = splitStoredDueDate('2026-08-13T00:00:00.000Z');
        expect(composeDueDate(date, time)).toBe('2026-08-13');
    });
});
