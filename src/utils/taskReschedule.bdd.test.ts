import { describe, it, expect } from 'vitest';
import { addCalendarDays, rescheduleDueDate } from './taskReschedule';

// Wednesday 7 Oct 2026, 10:00 in the machine's own zone (tests must not depend on it).
const NOW = new Date(2026, 9, 7, 10, 0, 0);
const at = (iso: string) => new Date(iso).getTime();

describe('addCalendarDays', () => {
    it.each([
        ['2026-10-07', 1, '2026-10-08'],
        ['2026-10-31', 1, '2026-11-01'],
        ['2026-12-31', 1, '2027-01-01'],
        ['2026-03-01', -1, '2026-02-28'],
        ['2028-02-28', 1, '2028-02-29'],
        ['2026-10-07', 0, '2026-10-07'],
    ])('Given %s / When %i days are added / Then it is %s', (day, n, expected) => {
        expect(addCalendarDays(day, n)).toBe(expected);
    });
});

describe('rescheduleDueDate', () => {
    describe('Given a call booked for a time of day (Wed 7 Oct 4:30 PM)', () => {
        const task = { due_date: new Date(2026, 9, 7, 16, 30).toISOString() };

        it('When +1 day / Then it moves to the next day, same time', () => {
            expect(at(rescheduleDueDate(task, { kind: 'plus_one_day' }, NOW))).toBe(new Date(2026, 9, 8, 16, 30).getTime());
        });

        it('When Tomorrow / Then it is the viewer\'s tomorrow, same time', () => {
            expect(at(rescheduleDueDate(task, { kind: 'tomorrow' }, NOW))).toBe(new Date(2026, 9, 8, 16, 30).getTime());
        });

        it('When a date is picked / Then that day, same time', () => {
            expect(at(rescheduleDueDate(task, { kind: 'date', date: '2026-10-20' }, NOW))).toBe(new Date(2026, 9, 20, 16, 30).getTime());
        });
    });

    describe('Given a task due on a day with no time (stored at UTC midnight)', () => {
        const task = { due_date: '2026-10-05T00:00:00.000Z' };

        it('When +1 day / Then it stays date-only and moves one calendar day', () => {
            expect(rescheduleDueDate(task, { kind: 'plus_one_day' }, NOW)).toBe('2026-10-06');
        });

        it('When Tomorrow / Then it is tomorrow\'s date, still date-only', () => {
            expect(rescheduleDueDate(task, { kind: 'tomorrow' }, NOW)).toBe('2026-10-08');
        });

        it('When a date is picked / Then no time of day is invented', () => {
            expect(rescheduleDueDate(task, { kind: 'date', date: '2026-10-20' }, NOW)).toBe('2026-10-20');
        });
    });

    describe('Given an overdue task', () => {
        it('When +1 day / Then it moves one day from its own date (it can stay overdue), while Tomorrow brings it forward', () => {
            const task = { due_date: '2026-10-03T00:00:00.000Z' };
            expect(rescheduleDueDate(task, { kind: 'plus_one_day' }, NOW)).toBe('2026-10-04');
            expect(rescheduleDueDate(task, { kind: 'tomorrow' }, NOW)).toBe('2026-10-08');
        });
    });

    describe('Given a task without a due date', () => {
        it('When +1 day / Then it counts from today', () => {
            expect(rescheduleDueDate({ due_date: null }, { kind: 'plus_one_day' }, NOW)).toBe('2026-10-08');
            expect(rescheduleDueDate({}, { kind: 'plus_one_day' }, NOW)).toBe('2026-10-08');
        });
    });
});
