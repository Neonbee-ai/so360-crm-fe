/**
 * Smart Tasks & Follow-ups list (Pulse 552552b8): server smart order, counter
 * strip, URL filters, saved views, Up Next agenda.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({
    getTaskList: vi.fn(),
    getUpNext: vi.fn(),
    getUsers: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    listViews: vi.fn(),
    createView: vi.fn(),
    removeView: vi.fn(),
}));
const bridge = vi.hoisted(() => ({ perms: new Set<string>(['activities.create']) }));

vi.mock('../../services/crmService', () => ({
    crmService: {
        getTaskList: (...a: any[]) => svc.getTaskList(...a),
        getUpNext: (...a: any[]) => svc.getUpNext(...a),
        getUsers: (...a: any[]) => svc.getUsers(...a),
        updateTask: (...a: any[]) => svc.updateTask(...a),
        deleteTask: (...a: any[]) => svc.deleteTask(...a),
        gridViews: {
            list: (...a: any[]) => svc.listViews(...a),
            create: (...a: any[]) => svc.createView(...a),
            remove: (...a: any[]) => svc.removeView(...a),
        },
    },
}));
vi.mock('../components/TaskModal', () => ({ default: () => <div data-testid="task-modal" /> }));
vi.mock('@so360/shell-context', async (importOriginal) => ({
    ...(await importOriginal<any>()),
    useShell: () => ({ user: { id: 'user-1', full_name: 'Test User' } }),
    useShellBridge: () => ({
        permissionsLoaded: true,
        effectiveFlagsLoaded: true,
        hasPermission: (c: string) => bridge.perms.has(c),
        isFeatureEnabled: () => true,
    }),
}));

import SmartTasksList, { matchingViewId } from './SmartTasksList';
import { DEFAULT_TASK_FILTERS } from '../../utils/taskListFilters';

const COUNTS = { overdue: 2, today: 1, next_7_days: 3, no_due_date: 0, done: 4, total: 10 };
const task = (id: string, extra: any = {}) => ({ id, title: `Task ${id}`, type: 'CALL', status: 'OPEN', priority: 'HIGH', due_date: '2026-11-01T10:00:00Z', list_bucket: 'overdue', ...extra });

const renderAt = (url = '/tasks') => render(
    <MemoryRouter initialEntries={[url]}><SmartTasksList /></MemoryRouter>,
);
const lastListParams = () => svc.getTaskList.mock.calls[svc.getTaskList.mock.calls.length - 1][0];

beforeEach(() => {
    vi.clearAllMocks();
    bridge.perms = new Set(['activities.create']);
    svc.getTaskList.mockResolvedValue({ items: [task('t1')], total: 1, counts: COUNTS });
    svc.getUpNext.mockResolvedValue({ items: [], total: 0, days: 7 });
    svc.getUsers.mockResolvedValue([{ id: 'u2', full_name: 'Asha' }]);
    svc.listViews.mockResolvedValue([]);
    svc.createView.mockResolvedValue({ id: 'v9', name: 'My calls', entity_type: 'task', config: { version: 1, query: 'type=CALL' } });
    svc.removeView.mockResolvedValue(undefined);
    svc.updateTask.mockResolvedValue({});
    svc.deleteTask.mockResolvedValue(undefined);
});

describe('SmartTasksList — loading the list', () => {
    it('Given no URL filters / When it mounts / Then it asks the server for the smart order, page 1, own scope', async () => {
        renderAt();
        await waitFor(() => expect(svc.getTaskList).toHaveBeenCalled());
        expect(lastListParams()).toMatchObject({ scope: 'own', page: '1', limit: '25', sort: 'smart' });
        expect(lastListParams().tz_offset_minutes).toBe(String(-new Date().getTimezoneOffset()));
        expect(await screen.findByText('Task t1')).toBeInTheDocument();
    });

    it('Given a dashboard deep link / When it mounts / Then the URL filters drive the request', async () => {
        renderAt('/tasks?due=today&reminder=1&type=CALL');
        await waitFor(() => expect(svc.getTaskList).toHaveBeenCalled());
        expect(lastListParams()).toMatchObject({ due: 'today', type: 'CALL' });
    });

    it('Given the server returns counts / When it renders / Then each counter tile shows its count', async () => {
        renderAt();
        expect(await screen.findByTestId('tasks-counter-overdue')).toHaveTextContent('2');
        expect(screen.getByTestId('tasks-counter-done')).toHaveTextContent('4');
    });

    it('Given the list request fails / When it renders / Then the table is empty with the no-tasks message', async () => {
        svc.getTaskList.mockRejectedValue(new Error('boom'));
        renderAt();
        expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
    });
});

describe('SmartTasksList — counters and filters', () => {
    it('Given the Overdue tile / When clicked twice / Then due=overdue is applied then removed', async () => {
        renderAt();
        fireEvent.click(await screen.findByTestId('tasks-counter-overdue'));
        await waitFor(() => expect(lastListParams().due).toBe('overdue'));
        fireEvent.click(screen.getByTestId('tasks-counter-overdue'));
        await waitFor(() => expect(lastListParams().due).toBeUndefined());
    });

    it('Given active filters / When "Clear all" is clicked / Then the request drops them', async () => {
        renderAt('/tasks?priority=HIGH');
        await waitFor(() => expect(lastListParams().priority).toBe('HIGH'));
        fireEvent.click(screen.getByText('Clear all'));
        await waitFor(() => expect(lastListParams().priority).toBeUndefined());
    });

    it('Given filtered results are empty / When it renders / Then the filtered-empty message shows', async () => {
        svc.getTaskList.mockResolvedValue({ items: [], total: 0, counts: COUNTS });
        renderAt('/tasks?due=overdue');
        expect(await screen.findByText('No tasks match these filters.')).toBeInTheDocument();
    });

    it('Given a sortable column / When its header is clicked / Then the server is asked for that sort', async () => {
        renderAt();
        fireEvent.click(await screen.findByTestId('tasks-table-sort-priority'));
        await waitFor(() => expect(lastListParams()).toMatchObject({ sort: 'priority', order: 'asc' }));
    });

    it('Given more than one page / When it renders / Then pagination appears', async () => {
        svc.getTaskList.mockResolvedValue({ items: [task('t1')], total: 60, counts: COUNTS });
        renderAt();
        await screen.findByText('Task t1');
        expect(document.querySelector('[data-slot="pagination"]')?.childElementCount).toBeGreaterThan(0);
    });
});

describe('SmartTasksList — views', () => {
    it('Given the views select / When "Overdue" is picked / Then due=overdue is requested', async () => {
        renderAt();
        const select = await screen.findByLabelText('Task view');
        fireEvent.change(select, { target: { value: 'system:overdue' } });
        await waitFor(() => expect(lastListParams().due).toBe('overdue'));
    });

    it('Given filters that match no view / When "Save view" is confirmed / Then the view is created with those filters', async () => {
        renderAt('/tasks?type=CALL');
        fireEvent.click(await screen.findByTestId('tasks-save-view'));
        fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'My calls' } });
        fireEvent.click(screen.getByTestId('save-task-view-confirm'));
        await waitFor(() => expect(svc.createView).toHaveBeenCalledWith(expect.objectContaining({
            name: 'My calls', entity_type: 'task', config: expect.objectContaining({ query: 'type=CALL' }),
        })));
    });

    it('Given no filters / When it renders / Then "Save view" is disabled', async () => {
        renderAt();
        expect(await screen.findByTestId('tasks-save-view')).toBeDisabled();
    });

    it('Given the active filters match a saved view / When delete is clicked / Then the view is removed', async () => {
        svc.listViews.mockResolvedValue([{ id: 'v1', name: 'Demos', entity_type: 'task', config: { version: 1, query: 'type=DEMO' } }]);
        renderAt('/tasks?type=DEMO');
        fireEvent.click(await screen.findByTestId('tasks-delete-view'));
        await waitFor(() => expect(svc.removeView).toHaveBeenCalledWith('v1'));
        await waitFor(() => expect(screen.queryByTestId('tasks-delete-view')).not.toBeInTheDocument());
    });

    it('Given a saved view / When picked in the select / Then its filters are requested', async () => {
        svc.listViews.mockResolvedValue([{ id: 'v1', name: 'Demos', entity_type: 'task', config: { version: 1, query: 'type=DEMO' } }]);
        renderAt();
        await screen.findByText('Demos');
        fireEvent.change(screen.getByLabelText('Task view'), { target: { value: 'saved:v1' } });
        await waitFor(() => expect(lastListParams().type).toBe('DEMO'));
    });

    it('Given filters / When matchingViewId runs / Then it names the system view, the saved view, or nothing', () => {
        const saved: any[] = [{ id: 'v1', name: 'Demos', entity_type: 'task', config: { version: 1, query: 'type=DEMO' } }];
        expect(matchingViewId({ ...DEFAULT_TASK_FILTERS, due: 'overdue' }, saved)).toBe('system:overdue');
        expect(matchingViewId({ ...DEFAULT_TASK_FILTERS, types: ['DEMO'] }, saved as any)).toBe('saved:v1');
        expect(matchingViewId({ ...DEFAULT_TASK_FILTERS, types: ['EMAIL'] }, saved as any)).toBe('');
    });
});

describe('SmartTasksList — actions and scope', () => {
    it('Given an open task / When its done toggle is clicked / Then it is marked DONE and the list reloads', async () => {
        renderAt();
        fireEvent.click(await screen.findByLabelText('Mark as done'));
        await waitFor(() => expect(svc.updateTask).toHaveBeenCalledWith('t1', { status: 'DONE' }));
        await waitFor(() => expect(svc.getTaskList.mock.calls.length).toBeGreaterThan(1));
    });

    it('Given a row / When "Delete task" is confirmed / Then the task is deleted', async () => {
        renderAt();
        fireEvent.click(await screen.findByTestId('tasks-table-actions-t1'));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete task' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(svc.deleteTask).toHaveBeenCalledWith('t1'));
    });

    it('Given no create permission / When it renders / Then neither Create Task nor row delete is offered', async () => {
        bridge.perms = new Set();
        renderAt();
        await screen.findByText('Task t1');
        expect(screen.queryByText('Create Task')).not.toBeInTheDocument();
        expect(screen.queryByTestId('tasks-table-actions-t1')).not.toBeInTheDocument();
    });

    it('Given team permission / When "Team Tasks" is picked / Then list and Up Next are asked for team scope', async () => {
        bridge.perms = new Set(['crm_tasks.view_team']);
        renderAt();
        fireEvent.click(await screen.findByText('Team Tasks'));
        await waitFor(() => expect(lastListParams().scope).toBe('team'));
        await waitFor(() => expect(svc.getUpNext).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'team' })));
    });

    it('Given only own scope / When it renders / Then no scope switch is shown', async () => {
        renderAt();
        await screen.findByText('Task t1');
        expect(screen.queryByTestId('tasks-scope-views')).not.toBeInTheDocument();
    });
});

describe('SmartTasksList — Up Next', () => {
    it('Given a booked call today / When it renders / Then the Up Next panel lists it', async () => {
        svc.getUpNext.mockResolvedValue({ items: [{ ...task('c1'), at: '2026-11-05T15:00:00Z', kind: 'booked', overdue: false, day_offset: 0 }], total: 1, days: 7 });
        renderAt();
        expect(await screen.findByTestId('up-next-item-c1')).toHaveTextContent('Task c1');
        expect(screen.getByTestId('up-next-group-0')).toHaveTextContent('Today · 1');
    });

    it('Given Up Next fails / When it renders / Then the panel shows "Nothing booked"', async () => {
        svc.getUpNext.mockRejectedValue(new Error('down'));
        renderAt();
        expect(await screen.findByText('Nothing booked')).toBeInTheDocument();
    });
});
