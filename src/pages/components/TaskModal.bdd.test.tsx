import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// Mutable so individual tests can override (e.g. null user scenario).
let mockCurrentUser: any = { id: 'u1', full_name: 'Test User', email: 'test@test.com' };

const mockGetUsers = vi.fn();
const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockRecordActivity = vi.fn();
const mockShowError = vi.hoisted(() => vi.fn());
const mockEmitNotification = vi.fn();
const mockGetLeads = vi.fn();
const mockGetDeals = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getUsers: (...a: any[]) => mockGetUsers(...a),
    createTask: (...a: any[]) => mockCreateTask(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getDeals: (...a: any[]) => mockGetDeals(...a),
  },
}));

vi.mock('@so360/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@so360/design-system')>();
  return {
    ...actual,
    toast: { ...actual.toast, error: mockShowError },
  };
});

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useShell: () => ({ user: mockCurrentUser }),
  useNotify: () => ({ emitNotification: (...a: any[]) => mockEmitNotification(...a) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useQuota: () => ({
    quotas: [], isLoading: false, error: null,
    isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {},
  }),
}));

vi.mock('../../utils/taskUtils', () => ({
  canCurrentUserBeAssigned: () => true,
}));

import TaskModal from './TaskModal';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USERS = [
  { id: 'u1', full_name: 'Test User',  email: 'test@test.com',  avatar_url: null },
  { id: 'u2', full_name: 'Other User', email: 'other@test.com', avatar_url: null },
];

const futureDate     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const futureDatetime = `${futureDate}T10:00`;
const pastDate       = '2020-01-01';

const BASE_TASK = {
  id: 't1',
  title: 'Follow up call',
  description: 'Some details',
  status: 'OPEN' as const,
  due_date: futureDate,
  type: 'TODO' as const,
  assigned_to: { id: 'u1', full_name: 'Test User', email: 'test@test.com', avatar_url: '' },
};

// ── DOM helpers ───────────────────────────────────────────────────────────────
// Called lazily so they reflect current DOM state after re-renders.
const dateInputs    = () => document.querySelectorAll('input[type="date"]');
const startInput    = () => dateInputs()[0] as HTMLInputElement;
const dueInput      = () => (dateInputs()[1] ?? dateInputs()[0]) as HTMLInputElement;
const datetimeInput = () => document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
// The Priority select is filtered out so the positional index map below stays
// stable as fields are added around it — see prioritySelect() for that field.
const selects       = () =>
  Array.from(document.querySelectorAll('select')).filter(
    (el) => !Array.from(el.options).some((o) => o.value === 'urgent'),
  );
const prioritySelect = () =>
  Array.from(document.querySelectorAll('select')).find((el) =>
    Array.from(el.options).some((o) => o.value === 'urgent'),
  ) as HTMLSelectElement;
// select indices in create/TODO mode: [0]=type, [1]=assignee
// select indices in REMINDER mode:    [0]=type, [1]=reminderMinutes, [2]=assignee
// select indices in edit/TODO mode:   [0]=type, [1]=assignee, [2]=status

const MOCK_LEADS = [
  { id: 'lead-1', company_name: 'Acme Corp', contact_name: 'Alice' },
  { id: 'lead-2', company_name: '',           contact_name: 'Bob Smith' },
];
const MOCK_DEALS = [
  { id: 'deal-1', name: 'Enterprise Deal', company_name: 'Acme Corp' },
  { id: 'deal-2', name: '',                company_name: 'Beta Ltd' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockCurrentUser = { id: 'u1', full_name: 'Test User', email: 'test@test.com' };
  mockGetUsers.mockResolvedValue(USERS);
  mockCreateTask.mockResolvedValue({ id: 't-new', title: 'New Task', status: 'OPEN' });
  mockUpdateTask.mockResolvedValue({ id: 't1', title: 'Updated', status: 'OPEN' });
  mockRecordActivity.mockResolvedValue(undefined);
  mockEmitNotification.mockResolvedValue(undefined);
  mockGetLeads.mockResolvedValue(MOCK_LEADS);
  mockGetDeals.mockResolvedValue(MOCK_DEALS);
});

// ─────────────────────────────────────────────────────────────────────────────

describe('TaskModal', () => {

  // ── Desktop layout: overlay must stack above the shell NavBar ──────────────
  // Regression: the New Task modal was clipped under the global header because
  // its overlay sat at z-50, below the sticky shell NavBar (.glass-nav, z-500).
  // The overlay must paint on top of the header — z-[600] — and stay centered.
  describe('Given a desktop viewport (overlay stacking)', () => {
    it('When rendered / Then the overlay paints above the NavBar (z-[600], not z-50)', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(screen.getByText('New Task')).toBeInTheDocument());
      const overlay = document.querySelector('div.fixed.inset-0') as HTMLElement;
      expect(overlay).toBeTruthy();
      expect(overlay.className).toContain('z-[600]');
      expect(overlay.className).not.toContain('z-50');
    });

    it('When rendered / Then the overlay centers the modal in the viewport', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(screen.getByText('New Task')).toBeInTheDocument());
      const overlay = document.querySelector('div.fixed.inset-0') as HTMLElement;
      expect(overlay.className).toContain('items-center');
      expect(overlay.className).toContain('justify-center');
    });
  });

  // ── Create mode: rendering ────────────────────────────────────────────────
  describe('Given no existing task (create mode)', () => {
    it('When rendered / Then shows "New Task" header', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(screen.getByText('New Task')).toBeInTheDocument());
    });

    it('When rendered / Then shows the task title input', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(screen.getByPlaceholderText(/follow up/i)).toBeInTheDocument());
    });

    it('When rendered / Then Start Date and Due Date appear as sibling date inputs', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/start date/i)).toBeInTheDocument();
        expect(screen.getByText(/due date/i)).toBeInTheDocument();
        expect(dateInputs()).toHaveLength(2);
      });
    });

    it('When rendered / Then Type is its own standalone field', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/^type$/i)).toBeInTheDocument());
      // Type select is present as the first select in the form
      expect(selects()[0]).toBeInTheDocument();
    });

    it('When rendered / Then Status field is hidden', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      expect(screen.queryByText(/^status$/i)).not.toBeInTheDocument();
    });

    it('When rendered / Then Reminder dropdown is hidden', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      expect(screen.queryByText(/remind me before/i)).not.toBeInTheDocument();
    });

    it('When rendered / Then Assign to Me button is disabled (auto-assigned to self)', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() =>
        expect(screen.getByTitle(/already assigned to you/i)).toBeInTheDocument()
      );
    });
  });

  // ── Edit mode: rendering ──────────────────────────────────────────────────
  describe('Given an existing task (edit mode)', () => {
    it('When rendered / Then shows "Edit Task" header and pre-fills title', async () => {
      render(<TaskModal task={BASE_TASK as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('Edit Task')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Follow up call')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the Status field', async () => {
      render(<TaskModal task={BASE_TASK as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/^status$/i)).toBeInTheDocument());
    });

    it('When task has start_date / Then Start Date input is pre-filled', async () => {
      const task = { ...BASE_TASK, start_date: '2025-06-01T00:00:00.000Z' };
      render(<TaskModal task={task as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(startInput().value).toBe('2025-06-01'));
    });

    it('When task has no start_date / Then Start Date input is empty', async () => {
      render(<TaskModal task={BASE_TASK as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(startInput().value).toBe(''));
    });

    it('When task has no due_date / Then Due Date input is empty', async () => {
      const task = { ...BASE_TASK, due_date: undefined };
      render(<TaskModal task={task as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(dueInput().value).toBe(''));
    });

    it('When task type is REMINDER / Then due_date renders as datetime-local input', async () => {
      const task = {
        ...BASE_TASK,
        type: 'REMINDER' as const,
        due_date: '2025-08-15T10:30:00.000Z',
        reminder_minutes_before: 30,
      };
      render(<TaskModal task={task as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(datetimeInput()).toBeTruthy();
        expect(datetimeInput().value).toContain('2025-08-15T');
      });
    });
  });

  // ── Type selector behaviour ───────────────────────────────────────────────
  describe('Given the user changes the task type', () => {
    it('When changed to REMINDER / Then shows "Date & Time" label, datetime-local input and reminder dropdown', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });
      expect(screen.getByText(/date & time/i)).toBeInTheDocument();
      expect(datetimeInput()).toBeInTheDocument();
      expect(screen.getByText(/remind me before/i)).toBeInTheDocument();
    });

    it('When changed back from REMINDER / Then shows "Due Date" label and date input, hides reminder dropdown', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });
      fireEvent.change(selects()[0], { target: { value: 'CALL' } });
      expect(screen.getByText(/due date/i)).toBeInTheDocument();
      expect(dateInputs()).toHaveLength(2);
      expect(screen.queryByText(/remind me before/i)).not.toBeInTheDocument();
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────
  describe('Given form validation', () => {
    it('When submitted with no due date / Then shows error and blocks API call', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      // due date intentionally left empty
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith('Please select a due date.')
      );
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('When submitted with a past date-only due date / Then shows past-date error and blocks API call', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: pastDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith(
          'Due Date cannot be in the past. Please select today or a future date.'
        )
      );
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('When REMINDER type with a past datetime / Then past-date branch handles T-format string and blocks', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(datetimeInput(), { target: { value: '2020-01-01T10:00' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith(
          'Due Date cannot be in the past. Please select today or a future date.'
        )
      );
    });
  });

  // ── Create submission: all branches ───────────────────────────────────────
  describe('Given the form is submitted in create mode', () => {
    it('When submitted with title and future due date / Then calls createTask', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Call client' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    });

    it('When leadId provided / Then payload includes lead_id', async () => {
      render(<TaskModal leadId="lead-123" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ lead_id: 'lead-123' }))
      );
    });

    it('When no priority is chosen / Then the payload defaults to medium', async () => {
      render(<TaskModal leadId="lead-123" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ priority: 'medium' }))
      );
    });

    it('When a priority is chosen / Then it reaches the create payload', async () => {
      // Regression: tasks had no priority column, so a chosen priority was
      // silently discarded and every task read back as 'medium'.
      render(<TaskModal leadId="lead-123" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.change(prioritySelect(), { target: { value: 'urgent' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ priority: 'urgent' }))
      );
    });

    it('When editing a task / Then its stored priority preloads into the selector', async () => {
      render(<TaskModal task={{ ...BASE_TASK, priority: 'high' } as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      expect(prioritySelect().value).toBe('high');
    });

    it('When dealId provided / Then payload includes deal_id', async () => {
      render(<TaskModal dealId="deal-456" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ deal_id: 'deal-456' }))
      );
    });

    it('When start_date is filled / Then payload includes start_date ISO string', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(startInput(), { target: { value: futureDate } });
      fireEvent.change(dueInput(),   { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ start_date: expect.any(String) })
        )
      );
    });

    it('When start_date is empty / Then payload excludes start_date', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        const payload = mockCreateTask.mock.calls[0][0];
        expect(payload).not.toHaveProperty('start_date');
      });
    });

    it('When description is entered / Then payload includes description', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i),  { target: { value: 'Task' } });
      fireEvent.change(screen.getByPlaceholderText(/add details/i), { target: { value: 'My description' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'My description' })
        )
      );
    });

    it('When REMINDER type with reminderMinutes set / Then payload includes reminder_minutes_before', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Reminder task' } });
      fireEvent.change(datetimeInput(), { target: { value: futureDatetime } });
      // selects after REMINDER: [type=0, reminderMinutes=1, assignee=2]
      fireEvent.change(selects()[1], { target: { value: '30' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'REMINDER', reminder_minutes_before: 30 })
        )
      );
    });

    it('When REMINDER type with no reminderMinutes / Then payload excludes reminder_minutes_before', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Reminder task' } });
      fireEvent.change(datetimeInput(), { target: { value: futureDatetime } });
      // leave reminderMinutes as default ''
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        const payload = mockCreateTask.mock.calls[0][0];
        expect(payload).not.toHaveProperty('reminder_minutes_before');
      });
    });

    it('When assigned to another user / Then emits task-assigned notification', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      // selects in TODO mode: [type=0, assignee=1]
      fireEvent.change(selects()[1], { target: { value: 'u2' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(mockEmitNotification).toHaveBeenCalled());
    });

    it('When assigned to self / Then does NOT emit notification', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      // u1 is auto-assigned (current user) — no change needed
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
      expect(mockEmitNotification).not.toHaveBeenCalled();
    });

    it('When submitted successfully / Then records task.created activity, calls onSuccess and onClose', async () => {
      const onClose = vi.fn();
      const onSuccess = vi.fn();
      render(<TaskModal leadId="lead-1" onClose={onClose} onSuccess={onSuccess} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockRecordActivity).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'task.created' })
        );
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('When API throws / Then shows error toast and does not call onSuccess', async () => {
      mockCreateTask.mockRejectedValue(new Error('Network error'));
      const onSuccess = vi.fn();
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={onSuccess} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Failed to save task'));
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  // ── Edit submission ───────────────────────────────────────────────────────
  describe('Given the form is submitted in edit mode', () => {
    it('When submitted / Then calls updateTask (not createTask)', async () => {
      render(<TaskModal task={BASE_TASK as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByDisplayValue('Follow up call'));
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalled();
        expect(mockCreateTask).not.toHaveBeenCalled();
      });
    });

    it('When submitted / Then records task.updated activity', async () => {
      render(<TaskModal task={BASE_TASK as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByDisplayValue('Follow up call'));
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockRecordActivity).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'task.updated' })
        )
      );
    });

    it('When status is changed / Then submits with the new status value', async () => {
      render(<TaskModal task={BASE_TASK as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByDisplayValue('Open'));
      fireEvent.change(screen.getByDisplayValue('Open'), { target: { value: 'DONE' } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockUpdateTask).toHaveBeenCalledWith(
          't1', expect.objectContaining({ status: 'DONE' })
        )
      );
    });

    it('When API throws / Then shows error toast and does not call onSuccess', async () => {
      mockUpdateTask.mockRejectedValue(new Error('Server error'));
      const onSuccess = vi.fn();
      render(<TaskModal task={BASE_TASK as any} onClose={vi.fn()} onSuccess={onSuccess} />);
      await waitFor(() => screen.getByDisplayValue('Follow up call'));
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Failed to save task'));
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  // ── Assign to Me ──────────────────────────────────────────────────────────
  describe('Given the Assign to Me button', () => {
    it('When clicked while a different user is selected / Then reassigns to current user', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      // Change assignee to u2 first
      fireEvent.change(selects()[1], { target: { value: 'u2' } });
      await waitFor(() => screen.getByTitle(/assign this task to yourself/i));
      fireEvent.click(screen.getByTitle(/assign this task to yourself/i));
      await waitFor(() =>
        expect(screen.getByTitle(/already assigned to you/i)).toBeInTheDocument()
      );
    });

    it('When currentUser has no id / Then button is marked unavailable and handler returns early (no state change)', async () => {
      mockCurrentUser = null;
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByTitle(/user session not available/i));
      fireEvent.click(screen.getByTitle(/user session not available/i));
      // No state change — title stays the same
      expect(screen.getByTitle(/user session not available/i)).toBeInTheDocument();
    });
  });

  // ── fetchUsers fallback ───────────────────────────────────────────────────
  describe('Given the users API returns an empty array', () => {
    it('When current user is available / Then falls back to current user in the assignee list', async () => {
      mockGetUsers.mockResolvedValue([]);
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/test user/i)).toBeInTheDocument());
    });
  });

  // ── Viewport height fix ───────────────────────────────────────────────────
  describe('Given the modal renders in a constrained viewport (height fix)', () => {
    it('When rendered / Then the modal container has max-h-[90vh] class to stay within viewport', async () => {
      const { container } = render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      // The inner modal div (not the overlay) must have the height constraint
      const modalBox = container.querySelector('[class*="max-h-\\[90vh\\]"]');
      expect(modalBox).not.toBeNull();
    });

    it('When rendered / Then the modal container has overflow-hidden to enforce the max-height clipping', async () => {
      const { container } = render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      // overflow-hidden must live on the same element as max-h-[90vh] so that flex
      // children cannot push the container past the viewport height cap.
      const modalBox = container.querySelector('[class*="max-h-\\[90vh\\]"]');
      expect(modalBox).not.toBeNull();
      expect(modalBox!.className).toContain('overflow-hidden');
    });

    it('When rendered / Then the scrollable content area has overflow-y-auto to allow internal scrolling', async () => {
      const { container } = render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      const scrollableArea = container.querySelector('[class*="overflow-y-auto"]');
      expect(scrollableArea).not.toBeNull();
    });

    it('When rendered / Then Cancel and Create Task buttons are accessible without scrolling (in fixed footer)', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
    });
  });

  // ── Close / cancel ────────────────────────────────────────────────────────
  describe('Given the user wants to close the modal', () => {
    it('When Cancel button is clicked / Then calls onClose', async () => {
      const onClose = vi.fn();
      render(<TaskModal leadId="lead-1" onClose={onClose} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
    });

    it('When X (header close) button is clicked / Then calls onClose', async () => {
      const onClose = vi.fn();
      render(<TaskModal leadId="lead-1" onClose={onClose} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      // X button is the first button rendered (header); no accessible name (SVG only)
      fireEvent.click(screen.getAllByRole('button')[0]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── Associate With picker ─────────────────────────────────────────────────
  describe('Given the Associate With picker', () => {
    it('When no leadId/dealId and not editing / Then shows "Associate With" section', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/associate with/i)).toBeInTheDocument());
    });

    it('When leadId prop is provided / Then hides "Associate With" section', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      expect(screen.queryByText(/associate with/i)).not.toBeInTheDocument();
    });

    it('When dealId prop is provided / Then hides "Associate With" section', async () => {
      render(<TaskModal dealId="deal-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      expect(screen.queryByText(/associate with/i)).not.toBeInTheDocument();
    });

    it('When editing an existing task / Then hides "Associate With" section', async () => {
      render(<TaskModal task={BASE_TASK as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('Edit Task'));
      expect(screen.queryByText(/associate with/i)).not.toBeInTheDocument();
    });

    it('When type set to Lead / Then second select shows lead options from API', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      // associate type select is the last select rendered after type + assignee selects
      const allSelects = document.querySelectorAll('select');
      // find the one with "None / Lead / Deal" options
      const typeSelect = Array.from(allSelects).find(s =>
        Array.from(s.options).some(o => o.value === 'lead')
      )!;
      fireEvent.change(typeSelect, { target: { value: 'lead' } });
      await waitFor(() =>
        expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      );
    });

    it('When type set to Deal / Then second select shows deal options from API', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      const allSelects = document.querySelectorAll('select');
      const typeSelect = Array.from(allSelects).find(s =>
        Array.from(s.options).some(o => o.value === 'deal')
      )!;
      fireEvent.change(typeSelect, { target: { value: 'deal' } });
      await waitFor(() =>
        expect(screen.getByText('Enterprise Deal')).toBeInTheDocument()
      );
    });

    it('When lead with empty company_name / Then shows contact_name as label', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      const allSelects = document.querySelectorAll('select');
      const typeSelect = Array.from(allSelects).find(s =>
        Array.from(s.options).some(o => o.value === 'lead')
      )!;
      fireEvent.change(typeSelect, { target: { value: 'lead' } });
      await waitFor(() =>
        expect(screen.getByText('Bob Smith')).toBeInTheDocument()
      );
    });

    it('When deal with empty name / Then shows company_name as label', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      const allSelects = document.querySelectorAll('select');
      const typeSelect = Array.from(allSelects).find(s =>
        Array.from(s.options).some(o => o.value === 'deal')
      )!;
      fireEvent.change(typeSelect, { target: { value: 'deal' } });
      await waitFor(() =>
        expect(screen.getByText('Beta Ltd')).toBeInTheDocument()
      );
    });

    it('When changing type from Lead to Deal / Then resets the entity select', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      const allSelects = document.querySelectorAll('select');
      const typeSelect = Array.from(allSelects).find(s =>
        Array.from(s.options).some(o => o.value === 'lead')
      )!;
      fireEvent.change(typeSelect, { target: { value: 'lead' } });
      await waitFor(() => screen.getByText('Acme Corp'));
      fireEvent.change(typeSelect, { target: { value: 'deal' } });
      await waitFor(() => screen.getByText('Enterprise Deal'));
      expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    });

    it('When lead associated and form submitted / Then payload includes lead_id', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      const allSelects = () => document.querySelectorAll('select');
      const typeSelect = Array.from(allSelects()).find(s =>
        Array.from(s.options).some(o => o.value === 'lead')
      )!;
      fireEvent.change(typeSelect, { target: { value: 'lead' } });
      await waitFor(() => screen.getByText('Acme Corp'));
      const entitySelect = Array.from(allSelects()).find(s =>
        Array.from(s.options).some(o => o.value === 'lead-1')
      )!;
      fireEvent.change(entitySelect, { target: { value: 'lead-1' } });
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ lead_id: 'lead-1' })
        )
      );
    });

    it('When deal associated and form submitted / Then payload includes deal_id', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      const allSelects = () => document.querySelectorAll('select');
      const typeSelect = Array.from(allSelects()).find(s =>
        Array.from(s.options).some(o => o.value === 'deal')
      )!;
      fireEvent.change(typeSelect, { target: { value: 'deal' } });
      await waitFor(() => screen.getByText('Enterprise Deal'));
      const entitySelect = Array.from(allSelects()).find(s =>
        Array.from(s.options).some(o => o.value === 'deal-1')
      )!;
      fireEvent.change(entitySelect, { target: { value: 'deal-1' } });
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() =>
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ deal_id: 'deal-1' })
        )
      );
    });

    it('When associateType is None / Then payload excludes lead_id and deal_id', async () => {
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Task' } });
      fireEvent.change(dueInput(), { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        const payload = mockCreateTask.mock.calls[0][0];
        expect(payload).not.toHaveProperty('lead_id');
        expect(payload).not.toHaveProperty('deal_id');
      });
    });

    it('When getLeads API fails / Then falls back to empty list and picker still renders', async () => {
      mockGetLeads.mockRejectedValue(new Error('Network'));
      mockGetDeals.mockRejectedValue(new Error('Network'));
      render(<TaskModal onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText(/associate with/i));
      const allSelects = document.querySelectorAll('select');
      const typeSelect = Array.from(allSelects).find(s =>
        Array.from(s.options).some(o => o.value === 'lead')
      )!;
      fireEvent.change(typeSelect, { target: { value: 'lead' } });
      // entity select renders with just the placeholder option
      await waitFor(() =>
        expect(screen.getByText(/select lead/i)).toBeInTheDocument()
      );
    });
  });
});

// ── Reminder time preservation ────────────────────────────────────────────────
// Regression cover for "every reminder card shows 12:00 AM".
describe('Given a reminder is being scheduled', () => {
  it('When a date is picked as a To Do and the Type is then switched to Reminder / Then the value gains a time instead of submitting as midnight', async () => {
    render(<TaskModal onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());

    // Pick the date first, while the Type is still the default To Do.
    fireEvent.change(dueInput(), { target: { value: futureDate } });
    // Now switch to Reminder — this used to leave a bare YYYY-MM-DD in state.
    fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });

    await waitFor(() => expect(datetimeInput()).toBeTruthy());
    expect(datetimeInput().value).toBe(`${futureDate}T09:00`);
  });

  it('When the Type is switched back from Reminder to To Do / Then the time is dropped so the date input can display it', async () => {
    render(<TaskModal onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());

    fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });
    await waitFor(() => expect(datetimeInput()).toBeTruthy());
    fireEvent.change(datetimeInput(), { target: { value: futureDatetime } });

    fireEvent.change(selects()[0], { target: { value: 'TODO' } });
    await waitFor(() => expect(datetimeInput()).toBeFalsy());
    expect(dueInput().value).toBe(futureDate);
  });

  it('When a reminder is saved at 10:00 / Then the persisted instant carries that wall clock, not midnight', async () => {
    render(<TaskModal onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/follow up email/i), { target: { value: 'Call back' } });
    fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });
    await waitFor(() => expect(datetimeInput()).toBeTruthy());
    fireEvent.change(datetimeInput(), { target: { value: futureDatetime } });

    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
    const payload = mockCreateTask.mock.calls[0][0];
    const saved = new Date(payload.due_date);
    expect(saved.toISOString()).toBe(new Date(`${futureDate}T10:00:00`).toISOString());
    expect(saved.getHours()).toBe(10);
    expect(saved.getMinutes()).toBe(0);
  });

  it('When an existing reminder is reopened for edit / Then the editor shows the local wall clock it was saved with', async () => {
    const savedInstant = new Date(`${futureDate}T10:00:00`).toISOString();
    render(
      <TaskModal
        task={{ ...BASE_TASK, type: 'REMINDER', due_date: savedInstant } as any}
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    await waitFor(() => expect(datetimeInput()).toBeTruthy());
    expect(datetimeInput().value).toBe(futureDatetime);
  });

  it('When an existing reminder is saved again without touching the time / Then the instant does not drift', async () => {
    const savedInstant = new Date(`${futureDate}T10:00:00`).toISOString();
    render(
      <TaskModal
        task={{ ...BASE_TASK, type: 'REMINDER', due_date: savedInstant } as any}
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    );
    await waitFor(() => expect(datetimeInput()).toBeTruthy());

    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
    expect(mockUpdateTask.mock.calls[0][1].due_date).toBe(savedInstant);
  });

  it('When a REMINDER somehow reaches submit with no time / Then it is rejected rather than stored at midnight', async () => {
    render(<TaskModal onClose={() => {}} onSuccess={() => {}} />);
    await waitFor(() => expect(mockGetUsers).toHaveBeenCalled());

    fireEvent.change(dueInput(), { target: { value: futureDate } });
    // Switch to REMINDER and strip the time back off, simulating stale state.
    fireEvent.change(selects()[0], { target: { value: 'REMINDER' } });
    await waitFor(() => expect(datetimeInput()).toBeTruthy());
    fireEvent.change(datetimeInput(), { target: { value: futureDate } });

    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    expect(mockCreateTask).not.toHaveBeenCalled();
  });
});
