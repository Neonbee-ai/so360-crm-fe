import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { toast } from '@so360/design-system';

const mockGetUpNext = vi.fn();
const mockUpdateTask = vi.fn();

vi.mock('../../services/crmService', () => ({
    crmService: {
        getUpNext: (...a: any[]) => mockGetUpNext(...a),
        updateTask: (...a: any[]) => mockUpdateTask(...a),
    },
}));

import { TasksUpNext } from './TasksUpNext';

const timed = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).toISOString();

const item = (id: string, over: Record<string, any> = {}) => ({
    id,
    title: `Task ${id}`,
    status: 'OPEN',
    type: 'CALL',
    due_date: timed(7, 15, 30),
    at: timed(7, 15, 30),
    kind: 'booked',
    overdue: false,
    day_offset: 0,
    deal: null,
    lead: { company_name: 'Acme', contact_name: 'Ann' },
    assigned_to: { id: 'u1', full_name: 'Test User' },
    ...over,
});

const ITEMS = [
    item('late', { overdue: true, day_offset: -1, at: timed(6, 9), due_date: timed(6, 9), type: 'MEETING' }),
    item('today', {}),
    item('rem', { kind: 'reminder', type: 'TODO', at: timed(7, 17), day_offset: 0, lead: null, deal: { name: 'Big Deal', company_name: 'Big Co' } }),
    item('tomorrow', { day_offset: 1, at: '2026-10-08T00:00:00.000Z', due_date: '2026-10-08T00:00:00.000Z', lead: null, deal: { name: '', company_name: 'Beta Ltd' } }),
    item('later', { day_offset: 4, at: timed(11, 11), lead: { company_name: '', contact_name: 'Bob' } }),
    item('nobody', { day_offset: 6, at: timed(13, 11), lead: null, assigned_to: undefined }),
];

const onChanged = vi.fn();
const onOpen = vi.fn();
const formatDay = (d: string) => `D:${d}`;
const formatTime = () => 'TIME';

const renderPanel = (over: Record<string, any> = {}) =>
    render(
        <TasksUpNext
            scope="own"
            refreshKey={0}
            onChanged={onChanged}
            onOpen={onOpen}
            formatDay={formatDay}
            formatTime={formatTime}
            {...over}
        />,
    );

const row = (id: string) => screen.getByTestId(`up-next-${id}`);
const loaded = () => waitFor(() => expect(screen.getByTestId('up-next-today')).toBeInTheDocument());
const chip = (name: RegExp) => within(screen.getByRole('group', { name: 'Up Next days' })).getByRole('button', { name });

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 10, 0, 0));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUpNext.mockResolvedValue({ items: ITEMS, total: ITEMS.length, days: 7 });
    mockUpdateTask.mockResolvedValue({});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('TasksUpNext - the agenda', () => {
    describe('Given booked calls, meetings and reminders', () => {
        it('When rendered / Then it asks the server for the current tab and browser offset, and lists every item in server order', async () => {
            renderPanel({ scope: 'team' });
            expect(screen.getByText('Loading...')).toBeInTheDocument();
            await loaded();
            expect(mockGetUpNext).toHaveBeenCalledWith({
                scope: 'team',
                tz_offset_minutes: String(-new Date().getTimezoneOffset()),
            });
            const ids = screen.getAllByTestId(/^up-next-/).map(el => el.getAttribute('data-testid'));
            expect(ids).toEqual(['late', 'today', 'rem', 'tomorrow', 'later', 'nobody'].map(i => `up-next-${i}`));
        });

        it('When a row is shown / Then it has time, type, title, associated lead or deal, and assignee', async () => {
            renderPanel();
            await loaded();
            const today = within(row('today'));
            expect(today.getByText('TIME')).toBeInTheDocument();
            expect(today.getByText('Call')).toBeInTheDocument();
            expect(today.getByText('Task today')).toBeInTheDocument();
            expect(today.getByText('Acme')).toBeInTheDocument();
            expect(today.getByText('Test User')).toBeInTheDocument();
        });

        it('When items link to a deal, a deal without a name, or a lead with only a contact / Then the best available name is shown', async () => {
            renderPanel();
            await loaded();
            expect(within(row('rem')).getByText('Big Deal')).toBeInTheDocument();
            expect(within(row('tomorrow')).getByText('Beta Ltd')).toBeInTheDocument();
            expect(within(row('later')).getByText('Bob')).toBeInTheDocument();
            expect(within(row('nobody')).queryByText('Acme')).toBeNull();
        });

        it('When an item is past due / Then it is kept in the agenda and flagged Overdue', async () => {
            renderPanel();
            await loaded();
            expect(within(row('late')).getByText('Overdue')).toBeInTheDocument();
            expect(within(row('today')).queryByText('Overdue')).toBeNull();
        });

        it('When an item is a reminder / Then it carries a bell; a booked call does not', async () => {
            renderPanel();
            await loaded();
            expect(within(row('rem')).getByLabelText('Reminder')).toBeInTheDocument();
            expect(within(row('today')).queryByLabelText('Reminder')).toBeNull();
        });

        it('When an item has a date but no time of day / Then it reads All day instead of an invented time', async () => {
            renderPanel();
            await loaded();
            expect(within(row('tomorrow')).getByText('All day')).toBeInTheDocument();
        });
    });

    describe('Given nothing is booked', () => {
        it('When the agenda is empty / Then a calm empty state shows', async () => {
            mockGetUpNext.mockResolvedValue({ items: [], total: 0, days: 7 });
            renderPanel();
            await waitFor(() => expect(screen.getByText('Nothing booked for this period.')).toBeInTheDocument());
        });
    });

    describe('Given the request fails', () => {
        it('When the API errors / Then an alert shows and the rest of the page is unaffected', async () => {
            mockGetUpNext.mockRejectedValue(new Error('500'));
            renderPanel();
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load Up Next.'));
        });
    });

    describe('Given the tab or refresh key changes', () => {
        it('When the scope changes / Then the agenda is requested again for that tab', async () => {
            const { rerender } = renderPanel();
            await loaded();
            rerender(<TasksUpNext scope="all" refreshKey={0} onChanged={onChanged} onOpen={onOpen} formatDay={formatDay} formatTime={formatTime} />);
            await waitFor(() => expect(mockGetUpNext).toHaveBeenCalledTimes(2));
            expect(mockGetUpNext.mock.calls[1][0].scope).toBe('all');
        });

        it('When the refresh key is bumped / Then the agenda is refetched', async () => {
            const { rerender } = renderPanel();
            await loaded();
            rerender(<TasksUpNext scope="own" refreshKey={1} onChanged={onChanged} onOpen={onOpen} formatDay={formatDay} formatTime={formatTime} />);
            await waitFor(() => expect(mockGetUpNext).toHaveBeenCalledTimes(2));
        });
    });

    describe('Given the panel closes before the server answers', () => {
        it('When the answer arrives later / Then it is ignored without errors', async () => {
            let resolve!: (v: any) => void;
            mockGetUpNext.mockReturnValue(new Promise(r => (resolve = r)));
            const { unmount } = renderPanel();
            unmount();
            await act(async () => resolve({ items: ITEMS, total: 6, days: 7 }));
            expect(console.error).not.toHaveBeenCalled();
        });

        it('When the failure arrives later / Then it is ignored too', async () => {
            let reject!: (e: any) => void;
            mockGetUpNext.mockReturnValue(new Promise((_r, rej) => (reject = rej)));
            const { unmount } = renderPanel();
            unmount();
            await act(async () => reject(new Error('late')));
            expect(console.error).not.toHaveBeenCalled();
        });
    });
});

describe('TasksUpNext - day strip', () => {
    describe('Given the agenda spans several days', () => {
        it('When rendered / Then the strip shows Overdue and each day with its count', async () => {
            renderPanel();
            await loaded();
            expect(chip(/^Overdue: 1$/)).toBeInTheDocument();
            expect(chip(/^Today: 2$/)).toBeInTheDocument();
            expect(chip(/^Tomorrow: 1$/)).toBeInTheDocument();
            expect(chip(/^D:2026-10-09: 0$/)).toBeInTheDocument();
            expect(chip(/^D:2026-10-11: 1$/)).toBeInTheDocument();
            expect(chip(/^D:2026-10-13: 1$/)).toBeInTheDocument();
        });

        it('When a day is clicked / Then only that day is listed; clicking it again shows everything', async () => {
            renderPanel();
            await loaded();
            await userEvent.click(chip(/^Today: 2$/));
            expect(chip(/^Today: 2$/)).toHaveAttribute('aria-pressed', 'true');
            expect(screen.queryByTestId('up-next-late')).toBeNull();
            expect(screen.getByTestId('up-next-today')).toBeInTheDocument();
            expect(screen.getByTestId('up-next-rem')).toBeInTheDocument();
            await userEvent.click(chip(/^Today: 2$/));
            expect(screen.getByTestId('up-next-late')).toBeInTheDocument();
        });

        it('When the Overdue chip is clicked / Then only past-due items show', async () => {
            renderPanel();
            await loaded();
            await userEvent.click(chip(/^Overdue: 1$/));
            expect(screen.getByTestId('up-next-late')).toBeInTheDocument();
            expect(screen.queryByTestId('up-next-today')).toBeNull();
        });

        it('When an empty day is clicked / Then the empty state shows', async () => {
            renderPanel();
            await loaded();
            await userEvent.click(chip(/^D:2026-10-09: 0$/));
            expect(screen.getByText('Nothing booked for this period.')).toBeInTheDocument();
        });
    });

    describe('Given nothing is overdue', () => {
        it('When rendered / Then there is no Overdue chip', async () => {
            mockGetUpNext.mockResolvedValue({ items: [ITEMS[1]], total: 1, days: 7 });
            renderPanel();
            await loaded();
            expect(within(screen.getByRole('group', { name: 'Up Next days' })).queryByRole('button', { name: /^Overdue/ })).toBeNull();
        });
    });
});

describe('TasksUpNext - quick actions', () => {
    describe('Given a row', () => {
        it('When the title or Open is clicked / Then the task is opened', async () => {
            renderPanel();
            await loaded();
            await userEvent.click(within(row('today')).getByText('Task today'));
            await userEvent.click(within(row('today')).getByRole('button', { name: 'Open' }));
            expect(onOpen).toHaveBeenCalledTimes(2);
            expect(onOpen.mock.calls[0][0].id).toBe('today');
        });
    });

    describe('Given Mark done', () => {
        it('When clicked / Then the task is set to DONE, a toast shows and the page is told to refresh', async () => {
            const toastSuccess = vi.spyOn(toast, 'success');
            renderPanel();
            await loaded();
            await userEvent.click(screen.getByRole('button', { name: 'Mark Task today done' }));
            await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
            expect(mockUpdateTask).toHaveBeenCalledWith('today', { status: 'DONE' });
            expect(toastSuccess).toHaveBeenCalledWith('Task marked done');
        });

        it('When the update fails / Then an error toast shows and nothing refreshes', async () => {
            const toastError = vi.spyOn(toast, 'error');
            mockUpdateTask.mockRejectedValue(new Error('boom'));
            renderPanel();
            await loaded();
            await userEvent.click(screen.getByRole('button', { name: 'Mark Task today done' }));
            await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not update the task'));
            expect(onChanged).not.toHaveBeenCalled();
        });
    });

    describe('Given Reschedule', () => {
        const openMenu = async (id = 'today') => {
            await userEvent.click(screen.getByRole('button', { name: `Reschedule Task ${id}` }));
            return within(screen.getByTestId(`reschedule-${id}`));
        };

        it('When the button is clicked twice / Then the options open and close', async () => {
            renderPanel();
            await loaded();
            await openMenu();
            expect(screen.getByRole('button', { name: 'Reschedule Task today' })).toHaveAttribute('aria-expanded', 'true');
            await userEvent.click(screen.getByRole('button', { name: 'Reschedule Task today' }));
            expect(screen.queryByTestId('reschedule-today')).toBeNull();
        });

        it('When +1 day is chosen / Then the due date moves one day keeping its time, and the page refreshes', async () => {
            const toastSuccess = vi.spyOn(toast, 'success');
            renderPanel();
            await loaded();
            const menu = await openMenu();
            await userEvent.click(menu.getByRole('button', { name: '+1 day' }));
            await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
            const sent = mockUpdateTask.mock.calls[0];
            expect(sent[0]).toBe('today');
            expect(new Date(sent[1].due_date).getTime()).toBe(new Date(2026, 9, 8, 15, 30).getTime());
            expect(toastSuccess).toHaveBeenCalledWith('Task rescheduled');
            expect(screen.queryByTestId('reschedule-today')).toBeNull();
        });

        it('When Tomorrow is chosen on an overdue meeting / Then it lands on tomorrow at its time', async () => {
            renderPanel();
            await loaded();
            const menu = await openMenu('late');
            await userEvent.click(menu.getByRole('button', { name: 'Tomorrow' }));
            await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
            expect(new Date(mockUpdateTask.mock.calls[0][1].due_date).getTime()).toBe(new Date(2026, 9, 8, 9, 0).getTime());
        });

        it('When a date is picked / Then that day is sent; an emptied date input sends nothing', async () => {
            renderPanel();
            await loaded();
            const menu = await openMenu('tomorrow');
            const input = menu.getByLabelText('Pick a date for Task tomorrow');
            fireEvent.change(input, { target: { value: '' } });
            expect(mockUpdateTask).not.toHaveBeenCalled();
            fireEvent.change(input, { target: { value: '2026-10-20' } });
            await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('tomorrow', { due_date: '2026-10-20' }));
        });

        it('When rescheduling fails / Then an error toast shows and the options stay open', async () => {
            const toastError = vi.spyOn(toast, 'error');
            mockUpdateTask.mockRejectedValue(new Error('boom'));
            renderPanel();
            await loaded();
            const menu = await openMenu();
            await userEvent.click(menu.getByRole('button', { name: '+1 day' }));
            await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not update the task'));
            expect(screen.getByTestId('reschedule-today')).toBeInTheDocument();
            expect(onChanged).not.toHaveBeenCalled();
        });
    });
});
