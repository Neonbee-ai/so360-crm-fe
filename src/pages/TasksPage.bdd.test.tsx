import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from '@so360/design-system';

const mockGetTaskList = vi.fn();
const mockGetUsers = vi.fn();
const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getTaskList: (...a: any[]) => mockGetTaskList(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    deleteTask: (...a: any[]) => mockDeleteTask(...a),
  },
}));

let sandbox = { isSandboxMode: false, sandboxEntryLimit: 0, isLimited: (_n: number) => false };
vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useShell: () => ({ user: { id: 'user-1', full_name: 'Test User' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: vi.fn(),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => sandbox,
}));

vi.mock('./components/TaskModal', () => ({
  default: ({ onClose, onSuccess }: any) => (
    <div data-testid="task-modal">
      <button onClick={() => onSuccess({ id: 'new' })}>save-task</button>
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
}));

import TasksPage from './TasksPage';

const COUNTS = { overdue: 2, today: 1, next_7_days: 2, no_due_date: 1, done: 1, total: 6 };

const mk = (id: string, over: Record<string, any> = {}) => ({
  id,
  title: `Task ${id}`,
  status: 'OPEN',
  priority: 'MEDIUM',
  type: 'CALL',
  due_date: null,
  list_bucket: 'no_due',
  deal: null,
  lead: null,
  assigned_to: { id: 'user-1', full_name: 'Test User' },
  ...over,
});

const makeItems = () => [
  mk('over1', { list_bucket: 'overdue', priority: 'CRITICAL', due_date: '2026-10-05T00:00:00.000Z', deal: { name: 'Big Deal', company_name: 'Big Deal Inc' } }),
  mk('over2', { list_bucket: 'overdue', priority: 'HIGH', type: 'MEETING', due_date: new Date(2026, 9, 6, 9, 0).toISOString(), lead: { company_name: 'Acme', contact_name: 'Ann' } }),
  mk('today1', { list_bucket: 'today', type: 'EMAIL', due_date: new Date(2026, 9, 7, 16, 5).toISOString() }),
  mk('up1', { list_bucket: 'upcoming', priority: 'LOW', type: 'REMINDER', due_date: '2026-10-14T00:00:00.000Z', status: 'IN_PROGRESS', assigned_to: { id: 'user-2', full_name: 'Other User' } }),
  mk('none1', { list_bucket: 'no_due', type: 'TODO' }),
  mk('done1', { list_bucket: 'done', status: 'DONE', due_date: '2026-10-01T00:00:00.000Z', assigned_to: { id: 'user-2', full_name: 'Other User' } }),
];

const response = (over: Record<string, any> = {}) => ({
  items: makeItems(),
  total: 6,
  counts: COUNTS,
  page: 1,
  limit: 25,
  truncated: false,
  ...over,
});

const USERS = [
  { id: 'user-1', full_name: 'Test User' },
  { id: 'user-2', full_name: 'Other User' },
];

const LocationProbe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};

const renderPage = (url = '/tasks') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/tasks" element={<><TasksPage /><LocationProbe /></>} />
        <Route path="/tasks/:id" element={<div data-testid="detail">detail</div>} />
      </Routes>
    </MemoryRouter>,
  );

const withPermissions = async (granted: string[], extra: Record<string, any> = {}) => {
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true,
    hasPermission: (code: string) => granted.includes(code),
    hasAnyPermission: () => true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    ...extra,
  } as any));
};

const lastParams = () => mockGetTaskList.mock.calls[mockGetTaskList.mock.calls.length - 1][0];
const loaded = () => waitFor(() => expect(screen.getByTestId('task-row-over1')).toBeInTheDocument());
const section = (bucket: string) => screen.getByTestId(`task-section-${bucket}`);
const counter = (name: RegExp) => within(screen.getByTestId('task-counters')).getByRole('button', { name });
const loc = () => screen.getByTestId('loc').textContent;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 7, 10, 0, 0));
  sandbox = { isSandboxMode: false, sandboxEntryLimit: 0, isLimited: () => false };
  await withPermissions(['activities.create']);
  mockGetTaskList.mockResolvedValue(response());
  mockGetUsers.mockResolvedValue(USERS);
  mockUpdateTask.mockResolvedValue({});
  mockDeleteTask.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TasksPage - smart-ordered sections', () => {
  describe('Given tasks are still loading', () => {
    it('When rendered / Then a skeleton shows instead of the sections', () => {
      mockGetTaskList.mockReturnValue(new Promise(() => {}));
      const { container } = renderPage();
      expect(container.querySelector('.animate-pulse')).not.toBeNull();
      expect(screen.queryByTestId('task-section-overdue')).toBeNull();
    });
  });

  describe('Given tasks have loaded', () => {
    it('When rendered / Then sections appear in order Overdue, Today, Upcoming, No due date, Done with server counts', async () => {
      renderPage();
      await loaded();
      const order = Array.from(document.querySelectorAll('[data-testid^="task-section-"]')).map(el => el.getAttribute('data-testid'));
      expect(order).toEqual(['task-section-overdue', 'task-section-today', 'task-section-upcoming', 'task-section-no_due', 'task-section-done']);
      expect(within(section('overdue')).getByRole('button', { name: /Overdue\s*2/ })).toBeInTheDocument();
      expect(within(section('today')).getByRole('button', { name: /Today\s*1/ })).toBeInTheDocument();
      expect(within(section('upcoming')).getByRole('button', { name: /Upcoming\s*1/ })).toBeInTheDocument();
      expect(within(section('no_due')).getByRole('button', { name: /No due date\s*1/ })).toBeInTheDocument();
      expect(within(section('done')).getByRole('button', { name: /Done\s*1/ })).toBeInTheDocument();
    });

    it('When rendered / Then each task sits in the section the server placed it in', async () => {
      renderPage();
      await loaded();
      expect(within(section('overdue')).getByTestId('task-row-over2')).toBeInTheDocument();
      expect(within(section('today')).getByTestId('task-row-today1')).toBeInTheDocument();
      expect(within(section('upcoming')).getByTestId('task-row-up1')).toBeInTheDocument();
      expect(within(section('no_due')).getByTestId('task-row-none1')).toBeInTheDocument();
    });

    it('When rendered / Then the first fetch uses smart sort, scope own, page 1 and the browser timezone offset', async () => {
      renderPage();
      await loaded();
      expect(lastParams()).toMatchObject({ scope: 'own', sort: 'smart', page: '1', limit: '25' });
      expect(lastParams().tz_offset_minutes).toBe(String(-new Date().getTimezoneOffset()));
      expect(lastParams()).not.toHaveProperty('order');
    });

    it('When rendered / Then the Smart order indicator is visible', async () => {
      renderPage();
      await loaded();
      expect(screen.getByText('Smart order')).toBeInTheDocument();
    });

    it('When Done is the only collapsed section / Then its rows are hidden until expanded, and any section can be collapsed', async () => {
      renderPage();
      await loaded();
      expect(screen.queryByTestId('task-row-done1')).toBeNull();
      const doneToggle = within(section('done')).getByRole('button', { name: /Done/ });
      expect(doneToggle).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(doneToggle);
      expect(screen.getByTestId('task-row-done1')).toBeInTheDocument();
      await userEvent.click(within(section('overdue')).getByRole('button', { name: /Overdue/ }));
      expect(screen.queryByTestId('task-row-over1')).toBeNull();
      await userEvent.click(within(section('overdue')).getByRole('button', { name: /Overdue/ }));
      expect(screen.getByTestId('task-row-over1')).toBeInTheDocument();
    });
  });

  describe('Given overdue and upcoming tasks', () => {
    it('When rendered / Then overdue rows have a red accent and "N days overdue" and today shows its time on one line', async () => {
      renderPage();
      await loaded();
      const over1 = screen.getByTestId('task-row-over1');
      expect(over1.className).toContain('border-l-rose-500');
      expect(within(over1).getByText('2 days overdue')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-over2')).getByText('1 day overdue')).toBeInTheDocument();
      const todayLabel = within(screen.getByTestId('task-row-today1')).getByText(/^Today/);
      expect(todayLabel.textContent).toMatch(/^Today \S+/); // date and time share one line
      expect(todayLabel.className).toContain('whitespace-nowrap');
      expect(todayLabel.getAttribute('title')).toMatch(/2026/);
      expect(within(screen.getByTestId('task-row-none1')).getByText('No due date')).toBeInTheDocument();
    });

    it('When rendered / Then priority and type columns show icons and labels', async () => {
      renderPage();
      await loaded();
      expect(within(screen.getByTestId('task-row-over1')).getByText('Critical')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-over2')).getByText('Meeting')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-today1')).getByText('Email')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-up1')).getByText('Reminder')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-up1')).getByText('Low')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-none1')).getByText('To-do')).toBeInTheDocument();
    });

    it('When a task has an unknown priority and type / Then dashes are shown', async () => {
      mockGetTaskList.mockResolvedValue(response({ items: [mk('odd', { list_bucket: 'upcoming', priority: undefined, type: 'FAX', due_date: '2026-10-20T00:00:00.000Z' })] }));
      renderPage();
      await waitFor(() => expect(screen.getByTestId('task-row-odd')).toBeInTheDocument());
      expect(within(screen.getByTestId('task-row-odd')).getAllByText('-')).toHaveLength(2);
    });
  });

  describe('Given the Associated With column', () => {
    it('When rendered / Then deals come first, then leads, otherwise a dash', async () => {
      renderPage();
      await loaded();
      expect(within(screen.getByTestId('task-row-over1')).getByText('Big Deal')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-over2')).getByText('Acme')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-over2')).getByText('Ann')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-none1')).getByText('—')).toBeInTheDocument();
    });
  });

  describe('Given a project-linked task', () => {
    it('When rendered / Then the link indicator shows, flagged when sync failed', async () => {
      mockGetTaskList.mockResolvedValue(response({ items: [
        mk('p1', { list_bucket: 'overdue', project_id: 'proj', sync_status: 'connected', due_date: '2026-10-05T00:00:00.000Z' }),
        mk('p2', { list_bucket: 'overdue', project_id: 'proj', sync_status: 'sync_failed', due_date: '2026-10-05T00:00:00.000Z' }),
        mk('p3'),
      ] }));
      renderPage();
      await waitFor(() => expect(screen.getByTestId('task-row-p1')).toBeInTheDocument());
      expect(within(screen.getByTestId('task-row-p1')).getByTitle('Linked to a project')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-p2')).getByTitle('Project sync failed')).toBeInTheDocument();
      expect(within(screen.getByTestId('task-row-p3')).queryByTitle('Linked to a project')).toBeNull();
    });
  });

  describe('Given sections without tasks', () => {
    it('When counts are zero / Then each section shows its empty state', async () => {
      mockGetTaskList.mockResolvedValue(response({ items: [], total: 0, counts: { overdue: 0, today: 0, next_7_days: 0, no_due_date: 0, done: 0, total: 0 } }));
      renderPage();
      await waitFor(() => expect(screen.getByText('Nothing overdue. Nice work.')).toBeInTheDocument());
      expect(screen.getByText('Nothing due today.')).toBeInTheDocument();
      expect(screen.getByText('No upcoming tasks.')).toBeInTheDocument();
      expect(screen.getByText('Every open task has a due date.')).toBeInTheDocument();
      expect(screen.queryByText('No completed tasks yet.')).toBeNull(); // Done starts collapsed
      await userEvent.click(within(section('done')).getByRole('button', { name: /Done/ }));
      expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument();
      expect(screen.getByText('Showing 0 of 0 tasks')).toBeInTheDocument();
    });

    it('When the server counts tasks that are not loaded yet / Then the section points to Load more', async () => {
      mockGetTaskList.mockResolvedValue(response({ items: [mk('o', { list_bucket: 'overdue', due_date: '2026-10-05T00:00:00.000Z' })], total: 6 }));
      renderPage();
      await waitFor(() => expect(screen.getByTestId('task-row-o')).toBeInTheDocument());
      expect(within(section('today')).getByText(/Not loaded yet/)).toBeInTheDocument();
    });
  });

  describe('Given the list request fails', () => {
    it('When the API errors / Then an error banner shows and can be dismissed', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetTaskList.mockRejectedValue(new Error('boom'));
      renderPage();
      await waitFor(() => expect(screen.getByText(/Failed to load tasks/)).toBeInTheDocument());
      await userEvent.click(screen.getByText('×'));
      expect(screen.queryByText(/Failed to load tasks/)).toBeNull();
      spy.mockRestore();
    });

    it('When the users request fails / Then the list still renders', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetUsers.mockRejectedValue(new Error('nope'));
      renderPage();
      await loaded();
      expect(spy).toHaveBeenCalledWith('Failed to fetch users', expect.any(Error));
      spy.mockRestore();
    });
  });
});

describe('TasksPage - counter strip quick filters', () => {
  describe('Given the counter strip', () => {
    it('When rendered / Then it shows Overdue, Today, Next 7 days, No due date and Done counts', async () => {
      renderPage();
      await loaded();
      expect(counter(/Overdue/)).toHaveTextContent('2');
      expect(counter(/^1\s*Today/)).toBeInTheDocument();
      expect(counter(/Next 7 days/)).toHaveTextContent('2');
      expect(counter(/No due date/)).toHaveTextContent('1');
      expect(counter(/Done/)).toHaveTextContent('1');
    });

    it('When a tile is clicked / Then it applies that due filter, refetches and marks the tile pressed', async () => {
      renderPage();
      await loaded();
      await userEvent.click(counter(/Overdue/));
      await waitFor(() => expect(lastParams().due).toBe('overdue'));
      expect(loc()).toContain('due=overdue');
      expect(counter(/Overdue/)).toHaveAttribute('aria-pressed', 'true');
      expect(counter(/Today/)).toHaveAttribute('aria-pressed', 'false');
    });

    it('When the active tile is clicked again / Then the filter is switched off', async () => {
      renderPage();
      await loaded();
      await userEvent.click(counter(/Next 7 days/));
      await waitFor(() => expect(lastParams().due).toBe('next_7_days'));
      await userEvent.click(counter(/Next 7 days/));
      await waitFor(() => expect(lastParams()).not.toHaveProperty('due'));
      expect(loc()).not.toContain('due=');
    });

    it('When the Done tile is clicked / Then due=done is requested (counts stay stable)', async () => {
      renderPage();
      await loaded();
      await userEvent.click(counter(/Done/));
      await waitFor(() => expect(lastParams().due).toBe('done'));
    });

    it('When there is nothing overdue / Then the Overdue tile is not alarmed', async () => {
      mockGetTaskList.mockResolvedValue(response({ counts: { ...COUNTS, overdue: 0 } }));
      renderPage();
      await loaded();
      expect(counter(/Overdue/).className).not.toContain('text-rose-300');
    });
  });
});

describe('TasksPage - filter bar, chips and URL state', () => {
  describe('Given the filter bar', () => {
    it('When a Due preset is chosen / Then a chip appears, the API gets it and the URL records it', async () => {
      renderPage();
      await loaded();
      await userEvent.selectOptions(screen.getByLabelText('Due'), 'tomorrow');
      await waitFor(() => expect(lastParams().due).toBe('tomorrow'));
      expect(screen.getByText('Due: Tomorrow')).toBeInTheDocument();
      expect(loc()).toBe('/tasks?due=tomorrow');
    });

    it('When Type, Priority and Status multi-selects are used / Then values are sent comma-separated and shown as chips', async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByRole('button', { name: 'Type' }));
      await userEvent.click(screen.getByLabelText('Call'));
      await userEvent.click(screen.getByLabelText('Meeting'));
      await waitFor(() => expect(lastParams().type).toBe('CALL,MEETING'));
      await userEvent.click(screen.getByRole('button', { name: 'Priority' }));
      await userEvent.click(screen.getByLabelText('Critical'));
      await waitFor(() => expect(lastParams().priority).toBe('CRITICAL'));
      await userEvent.click(screen.getByRole('button', { name: 'Status' }));
      await userEvent.click(screen.getByLabelText('In Progress'));
      await waitFor(() => expect(lastParams().status).toBe('IN_PROGRESS'));
      expect(screen.getByText('Type: Call, Meeting')).toBeInTheDocument();
      expect(screen.getByText('Priority: Critical')).toBeInTheDocument();
      expect(screen.getByText('Status: In Progress')).toBeInTheDocument();
      expect(screen.queryByLabelText('On Hold')).toBeNull(); // ON_HOLD is not offered: the DB rejects it
    });

    it('When a chip is removed / Then only that filter is dropped', async () => {
      renderPage('/tasks?type=CALL&priority=HIGH');
      await loaded();
      const chip = screen.getByText('Type: Call');
      await userEvent.click(within(chip).getByRole('button'));
      await waitFor(() => expect(lastParams()).not.toHaveProperty('type'));
      expect(lastParams().priority).toBe('HIGH');
      expect(screen.queryByText('Type: Call')).toBeNull();
      expect(screen.getByText('Priority: High')).toBeInTheDocument();
    });

    it('When a multi-select option is unticked / Then it leaves the filter', async () => {
      renderPage('/tasks?type=CALL,EMAIL');
      await loaded();
      await userEvent.click(screen.getByRole('button', { name: 'Type (2)' }));
      await userEvent.click(screen.getByLabelText('Call'));
      await waitFor(() => expect(lastParams().type).toBe('EMAIL'));
    });

    it('When Clear all is clicked / Then every filter and the search are reset but the tab is kept', async () => {
      await withPermissions(['activities.create', 'crm_tasks.view_team']);
      renderPage('/tasks?scope=team&type=CALL&due=overdue&q=acme');
      await loaded();
      await userEvent.click(screen.getByRole('button', { name: /Clear \(3\)/ }));
      await waitFor(() => expect(loc()).toBe('/tasks?scope=team'));
      expect(lastParams()).toMatchObject({ scope: 'team' });
      expect(lastParams()).not.toHaveProperty('type');
      expect(lastParams()).not.toHaveProperty('search');
      expect(screen.getByPlaceholderText('Search tasks, leads or deals...')).toHaveValue('');
    });
  });

  describe('Given the Assigned to filter', () => {
    it('When on My Tasks / Then it is not offered', async () => {
      renderPage();
      await loaded();
      expect(screen.queryByLabelText('Assigned to')).toBeNull();
    });

    it('When on Team Tasks / Then it is offered and filters by assignee', async () => {
      await withPermissions(['activities.create', 'crm_tasks.view_team']);
      renderPage('/tasks?scope=team');
      await loaded();
      await userEvent.selectOptions(screen.getByLabelText('Assigned to'), 'user-2');
      await waitFor(() => expect(lastParams().assignee_id).toBe('user-2'));
      expect(screen.getByText('Assigned to: Other User')).toBeInTheDocument();
    });
  });

  describe('Given search', () => {
    it('When the user types / Then the query is debounced into the URL and the API', async () => {
      renderPage();
      await loaded();
      const callsBefore = mockGetTaskList.mock.calls.length;
      await userEvent.type(screen.getByPlaceholderText('Search tasks, leads or deals...'), 'acme');
      expect(mockGetTaskList.mock.calls.length).toBe(callsBefore); // not on every keystroke
      await waitFor(() => expect(lastParams().search).toBe('acme'));
      expect(loc()).toBe('/tasks?q=acme');
      expect(screen.getByText('Search: acme')).toBeInTheDocument();
    });

    it('When the search chip is removed / Then the box and the query are cleared', async () => {
      renderPage('/tasks?q=acme');
      await loaded();
      await userEvent.click(within(screen.getByText('Search: acme')).getByRole('button'));
      await waitFor(() => expect(lastParams()).not.toHaveProperty('search'));
      expect(screen.getByPlaceholderText('Search tasks, leads or deals...')).toHaveValue('');
    });
  });

  describe('Given a URL carrying filters (a shared or restored link)', () => {
    it('When the page opens / Then those filters drive the first request and the UI', async () => {
      renderPage('/tasks?priority=HIGH,CRITICAL&status=OPEN&due=today&q=deal&sort=due&order=desc');
      await loaded();
      expect(mockGetTaskList.mock.calls[0][0]).toMatchObject({
        priority: 'HIGH,CRITICAL',
        status: 'OPEN',
        due: 'today',
        search: 'deal',
        sort: 'due',
        order: 'desc',
      });
      expect(screen.getByText('Priority: High, Critical')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search tasks, leads or deals...')).toHaveValue('deal');
      expect(counter(/Today/)).toHaveAttribute('aria-pressed', 'true');
    });

    it('When the user opens a task and comes back / Then the URL still holds the view', async () => {
      renderPage('/tasks?type=CALL');
      await loaded();
      await userEvent.click(screen.getByTestId('task-row-over1'));
      expect(screen.getByTestId('detail')).toBeInTheDocument();
    });
  });
});

describe('TasksPage - sorting', () => {
  describe('Given smart order', () => {
    it('When a sortable header is clicked / Then the list becomes one flat sorted group with a sort indicator', async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByText('Due Date'));
      await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'due', order: 'asc' }));
      expect(loc()).toBe('/tasks?sort=due&order=asc');
      expect(screen.getByText('Sorted by Due Date (ascending)')).toBeInTheDocument();
      expect(screen.queryByText('Smart order')).toBeNull();
      expect(screen.queryByRole('button', { name: /Overdue\s*2/ })).toBeNull();
      expect(screen.queryByTestId('task-section-overdue')).toBeNull();
      expect(screen.getByTestId('task-row-over1')).toBeInTheDocument();
    });

    it('When the same header is clicked again / Then it sorts descending, then returns to smart order', async () => {
      renderPage('/tasks?sort=priority&order=asc');
      await loaded();
      await userEvent.click(screen.getByRole('columnheader', { name: 'Priority' }));
      await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'priority', order: 'desc' }));
      expect(screen.getByText('Sorted by Priority (descending)')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('columnheader', { name: 'Priority' }));
      await waitFor(() => expect(lastParams().sort).toBe('smart'));
      expect(screen.getByText('Smart order')).toBeInTheDocument();
    });

    it('When "Back to smart order" is clicked / Then the manual sort is dropped', async () => {
      renderPage('/tasks?sort=title');
      await loaded();
      expect(screen.getByText('Sorted by Task (ascending)')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Back to smart order' }));
      await waitFor(() => expect(lastParams().sort).toBe('smart'));
    });

    it('When a column the server cannot sort is clicked / Then nothing changes', async () => {
      renderPage();
      await loaded();
      const calls = mockGetTaskList.mock.calls.length;
      await userEvent.click(screen.getByText('Associated With'));
      expect(mockGetTaskList.mock.calls.length).toBe(calls);
    });
  });
});

describe('TasksPage - paging', () => {
  describe('Given more tasks than the first page', () => {
    it('When Load more is clicked / Then the next page is appended without duplicates and counts update', async () => {
      mockGetTaskList.mockResolvedValueOnce(response({ total: 8 }));
      renderPage();
      await loaded();
      expect(screen.getByText('Showing 6 of 8 tasks')).toBeInTheDocument();
      mockGetTaskList.mockResolvedValueOnce(response({
        items: [mk('over1', { list_bucket: 'overdue', due_date: '2026-10-05T00:00:00.000Z' }), mk('extra', { list_bucket: 'no_due' })],
        total: 8,
        counts: { ...COUNTS, no_due_date: 2 },
      }));
      await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
      await waitFor(() => expect(screen.getByTestId('task-row-extra')).toBeInTheDocument());
      expect(lastParams()).toMatchObject({ page: '2', limit: '25' });
      expect(screen.getAllByTestId('task-row-over1')).toHaveLength(1);
      expect(screen.getByText('Showing 7 of 8 tasks')).toBeInTheDocument();
    });

    it('When Load more fails / Then an error toast shows and the button comes back', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const toastSpy = vi.spyOn(toast, 'error');
      mockGetTaskList.mockResolvedValueOnce(response({ total: 8 }));
      renderPage();
      await loaded();
      mockGetTaskList.mockRejectedValueOnce(new Error('fail'));
      await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
      await waitFor(() => expect(toastSpy).toHaveBeenCalledWith('Failed to load more tasks'));
      expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
      spy.mockRestore();
    });

    it('When everything is loaded / Then there is no Load more button', async () => {
      renderPage();
      await loaded();
      expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    });
  });

  describe('Given the server truncated a huge list', () => {
    it('When rendered / Then a notice explains the cap', async () => {
      mockGetTaskList.mockResolvedValue(response({ truncated: true }));
      renderPage();
      await loaded();
      expect(screen.getByText(/most recent 5,000 tasks/)).toBeInTheDocument();
    });
  });

  describe('Given sandbox mode', () => {
    it('When more tasks are loaded than the sandbox allows / Then only the limit is shown with a notice', async () => {
      sandbox = { isSandboxMode: true, sandboxEntryLimit: 2, isLimited: () => true };
      renderPage();
      await waitFor(() => expect(screen.getByTestId('task-row-over1')).toBeInTheDocument());
      expect(screen.queryByTestId('task-row-today1')).toBeNull();
      expect(screen.getByText(/Sandbox mode:/)).toBeInTheDocument();
    });
  });
});

describe('TasksPage - visibility scope tabs', () => {
  describe('Given the caller holds neither view_team nor view_all', () => {
    it('When the page loads / Then no tabs render and the scope is own', async () => {
      renderPage();
      await loaded();
      expect(screen.queryByText('My Tasks')).toBeNull();
      expect(mockGetTaskList.mock.calls[0][0].scope).toBe('own');
    });
  });

  describe('Given the caller holds crm_tasks.view_team only', () => {
    it('When the page loads / Then My and Team tabs render but not All, and Team refetches with scope team', async () => {
      await withPermissions(['activities.create', 'crm_tasks.view_team']);
      renderPage();
      await loaded();
      expect(screen.getByText('My Tasks')).toBeInTheDocument();
      expect(screen.getByText('Team Tasks')).toBeInTheDocument();
      expect(screen.queryByText('All Tasks')).toBeNull();
      await userEvent.click(screen.getByText('Team Tasks'));
      await waitFor(() => expect(lastParams().scope).toBe('team'));
      expect(loc()).toBe('/tasks?scope=team');
    });
  });

  describe('Given the caller holds crm_tasks.view_all only', () => {
    it('When the page loads / Then All renders but not Team, and All refetches with scope all', async () => {
      await withPermissions(['activities.create', 'crm_tasks.view_all']);
      renderPage();
      await loaded();
      expect(screen.queryByText('Team Tasks')).toBeNull();
      await userEvent.click(screen.getByText('All Tasks'));
      await waitFor(() => expect(lastParams().scope).toBe('all'));
    });
  });

  describe('Given the caller can see all three tabs', () => {
    it('When switching tab / Then the assignee filter is reset and My Tasks refetches with own', async () => {
      await withPermissions(['activities.create', 'crm_tasks.view_team', 'crm_tasks.view_all']);
      renderPage('/tasks?scope=all&assignee=user-2');
      await loaded();
      expect(lastParams().assignee_id).toBe('user-2');
      await userEvent.click(screen.getByText('My Tasks'));
      await waitFor(() => expect(lastParams().scope).toBe('own'));
      expect(lastParams()).not.toHaveProperty('assignee_id');
    });
  });
});

describe('TasksPage - permissions on actions', () => {
  describe('Given flags are not loaded yet', () => {
    it('When rendered / Then there is no Create Task button and no delete buttons', async () => {
      await withPermissions(['activities.create'], { effectiveFlagsLoaded: false, isFeatureEnabled: () => false });
      renderPage();
      await loaded();
      expect(screen.queryByText('Create Task')).toBeNull();
      expect(screen.queryAllByTitle('Delete task')).toHaveLength(0);
    });
  });

  describe('Given the caller can create tasks', () => {
    it('When rendered / Then Create Task and delete buttons show', async () => {
      renderPage();
      await loaded();
      expect(screen.getByText('Create Task')).toBeInTheDocument();
      expect(screen.getAllByTitle('Delete task').length).toBeGreaterThan(0);
    });

    it('When a task is created in the modal / Then the list reloads and the modal closes', async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByText('Create Task'));
      const before = mockGetTaskList.mock.calls.length;
      await userEvent.click(screen.getByText('save-task'));
      await waitFor(() => expect(mockGetTaskList.mock.calls.length).toBe(before + 1));
      expect(screen.queryByTestId('task-modal')).toBeNull();
    });

    it('When the modal is dismissed / Then it closes without reloading', async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByText('Create Task'));
      await userEvent.click(screen.getByText('close-modal'));
      expect(screen.queryByTestId('task-modal')).toBeNull();
    });
  });
});

describe('TasksPage - row actions', () => {
  describe('Given a task row', () => {
    it('When it is clicked / Then the detail page opens', async () => {
      renderPage();
      await loaded();
      await userEvent.click(screen.getByTestId('task-row-over1'));
      expect(screen.getByTestId('detail')).toBeInTheDocument();
    });

    it('When the circle is clicked / Then the task is marked DONE and the list refreshes', async () => {
      renderPage();
      await loaded();
      const before = mockGetTaskList.mock.calls.length;
      await userEvent.click(within(screen.getByTestId('task-row-over1')).getByLabelText('Mark task done'));
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('over1', { status: 'DONE' }));
      await waitFor(() => expect(mockGetTaskList.mock.calls.length).toBe(before + 1));
      expect(screen.getByText('Task over1')).toBeInTheDocument(); // not blanked by a skeleton while refreshing
    });

    it('When a done task is reopened / Then it goes back to OPEN', async () => {
      renderPage();
      await loaded();
      await userEvent.click(within(section('done')).getByRole('button', { name: /Done/ }));
      await userEvent.click(within(screen.getByTestId('task-row-done1')).getByLabelText('Reopen task'));
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('done1', { status: 'OPEN' }));
    });

    it('When the status select changes / Then the update is sent', async () => {
      renderPage();
      await loaded();
      const select = within(screen.getByTestId('task-row-today1')).getByDisplayValue('OPEN');
      await userEvent.selectOptions(select, 'IN_PROGRESS');
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('today1', { status: 'IN_PROGRESS' }));
    });

    it('When the status update fails / Then the error is logged and the page survives', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUpdateTask.mockRejectedValue(new Error('no'));
      renderPage();
      await loaded();
      await userEvent.click(within(screen.getByTestId('task-row-over1')).getByLabelText('Mark task done'));
      await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to update task status', expect.any(Error)));
      expect(screen.getByTestId('task-row-over1')).toBeInTheDocument();
      spy.mockRestore();
    });
  });

  describe('Given the assignee cell', () => {
    it('When another user is picked / Then the assignee is updated', async () => {
      renderPage();
      await loaded();
      const select = within(screen.getByTestId('task-row-over1')).getByDisplayValue(/Test User/);
      await userEvent.selectOptions(select, 'user-2');
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('over1', { assignee_id: 'user-2' }));
    });

    it('When an unknown user id is chosen / Then nothing is sent', async () => {
      renderPage();
      await loaded();
      const select = within(screen.getByTestId('task-row-over1')).getByDisplayValue(/Test User/);
      fireEvent.change(select, { target: { value: 'ghost' } });
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it('When the assignee update fails / Then the error is logged', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUpdateTask.mockRejectedValue(new Error('no'));
      renderPage();
      await loaded();
      await userEvent.selectOptions(within(screen.getByTestId('task-row-over1')).getByDisplayValue(/Test User/), 'user-2');
      await waitFor(() => expect(spy).toHaveBeenCalledWith('Failed to update task assignee', expect.any(Error)));
      spy.mockRestore();
    });

    it('When a task is assigned to someone else / Then "Assign to me" assigns it to the caller', async () => {
      const toastSpy = vi.spyOn(toast, 'success');
      renderPage();
      await loaded();
      await userEvent.click(within(screen.getByTestId('task-row-up1')).getByTitle('Assign to me'));
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('up1', { assignee_id: 'user-1' }));
      expect(toastSpy).toHaveBeenCalledWith('Task assigned to you');
    });

    it('When "Assign to me" fails / Then an error toast shows', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const toastSpy = vi.spyOn(toast, 'error');
      mockUpdateTask.mockRejectedValue(new Error('no'));
      renderPage();
      await loaded();
      await userEvent.click(within(screen.getByTestId('task-row-up1')).getByTitle('Assign to me'));
      await waitFor(() => expect(toastSpy).toHaveBeenCalledWith('Failed to assign task to yourself'));
      spy.mockRestore();
    });

    it('When the caller is not in the org user list / Then assigning to themselves is refused', async () => {
      mockGetUsers.mockResolvedValue([{ id: 'user-2', full_name: 'Other User' }]);
      const toastSpy = vi.spyOn(toast, 'error');
      renderPage();
      await loaded();
      const btn = within(screen.getByTestId('task-row-up1')).getByTitle("You don't have permission to be assigned tasks");
      expect(btn).toBeDisabled();
      expect(toastSpy).not.toHaveBeenCalled();
    });
  });

  describe('Given a completed task (read-only)', () => {
    it('When the assignee cell renders / Then the select is disabled with the locked hint and Assign-to-me is disabled', async () => {
      renderPage();
      await loaded();
      await userEvent.click(within(section('done')).getByRole('button', { name: /Done/ }));
      const row = screen.getByTestId('task-row-done1');
      const select = within(row).getByDisplayValue(/Other User/);
      expect(select).toBeDisabled();
      expect(select).toHaveAttribute('title', expect.stringContaining('read-only'));
      const assignBtn = within(row).getAllByTitle(/read-only/).find(el => el.tagName === 'BUTTON');
      expect(assignBtn).toBeDisabled();
    });

    it('When the assignee is changed anyway / Then a warning shows and nothing is sent', async () => {
      const toastSpy = vi.spyOn(toast, 'warning');
      renderPage();
      await loaded();
      await userEvent.click(within(section('done')).getByRole('button', { name: /Done/ }));
      const select = within(screen.getByTestId('task-row-done1')).getByDisplayValue(/Other User/);
      fireEvent.change(select, { target: { value: 'user-1' } });
      expect(mockUpdateTask).not.toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalled();
    });
  });

  describe('Given the delete flow', () => {
    it('When delete is confirmed / Then the task is deleted and the list reloads', async () => {
      renderPage();
      await loaded();
      const before = mockGetTaskList.mock.calls.length;
      await userEvent.click(within(screen.getByTestId('task-row-over1')).getByTitle('Delete task'));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(mockDeleteTask).toHaveBeenCalledWith('over1'));
      await waitFor(() => expect(mockGetTaskList.mock.calls.length).toBe(before + 1));
      expect(screen.queryByText('Delete Task')).toBeNull();
    });

    it('When delete fails / Then the error message shows', async () => {
      mockDeleteTask.mockRejectedValue(new Error('Cannot delete'));
      renderPage();
      await loaded();
      await userEvent.click(within(screen.getByTestId('task-row-over1')).getByTitle('Delete task'));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.getByText(/Cannot delete/)).toBeInTheDocument());
    });

    it('When delete fails without a message / Then a generic message shows', async () => {
      mockDeleteTask.mockRejectedValue({});
      renderPage();
      await loaded();
      await userEvent.click(within(screen.getByTestId('task-row-over1')).getByTitle('Delete task'));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.getByText(/Failed to delete task/)).toBeInTheDocument());
    });

    it('When cancel is clicked / Then the dialog closes', async () => {
      renderPage();
      await loaded();
      await userEvent.click(within(screen.getByTestId('task-row-over1')).getByTitle('Delete task'));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText('Delete Task')).toBeNull();
      expect(mockDeleteTask).not.toHaveBeenCalled();
    });
  });
});

describe('TasksPage - request ordering', () => {
  describe('Given a slow response for an outdated query', () => {
    it('When filters change before it returns / Then the stale response is ignored', async () => {
      let resolveFirst: (v: any) => void = () => {};
      mockGetTaskList.mockReturnValueOnce(new Promise(r => { resolveFirst = r; }));
      renderPage();
      await waitFor(() => expect(mockGetTaskList).toHaveBeenCalledTimes(1));
      mockGetTaskList.mockResolvedValueOnce(response({ items: [mk('fresh', { list_bucket: 'no_due' })], total: 1 }));
      await userEvent.click(counter(/No due date/));
      await waitFor(() => expect(screen.getByTestId('task-row-fresh')).toBeInTheDocument());
      resolveFirst(response());
      await new Promise(r => setTimeout(r, 20));
      expect(screen.queryByTestId('task-row-over1')).toBeNull();
      expect(screen.getByTestId('task-row-fresh')).toBeInTheDocument();
    });

    it('When the stale request fails after a newer one started / Then no error is shown', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let rejectFirst: (e: any) => void = () => {};
      mockGetTaskList.mockReturnValueOnce(new Promise((_r, rej) => { rejectFirst = rej; }));
      renderPage();
      await waitFor(() => expect(mockGetTaskList).toHaveBeenCalledTimes(1));
      await userEvent.click(counter(/Overdue/));
      await waitFor(() => expect(screen.getByTestId('task-row-over1')).toBeInTheDocument());
      rejectFirst(new Error('late'));
      await new Promise(r => setTimeout(r, 20));
      expect(screen.queryByText(/Failed to load tasks/)).toBeNull();
      spy.mockRestore();
    });
  });
});
