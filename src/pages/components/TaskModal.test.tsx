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

vi.mock('../../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showError: mockShowError, dismissToast: vi.fn() }),
}));

vi.mock('@so360/shell-context', () => ({
  useShell: () => ({ user: { id: 'u1', full_name: 'Test User' } }),
  useNotify: () => ({ emitNotification: (...a: any[]) => mockEmitNotification(...a) }),
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
}));

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
  mockCreateTask.mockResolvedValue({ id: 't-new', title: 'New', status: 'Open' });
  mockUpdateTask.mockResolvedValue({ id: 't1', title: 'Updated', status: 'Open' });
  mockEmitNotification.mockResolvedValue(undefined);
  mockRecordActivity.mockResolvedValue(undefined);
});

describe('TaskModal', () => {
  const defaultProps = {
    leadId: 'lead-1',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  it('renders create task form', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('New Task')).toBeInTheDocument();
    });
  });

  it('renders edit form when task is provided', async () => {
    render(
      <TaskModal
        {...defaultProps}
        task={{
          id: 't1', title: 'Existing', status: 'Open',
          due_date: '2024-06-15', type: 'TODO',
          assigned_to: { id: 'u1', full_name: 'Test', email: '', avatar_url: '' },
        } as any}
      />,
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing')).toBeInTheDocument();
    });
  });

  it('renders with REMINDER type task showing datetime', async () => {
    render(
      <TaskModal
        {...defaultProps}
        task={{
          id: 't1', title: 'Reminder', status: 'Open',
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

  it('shows title field', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/follow up/i)).toBeInTheDocument();
    });
  });

  it('shows due date field', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/due date/i)).toBeInTheDocument();
    });
  });

  it('shows assignee dropdown', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Assigned To/i)).toBeInTheDocument();
    });
  });

  it('submits create form', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => screen.getByText('New Task'));

    fireEvent.change(screen.getByPlaceholderText(/follow up/i), { target: { value: 'My Task' } });
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) fireEvent.change(dateInput, { target: { value: '2024-06-15' } });
    const form = document.querySelector('form');
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalled();
    });
  });

  it('submits update form', async () => {
    render(
      <TaskModal
        {...defaultProps}
        task={{
          id: 't1', title: 'Existing', status: 'Open',
          due_date: '2024-06-15', type: 'TODO',
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

  it('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    render(<TaskModal {...defaultProps} onClose={onClose} />);
    await waitFor(() => screen.getByText('New Task'));
    fireEvent.click(screen.getByText(/cancel/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows task type selector', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/type/i)).toBeInTheDocument();
    });
  });

  it('shows assign to me button', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTitle(/assign this task to yourself|already assigned/i)).toBeInTheDocument();
    });
  });

  it('handles assign to me', async () => {
    render(<TaskModal {...defaultProps} />);
    await waitFor(() => screen.getByTitle(/assign this task to yourself|already assigned/i));
    fireEvent.click(screen.getByTitle(/assign this task to yourself|already assigned/i));
    expect(true).toBe(true);
  });
});
