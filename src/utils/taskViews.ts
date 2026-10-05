import {
    DEFAULT_TASK_FILTERS,
    TaskListFilters,
    parseTaskListFilters,
    serializeTaskListFilters,
} from './taskListFilters';

/** crm_grid_views.entity_type for the Tasks page. The column is free text, so no migration is needed. */
export const TASK_VIEW_ENTITY = 'task';
export const TASK_VIEW_CONFIG_VERSION = 1;

/**
 * What a saved view stores in crm_grid_views.config: the filter state as the
 * same query string the Tasks page keeps in its URL (minus the My/Team/All
 * tab, which is the user's current context, not part of a view). Reading it
 * back goes through parseTaskListFilters, so unknown or tampered values are
 * dropped. A view is only a set of filters: the backend still clamps every
 * request to the caller's visibility scope, so applying one can never show
 * more than the caller may already see.
 */
export interface TaskViewConfig {
    version: number;
    query: string;
}

export interface SystemTaskView {
    id: string;
    name: string;
    filters: Partial<TaskListFilters>;
}

const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS'];

/**
 * Built-in views. They are code, not rows: always there, nobody can edit or
 * delete them. DECISION: "Upcoming calls" means open calls due in the next 7
 * days (meetings are not included).
 */
export function systemTaskViews(currentUserId?: string): SystemTaskView[] {
    const views: SystemTaskView[] = [
        { id: 'system:overdue', name: 'Overdue', filters: { due: 'overdue' } },
        { id: 'system:today', name: 'Today', filters: { due: 'today' } },
        {
            id: 'system:upcoming-calls',
            name: 'Upcoming calls',
            filters: { types: ['CALL'], due: 'next_7_days' },
        },
        {
            id: 'system:high-priority',
            name: 'High priority',
            filters: { priorities: ['HIGH', 'CRITICAL'], statuses: OPEN_STATUSES },
        },
    ];
    if (currentUserId) {
        views.push({
            id: 'system:assigned-to-me',
            name: 'Assigned to me',
            filters: { assignee: currentUserId, statuses: OPEN_STATUSES },
        });
    }
    views.push({
        id: 'system:with-reminders',
        name: 'With reminders',
        filters: { hasReminder: true, statuses: OPEN_STATUSES },
    });
    return views;
}

/** The filters a view applies on top of a clean slate, keeping the user's current tab. */
export function filtersForView(
    view: SystemTaskView,
    scope: TaskListFilters['scope'],
): TaskListFilters {
    return { ...DEFAULT_TASK_FILTERS, ...view.filters, scope };
}

export function toViewConfig(filters: TaskListFilters): TaskViewConfig {
    // scope 'own' is the default, so serialize leaves the tab out of the query.
    return {
        version: TASK_VIEW_CONFIG_VERSION,
        query: serializeTaskListFilters({ ...filters, scope: 'own' }).toString(),
    };
}

/** Reads a stored config back; anything malformed yields the empty filter set. */
export function filtersFromViewConfig(
    config: unknown,
    scope: TaskListFilters['scope'],
): TaskListFilters {
    const query = (config as Partial<TaskViewConfig> | null | undefined)?.query;
    const parsed = parseTaskListFilters(new URLSearchParams(typeof query === 'string' ? query : ''));
    return { ...parsed, scope };
}

const sameList = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** Do two filter states select the same tasks (tab ignored)? */
export function sameFilters(a: TaskListFilters, b: TaskListFilters): boolean {
    return (
        a.search === b.search &&
        a.due === b.due &&
        a.assignee === b.assignee &&
        a.hasReminder === b.hasReminder &&
        a.sort === b.sort &&
        (a.sort === '' || a.order === b.order) &&
        sameList(a.types, b.types) &&
        sameList(a.priorities, b.priorities) &&
        sameList(a.statuses, b.statuses)
    );
}

/** True when nothing but (maybe) the tab differs from a fresh page. */
export function hasNoFilters(f: TaskListFilters): boolean {
    return sameFilters(f, DEFAULT_TASK_FILTERS);
}
