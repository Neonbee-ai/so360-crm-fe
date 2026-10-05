import { describe, it, expect } from 'vitest';
import {
    TASK_VIEW_CONFIG_VERSION,
    TASK_VIEW_ENTITY,
    filtersForView,
    filtersFromViewConfig,
    hasNoFilters,
    sameFilters,
    systemTaskViews,
    toViewConfig,
} from './taskViews';
import { DEFAULT_TASK_FILTERS, TaskListFilters } from './taskListFilters';

const f = (over: Partial<TaskListFilters> = {}): TaskListFilters => ({ ...DEFAULT_TASK_FILTERS, ...over });

describe('taskViews - built-in views', () => {
    describe('Given a signed-in user', () => {
        it('When the built-in views are listed / Then Overdue, Today, Upcoming calls, High priority, Assigned to me and With reminders exist in that order', () => {
            expect(systemTaskViews('user-1').map(v => v.name)).toEqual([
                'Overdue',
                'Today',
                'Upcoming calls',
                'High priority',
                'Assigned to me',
                'With reminders',
            ]);
        });

        it('When Assigned to me is applied / Then it filters on that user and open statuses', () => {
            const view = systemTaskViews('user-1').find(v => v.name === 'Assigned to me')!;
            expect(filtersForView(view, 'own')).toEqual(f({ assignee: 'user-1', statuses: ['OPEN', 'IN_PROGRESS'] }));
        });
    });

    describe('Given the user id is not known yet', () => {
        it('When the built-in views are listed / Then Assigned to me is left out', () => {
            expect(systemTaskViews().map(v => v.name)).not.toContain('Assigned to me');
            expect(systemTaskViews()).toHaveLength(5);
        });
    });

    describe('Given each built-in view', () => {
        const byName = (name: string) => systemTaskViews('u').find(v => v.name === name)!;

        it('When applied / Then it selects exactly its documented filters on a clean slate', () => {
            expect(filtersForView(byName('Overdue'), 'own')).toEqual(f({ due: 'overdue' }));
            expect(filtersForView(byName('Today'), 'own')).toEqual(f({ due: 'today' }));
            expect(filtersForView(byName('Upcoming calls'), 'own')).toEqual(f({ types: ['CALL'], due: 'next_7_days' }));
            expect(filtersForView(byName('High priority'), 'own')).toEqual(
                f({ priorities: ['HIGH', 'CRITICAL'], statuses: ['OPEN', 'IN_PROGRESS'] }),
            );
            expect(filtersForView(byName('With reminders'), 'own')).toEqual(
                f({ hasReminder: true, statuses: ['OPEN', 'IN_PROGRESS'] }),
            );
        });

        it('When applied on the Team tab / Then the tab is kept and old filters and search are dropped', () => {
            const next = filtersForView(byName('Overdue'), 'team');
            expect(next.scope).toBe('team');
            expect(next.search).toBe('');
            expect(next.priorities).toEqual([]);
        });
    });
});

describe('taskViews - saved view config', () => {
    describe('Given a filter state', () => {
        it('When stored and read back / Then the filters survive, minus the tab which comes from the page', () => {
            const filters = f({
                scope: 'all',
                search: 'acme',
                types: ['CALL', 'MEETING'],
                priorities: ['HIGH'],
                statuses: ['OPEN'],
                due: 'next_7_days',
                assignee: 'user-2',
                hasReminder: true,
                sort: 'due',
                order: 'desc',
            });
            const config = toViewConfig(filters);
            expect(config.version).toBe(TASK_VIEW_CONFIG_VERSION);
            expect(config.query).not.toContain('scope');
            expect(filtersFromViewConfig(config, 'team')).toEqual({ ...filters, scope: 'team' });
        });

        it('When the config is malformed / Then it reads as no filters', () => {
            expect(filtersFromViewConfig(null, 'own')).toEqual(f());
            expect(filtersFromViewConfig({ query: 42 }, 'own')).toEqual(f());
            expect(filtersFromViewConfig('nonsense', 'own')).toEqual(f());
        });

        it('When the stored query carries unknown or hostile values / Then they are dropped', () => {
            const read = filtersFromViewConfig({ version: 1, query: 'type=FAX,CALL&due=whenever&scope=all&sort=drop%20table' }, 'own');
            expect(read.types).toEqual(['CALL']);
            expect(read.due).toBe('');
            expect(read.sort).toBe('');
            // a stored scope can never override the tab the user is on
            expect(read.scope).toBe('own');
        });
    });

    it('Given the shared entity key / Then saved task views live under entity_type "task"', () => {
        expect(TASK_VIEW_ENTITY).toBe('task');
    });
});

describe('taskViews - comparing filters', () => {
    it('Given the same filters in a different order / When compared / Then they match', () => {
        expect(sameFilters(f({ types: ['CALL', 'EMAIL'] }), f({ types: ['EMAIL', 'CALL'] }))).toBe(true);
    });

    it('Given the tab differs / When compared / Then it is ignored', () => {
        expect(sameFilters(f({ scope: 'team' }), f({ scope: 'own' }))).toBe(true);
    });

    it.each([
        ['search', f({ search: 'x' })],
        ['due', f({ due: 'today' })],
        ['assignee', f({ assignee: 'u' })],
        ['reminder', f({ hasReminder: true })],
        ['sort', f({ sort: 'due' })],
        ['types', f({ types: ['CALL'] })],
        ['priorities', f({ priorities: ['LOW'] })],
        ['statuses', f({ statuses: ['DONE'] })],
        ['list length', f({ types: ['CALL', 'EMAIL'] })],
    ])('Given a difference in %s / When compared with a clean state / Then they do not match', (_n, other) => {
        expect(sameFilters(other, f({ types: _n === 'list length' ? ['CALL'] : [] }))).toBe(false);
    });

    it('Given the same manual sort with a different direction / When compared / Then they differ; under smart order direction is irrelevant', () => {
        expect(sameFilters(f({ sort: 'due', order: 'asc' }), f({ sort: 'due', order: 'desc' }))).toBe(false);
        expect(sameFilters(f({ sort: '', order: 'asc' }), f({ sort: '', order: 'desc' }))).toBe(true);
    });

    it('Given a clean state or only the tab changed / When checked / Then there are no filters; any filter changes that', () => {
        expect(hasNoFilters(f())).toBe(true);
        expect(hasNoFilters(f({ scope: 'all' }))).toBe(true);
        expect(hasNoFilters(f({ due: 'today' }))).toBe(false);
    });
});
