import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetUsers = vi.fn();
const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockRecordActivity = vi.fn();

vi.mock('../../services/crmService', () => ({
  crmService: {
    getUsers: (...a: any[]) => mockGetUsers(...a),
    createTask: (...a: any[]) => mockCreateTask(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
  },
}));

vi.mock('../../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('@so360/shell-context', () => ({
  useShell: () => ({ user: { id: 'u1', full_name: 'Test User' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

vi.mock('../../utils/taskUtils', () => ({
  canCurrentUserBeAssigned: () => true,
}));

import TaskModal from './TaskModal';

const users = [
  { id: 'u1', full_name: 'Test User', email: 'test@test.com' },
  { id: 'u2', full_name: 'Other User', email: 'other@test.com' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUsers.mockResolvedValue(users);
  mockCreateTask.mockResolvedValue({ id: 't-new', title: 'New Task', status: 'OPEN' });
  mockUpdateTask.mockResolvedValue({ id: 't1', title: 'Updated', status: 'OPEN' });
  mockRecordActivity.mockResolvedValue(undefined);
});

describe('TaskModal', () => {
  describe('Given no existing task (create mode)', () => {
    it('When rendered / Then shows the New Task header', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText('New Task')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the title input field', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/follow up/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the Due Date field', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/due date/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the Assigned To field', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/assigned to/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the task type selector', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByText(/type/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the Assign to Me button', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByTitle(/assign this task to yourself|already assigned/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given an existing task (edit mode)', () => {
    const existingTask = {
      id: 't1',
      title: 'Follow up call',
      status: 'OPEN' as const,
      due_date: '2024-06-15',
      type: 'TODO' as const,
      assigned_to: { id: 'u1', full_name: 'Test User', email: 'test@test.com', avatar_url: '' },
    };

    it('When rendered / Then pre-fills the title from the existing task', async () => {
      render(<TaskModal task={existingTask as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => {
        expect(screen.getByDisplayValue('Follow up call')).toBeInTheDocument();
      });
    });
  });

  describe('Given the form is submitted in create mode', () => {
    it('When submitted with a title / Then calls createTask', async () => {
      render(<TaskModal leadId="lead-1" onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByPlaceholderText(/follow up/i));
      fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'Call client' } });
      const dateInputs = document.querySelectorAll('input[type="date"]');
      const dueDateInput = (dateInputs[1] || dateInputs[0]) as HTMLInputElement;
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (dueDateInput) fireEvent.change(dueDateInput, { target: { value: futureDate } });
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalled();
      });
    });
  });

  describe('Given the form is submitted in edit mode', () => {
    it('When submitted / Then calls updateTask', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const existingTask = {
        id: 't1', title: 'Existing', status: 'OPEN' as const,
        due_date: futureDate, type: 'TODO' as const,
        assigned_to: { id: 'u1', full_name: 'Test User', email: '', avatar_url: '' },
      };
      render(<TaskModal task={existingTask as any} onClose={vi.fn()} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByDisplayValue('Existing'));
      fireEvent.submit(document.querySelector('form')!);
      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalled();
      });
    });
  });

  describe('Given the user clicks Cancel', () => {
    it('When Cancel is clicked / Then calls onClose', async () => {
      const onClose = vi.fn();
      render(<TaskModal leadId="lead-1" onClose={onClose} onSuccess={vi.fn()} />);
      await waitFor(() => screen.getByText('New Task'));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
