import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TaskSavedViews } from './TaskSavedViews';
import { DEFAULT_TASK_FILTERS, TaskListFilters } from '../../utils/taskListFilters';
import type { TaskViewsApi } from '../../hooks/useTaskViews';

const f = (over: Partial<TaskListFilters> = {}): TaskListFilters => ({ ...DEFAULT_TASK_FILTERS, ...over });

const view = (id: string, name: string, query: string, over: Record<string, any> = {}) => ({
    id,
    name,
    entity_type: 'task',
    config: { version: 1, query },
    is_shared: false,
    is_default: false,
    user_id: 'user-1',
    ...over,
});

const makeApi = (over: Partial<TaskViewsApi> = {}): TaskViewsApi => ({
    views: [],
    loaded: true,
    available: true,
    save: vi.fn().mockResolvedValue({ id: 'new' }),
    rename: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true),
    setDefault: vi.fn().mockResolvedValue(true),
    ...over,
});

const onApply = vi.fn();

const renderViews = (filters: TaskListFilters, api: TaskViewsApi, userId: string | null = 'user-1') =>
    render(<TaskSavedViews filters={filters} currentUserId={userId ?? undefined} taskViews={api} onApply={onApply} />);

const bar = () => within(screen.getByTestId('task-views'));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('TaskSavedViews - built-in views', () => {
    describe('Given any user', () => {
        it('When rendered / Then the built-in views are always offered', () => {
            renderViews(f(), makeApi());
            for (const name of ['Overdue', 'Today', 'Upcoming calls', 'High priority', 'Assigned to me', 'With reminders']) {
                expect(bar().getByRole('button', { name })).toBeInTheDocument();
            }
        });

        it('When Overdue is clicked on the Team tab / Then it applies its filters and keeps the tab', async () => {
            renderViews(f({ scope: 'team', search: 'x' }), makeApi());
            await userEvent.click(bar().getByRole('button', { name: 'Overdue' }));
            expect(onApply).toHaveBeenCalledWith(f({ scope: 'team', due: 'overdue' }));
        });

        it('When the filters match a built-in view / Then it is shown pressed', () => {
            renderViews(f({ due: 'today' }), makeApi());
            expect(bar().getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
            expect(bar().getByRole('button', { name: 'Overdue' })).toHaveAttribute('aria-pressed', 'false');
        });

        it('When the user id is unknown / Then Assigned to me is not offered', () => {
            renderViews(f(), makeApi(), null);
            expect(bar().queryByRole('button', { name: 'Assigned to me' })).toBeNull();
        });
    });
});

describe('TaskSavedViews - the user\'s own views', () => {
    const mine = [
        view('v1', 'Hot calls', 'type=CALL&priority=HIGH'),
        view('v2', 'Mine first', 'due=today', { is_default: true }),
    ];

    describe('Given saved views', () => {
        it('When rendered / Then they follow the built-ins and the default one is marked', () => {
            renderViews(f(), makeApi({ views: mine as any }));
            expect(bar().getByRole('button', { name: 'Hot calls' })).toBeInTheDocument();
            expect(within(screen.getByTestId('task-view-v2')).getByLabelText('Default view')).toBeInTheDocument();
            expect(within(screen.getByTestId('task-view-v1')).queryByLabelText('Default view')).toBeNull();
        });

        it('When one is clicked / Then its stored filters are applied on the current tab', async () => {
            renderViews(f({ scope: 'all' }), makeApi({ views: mine as any }));
            await userEvent.click(bar().getByRole('button', { name: 'Hot calls' }));
            expect(onApply).toHaveBeenCalledWith(f({ scope: 'all', types: ['CALL'], priorities: ['HIGH'] }));
        });

        it('When the filters equal a saved view / Then that view is pressed', () => {
            renderViews(f({ types: ['CALL'], priorities: ['HIGH'] }), makeApi({ views: mine as any }));
            expect(bar().getByRole('button', { name: 'Hot calls' })).toHaveAttribute('aria-pressed', 'true');
        });
    });

    describe('Given saved views cannot be used', () => {
        it('When the views API is unavailable / Then only the built-ins show and saving is not offered', () => {
            renderViews(f({ due: 'custom' as any }), makeApi({ available: false, views: mine as any }));
            expect(bar().queryByRole('button', { name: 'Hot calls' })).toBeNull();
            expect(bar().queryByRole('button', { name: 'Save view' })).toBeNull();
        });
    });

    describe('Given the manage menu', () => {
        const openMenu = async (id: string, name: string) => {
            await userEvent.click(screen.getByRole('button', { name: `Manage view ${name}` }));
            return within(screen.getByTestId(`task-view-${id}`));
        };

        it('When the menu button is clicked twice / Then it opens and closes', async () => {
            renderViews(f(), makeApi({ views: mine as any }));
            await openMenu('v1', 'Hot calls');
            expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', { name: 'Manage view Hot calls' }));
            expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
        });

        it('When Set as default is clicked / Then the view becomes the default and the menu closes', async () => {
            const api = makeApi({ views: mine as any });
            renderViews(f(), api);
            const menu = await openMenu('v1', 'Hot calls');
            await userEvent.click(menu.getByRole('button', { name: 'Set as default' }));
            expect(api.setDefault).toHaveBeenCalledWith('v1');
            expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
        });

        it('When the view is already the default / Then its menu entry is disabled', async () => {
            renderViews(f(), makeApi({ views: mine as any }));
            const menu = await openMenu('v2', 'Mine first');
            expect(menu.getByRole('button', { name: 'Default view' })).toBeDisabled();
        });

        it('When Rename is used / Then a name box appears and saving sends the trimmed name', async () => {
            const api = makeApi({ views: mine as any });
            renderViews(f(), api);
            const menu = await openMenu('v1', 'Hot calls');
            await userEvent.click(menu.getByRole('button', { name: 'Rename' }));
            const input = screen.getByLabelText('View name');
            expect(input).toHaveValue('Hot calls');
            fireEvent.change(input, { target: { value: '  Warm calls ' } });
            await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
            expect(api.rename).toHaveBeenCalledWith('v1', 'Warm calls');
            expect(screen.queryByLabelText('View name')).toBeNull();
        });

        it('When the new name is empty / Then nothing is sent', async () => {
            const api = makeApi({ views: mine as any });
            renderViews(f(), api);
            const menu = await openMenu('v1', 'Hot calls');
            await userEvent.click(menu.getByRole('button', { name: 'Rename' }));
            fireEvent.change(screen.getByLabelText('View name'), { target: { value: '   ' } });
            await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
            expect(api.rename).not.toHaveBeenCalled();
        });

        it('When renaming fails / Then the box stays open; Cancel closes it', async () => {
            const api = makeApi({ views: mine as any, rename: vi.fn().mockResolvedValue(false) });
            renderViews(f(), api);
            const menu = await openMenu('v1', 'Hot calls');
            await userEvent.click(menu.getByRole('button', { name: 'Rename' }));
            await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
            expect(screen.getByLabelText('View name')).toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByLabelText('View name')).toBeNull();
        });

        it('When Delete is used / Then it asks to confirm before removing', async () => {
            const api = makeApi({ views: mine as any });
            renderViews(f(), api);
            const menu = await openMenu('v1', 'Hot calls');
            await userEvent.click(menu.getByRole('button', { name: 'Delete' }));
            expect(api.remove).not.toHaveBeenCalled();
            await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
            expect(api.remove).toHaveBeenCalledWith('v1');
            expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
        });

        it('When the menu is reopened after starting a delete / Then the confirmation is reset', async () => {
            renderViews(f(), makeApi({ views: mine as any }));
            const menu = await openMenu('v1', 'Hot calls');
            await userEvent.click(menu.getByRole('button', { name: 'Delete' }));
            await userEvent.click(screen.getByRole('button', { name: 'Manage view Hot calls' }));
            await userEvent.click(screen.getByRole('button', { name: 'Manage view Hot calls' }));
            expect(screen.queryByRole('button', { name: 'Confirm delete' })).toBeNull();
            expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
        });
    });
});

describe('TaskSavedViews - saving the current filters', () => {
    describe('Given filters no view represents', () => {
        it('When a name is entered and saved / Then the view is created from the current filters and the box closes', async () => {
            const api = makeApi();
            renderViews(f({ types: ['EMAIL'], scope: 'team' }), api);
            await userEvent.click(bar().getByRole('button', { name: 'Save view' }));
            fireEvent.change(screen.getByLabelText('New view name'), { target: { value: ' Emails ' } });
            await userEvent.click(screen.getByRole('button', { name: 'Save' }));
            expect(api.save).toHaveBeenCalledWith('Emails', f({ types: ['EMAIL'], scope: 'team' }));
            expect(screen.queryByLabelText('New view name')).toBeNull();
        });

        it('When the name is empty / Then nothing is saved', async () => {
            const api = makeApi();
            renderViews(f({ types: ['EMAIL'] }), api);
            await userEvent.click(bar().getByRole('button', { name: 'Save view' }));
            await userEvent.click(screen.getByRole('button', { name: 'Save' }));
            expect(api.save).not.toHaveBeenCalled();
        });

        it('When saving fails / Then the box stays so the name is not lost; Cancel closes it', async () => {
            const api = makeApi({ save: vi.fn().mockResolvedValue(null) });
            renderViews(f({ types: ['EMAIL'] }), api);
            await userEvent.click(bar().getByRole('button', { name: 'Save view' }));
            fireEvent.change(screen.getByLabelText('New view name'), { target: { value: 'Emails' } });
            await userEvent.click(screen.getByRole('button', { name: 'Save' }));
            expect(screen.getByLabelText('New view name')).toHaveValue('Emails');
            await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByLabelText('New view name')).toBeNull();
        });
    });

    describe('Given nothing to save', () => {
        it('When there are no filters / Then Save view is not offered', () => {
            renderViews(f(), makeApi());
            expect(bar().queryByRole('button', { name: 'Save view' })).toBeNull();
        });

        it('When the filters are exactly a built-in view / Then Save view is not offered', () => {
            renderViews(f({ due: 'overdue' }), makeApi());
            expect(bar().queryByRole('button', { name: 'Save view' })).toBeNull();
        });

        it('When the filters are exactly a saved view / Then Save view is not offered', () => {
            renderViews(f({ due: 'today', hasReminder: true }), makeApi({ views: [view('v9', 'Same', 'due=today&reminder=1')] as any }));
            expect(bar().queryByRole('button', { name: 'Save view' })).toBeNull();
        });
    });
});
