import { describe, it, expect } from 'vitest';
import {
    DASHBOARD_REMINDER_FILTERS,
    DASHBOARD_REMINDER_LIMIT,
    DEFAULT_TASK_FILTERS,
    TASK_REMINDER_FILTER_OPTIONS,
    activeFilterValues,
    applyFilterChange,
    parseTaskListFilters,
    serializeTaskListFilters,
    taskReminderAt,
    toTaskListApiParams,
} from './taskListFilters';

const OPTS = { page: 1, limit: 10, tzOffsetMinutes: 0 };

describe('Tasks filters - reminders', () => {
    describe('Given the reminder filter in the URL', () => {
        it('When reminder=1 / Then hasReminder is on; anything else is off', () => {
            expect(parseTaskListFilters(new URLSearchParams('reminder=1')).hasReminder).toBe(true);
            expect(parseTaskListFilters(new URLSearchParams('reminder=0')).hasReminder).toBe(false);
            expect(parseTaskListFilters(new URLSearchParams('')).hasReminder).toBe(false);
        });

        it('When serialised and parsed again / Then the state round-trips and the default adds nothing', () => {
            const on = { ...DEFAULT_TASK_FILTERS, hasReminder: true };
            expect(serializeTaskListFilters(on).toString()).toBe('reminder=1');
            expect(parseTaskListFilters(serializeTaskListFilters(on))).toEqual(on);
            expect(serializeTaskListFilters(DEFAULT_TASK_FILTERS).toString()).toBe('');
        });
    });

    describe('Given the filter bar', () => {
        it('When the reminders option is chosen and removed / Then hasReminder follows and the chip is shown only while on', () => {
            const on = applyFilterChange(DEFAULT_TASK_FILTERS, 'reminder', TASK_REMINDER_FILTER_OPTIONS[0].value);
            expect(on.hasReminder).toBe(true);
            expect(activeFilterValues(on)).toEqual({ reminder: '1' });
            const off = applyFilterChange(on, 'reminder', null);
            expect(off.hasReminder).toBe(false);
            expect(activeFilterValues(off)).toEqual({});
        });
    });

    describe('Given the list request', () => {
        it('When hasReminder is on / Then has_reminder=true is sent; otherwise it is omitted', () => {
            expect(toTaskListApiParams({ ...DEFAULT_TASK_FILTERS, hasReminder: true }, OPTS).has_reminder).toBe('true');
            expect(toTaskListApiParams(DEFAULT_TASK_FILTERS, OPTS)).not.toHaveProperty('has_reminder');
        });
    });

    describe('Given the Dashboard reminder strip', () => {
        it('When its filter is turned into a request and a link / Then both describe the same open reminder tasks', () => {
            const params = toTaskListApiParams(DASHBOARD_REMINDER_FILTERS, { ...OPTS, limit: DASHBOARD_REMINDER_LIMIT });
            expect(params).toMatchObject({ has_reminder: 'true', status: 'OPEN,IN_PROGRESS', sort: 'smart', limit: '10' });
            const link = parseTaskListFilters(serializeTaskListFilters(DASHBOARD_REMINDER_FILTERS));
            expect(toTaskListApiParams(link, { ...OPTS, limit: DASHBOARD_REMINDER_LIMIT })).toEqual(params);
        });
    });
});

describe('taskReminderAt (server rule: reminder_at wins, else due - offset)', () => {
    const DUE = '2026-11-10T10:00:00.000Z';
    it('Given an absolute reminder_at and an offset / When resolved / Then reminder_at wins', () => {
        expect(taskReminderAt({ due_date: DUE, reminder_at: '2026-11-09T08:00:00.000Z', reminder_offset_minutes: 30 }))
            .toBe('2026-11-09T08:00:00.000Z');
    });
    it('Given only an offset / When resolved / Then it is due minus the offset', () => {
        expect(taskReminderAt({ due_date: DUE, reminder_at: null, reminder_offset_minutes: 30 })).toBe('2026-11-10T09:30:00.000Z');
    });
    it('Given an offset of 0 / When resolved / Then it rings at the due time', () => {
        expect(taskReminderAt({ due_date: DUE, reminder_offset_minutes: 0 })).toBe(DUE);
    });
    it('Given neither field / When resolved / Then null (org default is server-side)', () => {
        expect(taskReminderAt({ due_date: DUE })).toBeNull();
    });
    it('Given an offset but no due date / When resolved / Then null', () => {
        expect(taskReminderAt({ due_date: undefined as any, reminder_offset_minutes: 15 })).toBeNull();
    });
    it('Given an offset and an unparseable due date / When resolved / Then null', () => {
        expect(taskReminderAt({ due_date: 'not-a-date', reminder_offset_minutes: 15 })).toBeNull();
    });
});
