import { describe, it, expect } from 'vitest';
import { describeTaskDue } from './taskDueLabel';

// Wed 7 Oct 2026, 10:00 local time.
const NOW = new Date(2026, 9, 7, 10, 0, 0);
const fmt = {
  formatDay: (d: string) => `day:${d}`,
  formatTime: () => '4:05 PM',
};

/** A task with a chosen time: a real instant on the given local day. */
const timed = (dayOffset: number, hour = 16, minute = 5) =>
  new Date(2026, 9, 7 + dayOffset, hour, minute, 0).toISOString();
/** A date-only task is stored at UTC midnight of its calendar day. */
const dateOnly = (day: string) => `${day}T00:00:00.000Z`;

describe('describeTaskDue', () => {
  describe('Given a task without a due date', () => {
    it('When described / Then it says so and has no tone', () => {
      expect(describeTaskDue({ due_date: null, status: 'OPEN' }, NOW, fmt)).toEqual({
        label: 'No due date',
        title: 'No due date',
        tone: 'none',
        overdueDays: null,
      });
    });
  });

  describe('Given an open task due later today', () => {
    it('When it has a time / Then the label is "Today <time>" on one line and the title has the full date', () => {
      const d = describeTaskDue({ due_date: timed(0), status: 'OPEN' }, NOW, fmt);
      expect(d.label).toBe('Today 4:05 PM');
      expect(d.title).toBe('day:2026-10-07 4:05 PM');
      expect(d.tone).toBe('today');
    });

    it('When it is date-only / Then the label is just "Today" and no time is invented', () => {
      const d = describeTaskDue({ due_date: dateOnly('2026-10-07'), status: 'OPEN' }, NOW, fmt);
      expect(d.label).toBe('Today');
      expect(d.title).toBe('day:2026-10-07');
      expect(d.tone).toBe('today');
    });
  });

  describe('Given an open task due tomorrow or later', () => {
    it('When due tomorrow with a time / Then "Tomorrow <time>"', () => {
      expect(describeTaskDue({ due_date: timed(1), status: 'IN_PROGRESS' }, NOW, fmt).label).toBe('Tomorrow 4:05 PM');
    });

    it('When due tomorrow and date-only / Then "Tomorrow"', () => {
      expect(describeTaskDue({ due_date: dateOnly('2026-10-08'), status: 'OPEN' }, NOW, fmt).label).toBe('Tomorrow');
    });

    it('When due next week / Then the formatted date with tone upcoming', () => {
      const d = describeTaskDue({ due_date: dateOnly('2026-10-14'), status: 'OPEN' }, NOW, fmt);
      expect(d.label).toBe('day:2026-10-14');
      expect(d.tone).toBe('upcoming');
      expect(d.overdueDays).toBeNull();
    });
  });

  describe('Given an overdue open task (client-side rule)', () => {
    it('When two days late / Then "2 days overdue"', () => {
      const d = describeTaskDue({ due_date: dateOnly('2026-10-05'), status: 'OPEN' }, NOW, fmt);
      expect(d).toMatchObject({ label: '2 days overdue', tone: 'overdue', overdueDays: 2, title: 'day:2026-10-05' });
    });

    it('When one day late / Then the singular "1 day overdue"', () => {
      expect(describeTaskDue({ due_date: dateOnly('2026-10-06'), status: 'OPEN' }, NOW, fmt).label).toBe('1 day overdue');
    });

    it('When the time passed earlier today / Then "Overdue today <time>"', () => {
      const d = describeTaskDue({ due_date: timed(0, 8, 30), status: 'OPEN' }, NOW, fmt);
      expect(d.label).toBe('Overdue today 4:05 PM');
      expect(d.overdueDays).toBe(0);
    });
  });

  describe('Given the server already bucketed the task', () => {
    it('When the bucket is overdue but the day is still today / Then it follows the server ("Overdue today")', () => {
      const d = describeTaskDue({ due_date: dateOnly('2026-10-07'), status: 'OPEN' }, NOW, fmt, 'overdue');
      expect(d.label).toBe('Overdue today');
      expect(d.tone).toBe('overdue');
    });

    it('When the bucket is not overdue even though the client would say so / Then it follows the server', () => {
      const d = describeTaskDue({ due_date: dateOnly('2026-10-05'), status: 'OPEN' }, NOW, fmt, 'today');
      expect(d.tone).toBe('upcoming');
      expect(d.label).toBe('day:2026-10-05');
    });
  });

  describe('Given a finished task', () => {
    it('When it is DONE and past due / Then it is never shown as overdue', () => {
      const d = describeTaskDue({ due_date: timed(-3), status: 'DONE' }, NOW, fmt, 'done');
      expect(d.tone).toBe('done');
      expect(d.label).toBe('day:2026-10-04 4:05 PM');
      expect(d.overdueDays).toBeNull();
    });

    it('When it is CANCELLED and date-only / Then just the date', () => {
      const d = describeTaskDue({ due_date: dateOnly('2026-10-01'), status: 'CANCELLED' }, NOW, fmt);
      expect(d.label).toBe('day:2026-10-01');
      expect(d.tone).toBe('done');
    });
  });
});
