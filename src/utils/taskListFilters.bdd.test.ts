import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TASK_FILTERS,
  TASK_SECTIONS,
  activeFilterValues,
  applyFilterChange,
  bucketOfTask,
  clearTaskFilters,
  groupTasksIntoSections,
  nextSort,
  parseTaskListFilters,
  sectionCount,
  serializeTaskListFilters,
  toTaskListApiParams,
  toggleQuickDue,
  TaskListCounts,
} from './taskListFilters';

const NOW = new Date(2026, 9, 7, 10, 0, 0);
const sp = (q: string) => new URLSearchParams(q);
const task = (over: Record<string, any>): any => ({ id: 'x', title: 'T', status: 'OPEN', due_date: null, ...over });

describe('parseTaskListFilters / serializeTaskListFilters', () => {
  describe('Given an empty URL', () => {
    it('When parsed / Then the defaults apply and serialising yields an empty query', () => {
      expect(parseTaskListFilters(sp(''))).toEqual(DEFAULT_TASK_FILTERS);
      expect(serializeTaskListFilters(DEFAULT_TASK_FILTERS).toString()).toBe('');
    });
  });

  describe('Given a fully populated URL', () => {
    it('When parsed and serialised again / Then it round-trips', () => {
      const url = 'scope=team&q=acme&type=CALL%2CMEETING&priority=HIGH&status=OPEN%2CIN_PROGRESS&due=overdue&assignee=u1&sort=due&order=desc';
      const filters = parseTaskListFilters(sp(url));
      expect(filters).toEqual({
        scope: 'team',
        search: 'acme',
        types: ['CALL', 'MEETING'],
        priorities: ['HIGH'],
        statuses: ['OPEN', 'IN_PROGRESS'],
        due: 'overdue',
        assignee: 'u1',
        sort: 'due',
        order: 'desc',
      });
      expect(serializeTaskListFilters(filters).toString()).toBe(url);
    });
  });

  describe('Given unknown or malformed values', () => {
    it('When parsed / Then they are dropped instead of reaching the API', () => {
      const f = parseTaskListFilters(sp('scope=admin&type=FAX&priority=urgent&status=ON_HOLD&due=someday&sort=assignee_id&order=desc'));
      expect(f).toEqual({ ...DEFAULT_TASK_FILTERS });
    });

    it('When the scope is all and the sort order is missing / Then scope all and ascending apply', () => {
      const f = parseTaskListFilters(sp('scope=all&sort=title'));
      expect(f.scope).toBe('all');
      expect(f.order).toBe('asc');
    });
  });
});

describe('toTaskListApiParams', () => {
  const opts = { page: 2, limit: 25, tzOffsetMinutes: 330 };

  it('Given no filters / When mapped / Then smart sort with paging, scope and timezone only', () => {
    expect(toTaskListApiParams(DEFAULT_TASK_FILTERS, opts)).toEqual({
      scope: 'own',
      page: '2',
      limit: '25',
      tz_offset_minutes: '330',
      sort: 'smart',
    });
  });

  it('Given every filter and a manual sort / When mapped / Then each becomes its API param', () => {
    expect(
      toTaskListApiParams(
        { scope: 'all', search: 'acme', types: ['CALL'], priorities: ['HIGH', 'LOW'], statuses: ['OPEN'], due: 'today', assignee: 'u1', sort: 'priority', order: 'desc' },
        opts,
      ),
    ).toEqual({
      scope: 'all',
      page: '2',
      limit: '25',
      tz_offset_minutes: '330',
      sort: 'priority',
      order: 'desc',
      search: 'acme',
      type: 'CALL',
      priority: 'HIGH,LOW',
      status: 'OPEN',
      due: 'today',
      assignee_id: 'u1',
    });
  });
});

describe('filter chips', () => {
  const filters = { ...DEFAULT_TASK_FILTERS, types: ['CALL'], priorities: ['HIGH'], statuses: ['OPEN'], due: 'today', assignee: 'u1', search: 'x', sort: 'due' as const, order: 'desc' as const, scope: 'team' as const };

  it('Given active filters / When mapped for the filter bar / Then only non-empty entries appear', () => {
    expect(activeFilterValues(filters)).toEqual({ type: ['CALL'], priority: ['HIGH'], status: ['OPEN'], due: 'today', assignee: 'u1' });
    expect(activeFilterValues(DEFAULT_TASK_FILTERS)).toEqual({});
  });

  it('Given a chip is removed / When the filter bar reports null / Then that filter alone is cleared', () => {
    expect(applyFilterChange(filters, 'type', null).types).toEqual([]);
    expect(applyFilterChange(filters, 'priority', null).priorities).toEqual([]);
    expect(applyFilterChange(filters, 'status', null).statuses).toEqual([]);
    expect(applyFilterChange(filters, 'due', null).due).toBe('');
    expect(applyFilterChange(filters, 'assignee', null).assignee).toBe('');
    expect(applyFilterChange(filters, 'type', null).priorities).toEqual(['HIGH']);
  });

  it('Given values are chosen / When the filter bar reports them / Then they are stored', () => {
    expect(applyFilterChange(DEFAULT_TASK_FILTERS, 'type', ['CALL', 'EMAIL']).types).toEqual(['CALL', 'EMAIL']);
    expect(applyFilterChange(DEFAULT_TASK_FILTERS, 'due', 'overdue').due).toBe('overdue');
    expect(applyFilterChange(DEFAULT_TASK_FILTERS, 'unknown', 'x')).toBe(DEFAULT_TASK_FILTERS);
  });

  it('Given Clear all / When applied / Then filters and search reset but the tab and sort stay', () => {
    expect(clearTaskFilters(filters)).toEqual({ ...DEFAULT_TASK_FILTERS, scope: 'team', sort: 'due', order: 'desc' });
  });
});

describe('quick filters and sorting', () => {
  it('Given a counter tile / When clicked twice / Then it switches the due filter on then off', () => {
    const on = toggleQuickDue(DEFAULT_TASK_FILTERS, 'overdue');
    expect(on.due).toBe('overdue');
    expect(toggleQuickDue(on, 'overdue').due).toBe('');
    expect(toggleQuickDue(on, 'today').due).toBe('today');
  });

  it('Given a column header / When clicked repeatedly / Then it cycles asc, desc, then back to smart order', () => {
    const asc = nextSort(DEFAULT_TASK_FILTERS, 'due');
    expect(asc).toMatchObject({ sort: 'due', order: 'asc' });
    const desc = nextSort(asc, 'due');
    expect(desc).toMatchObject({ sort: 'due', order: 'desc' });
    expect(nextSort(desc, 'due')).toMatchObject({ sort: '', order: 'asc' });
    expect(nextSort(desc, 'title')).toMatchObject({ sort: 'title', order: 'asc' });
  });
});

describe('bucketOfTask', () => {
  it.each([
    ['server label wins', task({ list_bucket: 'today', status: 'DONE' }), 'today'],
    ['closed task', task({ status: 'CANCELLED', due_date: '2026-10-01T00:00:00Z' }), 'done'],
    ['no due date', task({}), 'no_due'],
    ['past deadline', task({ due_date: '2026-10-01T00:00:00Z' }), 'overdue'],
    ['due today (date-only)', task({ due_date: '2026-10-07T00:00:00Z' }), 'today'],
    ['due later', task({ due_date: '2026-10-20T00:00:00Z' }), 'upcoming'],
  ])('Given %s / When bucketed / Then it lands in %s', (_n, t, bucket) => {
    expect(bucketOfTask(t, NOW)).toBe(bucket);
  });

  it('Given no clock is passed / When bucketed / Then the current time is used', () => {
    expect(bucketOfTask(task({ due_date: '2001-01-01T00:00:00Z' }))).toBe('overdue');
  });
});

describe('sections', () => {
  const counts: TaskListCounts = { overdue: 2, today: 1, next_7_days: 4, no_due_date: 3, done: 5, total: 20 };

  it('Given server counts / When sized / Then upcoming is the remainder and never negative', () => {
    expect(sectionCount('overdue', counts)).toBe(2);
    expect(sectionCount('today', counts)).toBe(1);
    expect(sectionCount('no_due', counts)).toBe(3);
    expect(sectionCount('done', counts)).toBe(5);
    expect(sectionCount('upcoming', counts)).toBe(9);
    expect(sectionCount('upcoming', { ...counts, total: 1 })).toBe(0);
  });

  it('Given loaded tasks / When grouped / Then the five sections come back in smart order with their tasks', () => {
    const tasks = [
      task({ id: 'd', status: 'DONE' }),
      task({ id: 'o', list_bucket: 'overdue' }),
      task({ id: 'n' }),
      task({ id: 'u', due_date: '2026-10-20T00:00:00Z' }),
    ];
    const sections = groupTasksIntoSections(tasks, counts, NOW);
    expect(sections.map(s => s.bucket)).toEqual(TASK_SECTIONS.map(s => s.bucket));
    expect(sections.map(s => s.tasks.map(t => t.id))).toEqual([['o'], [], ['u'], ['n'], ['d']]);
    expect(sections[0].count).toBe(2);
  });

  it('Given no clock / When grouped / Then the current time is used', () => {
    expect(groupTasksIntoSections([], counts)).toHaveLength(5);
  });
});
