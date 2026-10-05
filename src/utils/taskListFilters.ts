import { Task } from '../types/crm';
import { isTaskLocked, isTaskOverdue } from './taskUtils';
import { dueDateCalendarDay, toDateInputValue } from './datetime';

export type TaskScopeTab = 'own' | 'team' | 'all';
export type TaskBucket = 'overdue' | 'today' | 'upcoming' | 'no_due' | 'done';
export type TaskSortField = 'title' | 'due' | 'priority';
export type TaskSortOrder = 'asc' | 'desc';

export interface TaskListFilters {
    scope: TaskScopeTab;
    search: string;
    types: string[];
    priorities: string[];
    statuses: string[];
    due: string;
    assignee: string;
    /** Empty = the server's smart order. */
    sort: TaskSortField | '';
    order: TaskSortOrder;
}

export interface TaskListCounts {
    overdue: number;
    today: number;
    next_7_days: number;
    no_due_date: number;
    done: number;
    total: number;
}

export const EMPTY_COUNTS: TaskListCounts = {
    overdue: 0,
    today: 0,
    next_7_days: 0,
    no_due_date: 0,
    done: 0,
    total: 0,
};

export const DEFAULT_TASK_FILTERS: TaskListFilters = {
    scope: 'own',
    search: '',
    types: [],
    priorities: [],
    statuses: [],
    due: '',
    assignee: '',
    sort: '',
    order: 'asc',
};

export const TASK_PAGE_SIZE = 25;

// ON_HOLD is deliberately absent: the tasks status CHECK rejects it, so
// filtering by it could only ever 400.
export const TASK_STATUS_FILTER_OPTIONS = [
    { value: 'OPEN', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DONE', label: 'Done' },
    { value: 'CANCELLED', label: 'Cancelled' },
];

export const TASK_TYPE_FILTER_OPTIONS = [
    { value: 'CALL', label: 'Call' },
    { value: 'MEETING', label: 'Meeting' },
    { value: 'EMAIL', label: 'Email' },
    { value: 'TODO', label: 'To-do' },
    { value: 'REMINDER', label: 'Reminder' },
];

export const TASK_PRIORITY_FILTER_OPTIONS = [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
];

export const TASK_DUE_FILTER_OPTIONS = [
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Today' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'next_7_days', label: 'Next 7 days' },
    { value: 'this_week', label: 'This week' },
    { value: 'this_month', label: 'This month' },
    { value: 'no_due_date', label: 'No due date' },
    { value: 'done', label: 'Done' },
];

/** The counter strip: each tile is a one-click `due` preset. */
export const TASK_COUNTER_TILES: { due: string; label: string; countKey: keyof TaskListCounts }[] = [
    { due: 'overdue', label: 'Overdue', countKey: 'overdue' },
    { due: 'today', label: 'Today', countKey: 'today' },
    { due: 'next_7_days', label: 'Next 7 days', countKey: 'next_7_days' },
    { due: 'no_due_date', label: 'No due date', countKey: 'no_due_date' },
    { due: 'done', label: 'Done', countKey: 'done' },
];

export const TASK_SECTIONS: { bucket: TaskBucket; label: string; empty: string }[] = [
    { bucket: 'overdue', label: 'Overdue', empty: 'Nothing overdue. Nice work.' },
    { bucket: 'today', label: 'Today', empty: 'Nothing due today.' },
    { bucket: 'upcoming', label: 'Upcoming', empty: 'No upcoming tasks.' },
    { bucket: 'no_due', label: 'No due date', empty: 'Every open task has a due date.' },
    { bucket: 'done', label: 'Done', empty: 'No completed tasks yet.' },
];

const SORT_FIELDS: string[] = ['title', 'due', 'priority'];
const DUE_VALUES = TASK_DUE_FILTER_OPTIONS.map(o => o.value);
const STATUS_VALUES = TASK_STATUS_FILTER_OPTIONS.map(o => o.value);
const TYPE_VALUES = TASK_TYPE_FILTER_OPTIONS.map(o => o.value);
const PRIORITY_VALUES = TASK_PRIORITY_FILTER_OPTIONS.map(o => o.value);

const listParam = (sp: URLSearchParams, key: string, allowed: string[]): string[] =>
    (sp.get(key) ?? '')
        .split(',')
        .map(v => v.trim().toUpperCase())
        .filter(v => allowed.includes(v));

/** Reads the filter state out of the URL; unknown or malformed values are ignored. */
export function parseTaskListFilters(sp: URLSearchParams): TaskListFilters {
    const scope = sp.get('scope');
    const due = sp.get('due') ?? '';
    const sort = sp.get('sort') ?? '';
    const validSort = SORT_FIELDS.includes(sort);
    return {
        scope: scope === 'team' || scope === 'all' ? scope : 'own',
        search: sp.get('q') ?? '',
        types: listParam(sp, 'type', TYPE_VALUES),
        priorities: listParam(sp, 'priority', PRIORITY_VALUES),
        statuses: listParam(sp, 'status', STATUS_VALUES),
        due: DUE_VALUES.includes(due) ? due : '',
        assignee: sp.get('assignee') ?? '',
        sort: validSort ? (sort as TaskSortField) : '',
        order: validSort && sp.get('order') === 'desc' ? 'desc' : 'asc',
    };
}

/** Inverse of {@link parseTaskListFilters}; defaults are omitted to keep URLs short. */
export function serializeTaskListFilters(f: TaskListFilters): URLSearchParams {
    const sp = new URLSearchParams();
    if (f.scope !== 'own') sp.set('scope', f.scope);
    if (f.search) sp.set('q', f.search);
    if (f.types.length) sp.set('type', f.types.join(','));
    if (f.priorities.length) sp.set('priority', f.priorities.join(','));
    if (f.statuses.length) sp.set('status', f.statuses.join(','));
    if (f.due) sp.set('due', f.due);
    if (f.assignee) sp.set('assignee', f.assignee);
    if (f.sort) {
        sp.set('sort', f.sort);
        sp.set('order', f.order);
    }
    return sp;
}

/** Query params for GET /tasks/list. */
export function toTaskListApiParams(
    f: TaskListFilters,
    opts: { page: number; limit: number; tzOffsetMinutes: number },
): Record<string, string> {
    const params: Record<string, string> = {
        scope: f.scope,
        page: String(opts.page),
        limit: String(opts.limit),
        tz_offset_minutes: String(opts.tzOffsetMinutes),
        sort: f.sort || 'smart',
    };
    if (f.sort) params.order = f.order;
    if (f.search) params.search = f.search;
    if (f.types.length) params.type = f.types.join(',');
    if (f.priorities.length) params.priority = f.priorities.join(',');
    if (f.statuses.length) params.status = f.statuses.join(',');
    if (f.due) params.due = f.due;
    if (f.assignee) params.assignee_id = f.assignee;
    return params;
}

/** The FilterBar's view of the state (only non-empty entries). */
export function activeFilterValues(f: TaskListFilters): Record<string, string | string[]> {
    const active: Record<string, string | string[]> = {};
    if (f.types.length) active.type = f.types;
    if (f.priorities.length) active.priority = f.priorities;
    if (f.statuses.length) active.status = f.statuses;
    if (f.due) active.due = f.due;
    if (f.assignee) active.assignee = f.assignee;
    return active;
}

/** Applies one FilterBar change (value `null` removes the chip). */
export function applyFilterChange(
    f: TaskListFilters,
    key: string,
    value: string | string[] | null,
): TaskListFilters {
    const list = Array.isArray(value) ? value : [];
    const text = typeof value === 'string' ? value : '';
    switch (key) {
        case 'type': return { ...f, types: list };
        case 'priority': return { ...f, priorities: list };
        case 'status': return { ...f, statuses: list };
        case 'due': return { ...f, due: text };
        case 'assignee': return { ...f, assignee: text };
        default: return f;
    }
}

/** Clear all: drops every filter and the search but keeps the tab and the sort. */
export function clearTaskFilters(f: TaskListFilters): TaskListFilters {
    return { ...DEFAULT_TASK_FILTERS, scope: f.scope, sort: f.sort, order: f.order };
}

/** Clicking an active counter tile switches the quick filter back off. */
export function toggleQuickDue(f: TaskListFilters, due: string): TaskListFilters {
    return { ...f, due: f.due === due ? '' : due };
}

/** none -> asc -> desc -> none (back to smart order) for a clicked column. */
export function nextSort(f: TaskListFilters, field: TaskSortField): TaskListFilters {
    if (f.sort !== field) return { ...f, sort: field, order: 'asc' };
    if (f.order === 'asc') return { ...f, order: 'desc' };
    return { ...f, sort: '', order: 'asc' };
}

/**
 * Bucket of a task when the server did not label it (e.g. right after an
 * optimistic edit). Mirrors the server's smart-order sections.
 */
export function bucketOfTask(task: Task, now: Date = new Date()): TaskBucket {
    if (task.list_bucket) return task.list_bucket;
    if (isTaskLocked(task.status)) return 'done';
    if (!task.due_date) return 'no_due';
    if (isTaskOverdue(task, now)) return 'overdue';
    return dueDateCalendarDay(task.due_date) === toDateInputValue(now) ? 'today' : 'upcoming';
}

export interface TaskSectionData {
    bucket: TaskBucket;
    label: string;
    empty: string;
    count: number;
    tasks: Task[];
}

/** Section sizes come from the server counts, so they stay right while only some pages are loaded. */
export function sectionCount(bucket: TaskBucket, c: TaskListCounts): number {
    switch (bucket) {
        case 'overdue': return c.overdue;
        case 'today': return c.today;
        case 'no_due': return c.no_due_date;
        case 'done': return c.done;
        default: return Math.max(0, c.total - c.overdue - c.today - c.no_due_date - c.done);
    }
}

/** Groups loaded tasks into the five smart-order sections, in order. */
export function groupTasksIntoSections(
    tasks: Task[],
    counts: TaskListCounts,
    now: Date = new Date(),
): TaskSectionData[] {
    return TASK_SECTIONS.map(s => ({
        ...s,
        count: sectionCount(s.bucket, counts),
        tasks: tasks.filter(t => bucketOfTask(t, now) === s.bucket),
    }));
}
