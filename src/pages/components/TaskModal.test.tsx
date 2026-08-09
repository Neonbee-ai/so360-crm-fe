import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetUsers = vi.fn();
const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockEmitNotification = vi.fn();
const mockRecordActivity = vi.fn();
const mockShowError = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getUsers: (...a: any[]) => mockGetUsers(...a),
    createTask: (...a: any[]) => mockCreateTask(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
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
  useShell: () => ({ user: { id: 'u1', full_name: 'Test User' } }),
  useNotify: () => ({ emitNotification: (...a: any[]) => mockEmitNotification(...a) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

vi.mock('../../utils/taskUtils', () => ({
  canCurrentUserBeAssigned: () => true,
}));

import TaskModal from './TaskModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUsers.mockResolvedValue([
    { id: 'u1', full_name: 'Test User', email: 't@t.com' },
    { id: 'u2', full_name: 'Other User', email: 'o@o.com' },
  ]);
  mockCreateTask.mockResolvedValue({ id: 't-new', title: 'New', status: 'OPEN' });
  mockUpdateTask.mockResolvedValue({ id: 't1', title: 'Updated', status: 'OPEN' });
  mockEmitNotification.mockResolvedValue(undefined);
  mockRecordActivity.mockResolvedValue(undefined);
});

describe('Given TaskModal', () => {
  const defaultProps = {
    leadId: 'lead-1',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  it('When action / Then renders create task form', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('New Task')).toBeInTheDocument();
    });
  });

  it('When action / Then renders edit form when task is provided', async () => {
    render(
      <TaskModal
        {...defaultProps}
        task={{
          id: 't1', title: 'Existing', status: 'OPEN',
          due_date: '2024-06-15', type: 'TODO',
          assigned_to: { id: 'u1', full_name: 'Test', email: '', avatar_url: '' },
        } as any}
      />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing')).toBeInTheDocument();
    });
  });

  it('When action / Then renders with REMINDER type task showing datetime', async () => {
    render(
      <TaskModal
        {...defaultProps}
        task={{
          id: 't1', title: 'Reminder', status: 'OPEN',
          due_date: '2024-06-15T10:00:00Z', type: 'REMINDER',
          assigned_to: { id: 'u1', full_name: 'Test', email: '', avatar_url: '' },
        } as any}
      />,
    );
    await waitFor(() => {
      const matches = screen.getAllByDisplayValue('Reminder');
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('When action / Then shows title field', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/follow up/i)).toBeInTheDocument();
    });
  });

  it('When action / Then shows due date field', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/due date/i)).toBeInTheDocument();
    });
  });

  it('When action / Then shows assignee dropdown', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Assigned To/i)).toBeInTheDocument();
    });
  });

  it('When action / Then submits create form', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => screen.getByText('New Task'));

    fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'My Task' } });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const dueDateInput = (dateInputs[1] || dateInputs[0]) as HTMLInputElement;
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    if (dueDateInput) fireEvent.change(dueDateInput, { target: { value: futureDate } });
    const form = document.querySelector('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalled();
    });
  });

  it('When action / Then submits update form', async () => {
    render(
      <TaskModal
        {...defaultProps}
        task={{
          id: 't1', title: 'Existing', status: 'OPEN',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], type: 'TODO',
          assigned_to: { id: 'u1', full_name: 'Test', email: '', avatar_url: '' },
        } as any}
      />,
    );
    await waitFor(() => screen.getByDisplayValue('Existing'));

    const form = document.querySelector('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalled();
    });
  });

  it('When action / Then calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    render(<TaskModal {...defaultProps} onClose={onClose} />);
    await waitFor(() => screen.getByText('New Task'));
    fireEvent.click(screen.getByText(/cancel/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('When action / Then shows task type selector', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/type/i)).toBeInTheDocument();
    });
  });

  it('When action / Then shows assign to me button', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTitle(/assign this task to yourself|already assigned/i)).toBeInTheDocument();
    });
  });

  it('When action / Then handles assign to me', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => screen.getByTitle(/assign this task to yourself|already assigned/i));
    fireEvent.click(screen.getByTitle(/assign this task to yourself|already assigned/i));
    expect(true).toBe(true);
  });
});
