import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetTaskById = vi.fn();
const mockGetUsers = vi.fn();
const mockGetTaskNotes = vi.fn();
const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockCreateNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getTaskById: (...a: any[]) => mockGetTaskById(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getTaskNotes: (...a: any[]) => mockGetTaskNotes(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    deleteTask: (...a: any[]) => mockDeleteTask(...a),
    createNote: (...a: any[]) => mockCreateNote(...a),
    updateNote: (...a: any[]) => mockUpdateNote(...a),
    deleteNote: (...a: any[]) => mockDeleteNote(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'task-1' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  ShellContext: { Consumer: ({ children }: any) => children({ user: { id: 'user-1' } }) },
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

vi.mock('./components/TaskModal', () => ({
  default: ({ onClose }: any) => <div data-testid="task-modal"><button onClick={onClose}>Close Edit</button></div>,
}));

vi.mock('./components/RescheduleModal', () => ({
  RescheduleModal: ({ onClose, onConfirm }: any) => (
    <div data-testid="reschedule-modal">
      <button onClick={() => onConfirm('2026-06-01')}>Confirm Reschedule</button>
      <button onClick={onClose}>Cancel Reschedule</button>
    </div>
  ),
}));

import TaskDetailPage from './TaskDetailPage';

const makeTask = (overrides: any = {}) => ({
  id: 'task-1',
  title: 'Follow up with client',
  description: 'Call them about the proposal',
  status: 'OPEN',
  due_date: '2026-06-15',
  deal_id: 'deal-1',
  deal_name: 'Big Deal',
  lead_id: null,
  assigned_to: { id: 'user-1', full_name: 'Test User', avatar_url: null },
  ...overrides,
});

const makeNotes = () => [
  { id: 'n1', content: 'First note', created_at: '2026-01-10', author: { id: 'user-1', full_name: 'Test User' } },
  { id: 'n2', content: 'Second note', created_at: '2026-01-11', author: { id: 'user-2', full_name: 'Other User' } },
];

beforeEach(async () => {
  vi.clearAllMocks();
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
  mockGetTaskById.mockResolvedValue(makeTask());
  mockGetUsers.mockResolvedValue([]);
  mockGetTaskNotes.mockResolvedValue(makeNotes());
  mockUpdateTask.mockResolvedValue({});
  mockDeleteTask.mockResolvedValue({});
  mockCreateNote.mockResolvedValue({});
  mockUpdateNote.mockResolvedValue({});
  mockDeleteNote.mockResolvedValue({});
});

describe('TaskDetailPage', () => {
  describe('Given task is loading', () => {
    it('When rendered / Then shows loading spinner', () => {
      mockGetTaskById.mockReturnValue(new Promise(() => {}));
      render(<TaskDetailPage />);
      expect(screen.getByText('Loading task details...')).toBeInTheDocument();
    });
  });

  describe('Given task is not found', () => {
    it('When rendered / Then shows not found message', async () => {
      mockGetTaskById.mockResolvedValue(null);
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Task not found.')).toBeInTheDocument());
    });
  });

  describe('Given task is loaded', () => {
    it('When rendered / Then shows task title', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());
    });

    it('When rendered / Then shows task description', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Call them about the proposal')).toBeInTheDocument());
    });

    it('When rendered / Then shows assignee name', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => {
        const matches = screen.getAllByText('Test User');
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('When rendered / Then shows task status badge', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('OPEN')).toBeInTheDocument());
    });

    it('When task has deal / Then shows deal link', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      const link = screen.getByText('Big Deal').closest('a');
      expect(link?.getAttribute('href')).toBe('/deals/deal-1');
    });

    it('When task has no description / Then shows placeholder', async () => {
      mockGetTaskById.mockResolvedValue(makeTask({ description: null }));
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('No additional description provided for this task.')).toBeInTheDocument());
    });

    it('When task has lead but no deal / Then shows lead link', async () => {
      mockGetTaskById.mockResolvedValue(makeTask({ deal_id: null, deal_name: null, lead_id: 'lead-1' }));
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('View Lead')).toBeInTheDocument());
      const link = screen.getByText('View Lead').closest('a');
      expect(link?.getAttribute('href')).toBe('/crm/leads/lead-1');
    });
  });

  describe('Given task status toggle', () => {
    it('When Mark as Complete is clicked / Then updates task status', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Mark as Complete')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Mark as Complete'));
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'DONE' }));
    });

    it('When task is Done and Mark as Open is clicked / Then reopens task', async () => {
      mockGetTaskById.mockResolvedValue(makeTask({ status: 'DONE' }));
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Mark as Open')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Mark as Open'));
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'OPEN' }));
    });
  });

  describe('Given task deletion', () => {
    it('When delete button clicked and confirmed / Then deletes task and navigates', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());
      const allBtns = screen.getAllByRole('button');
      const trashBtn = allBtns.find(b => b.className.includes('hover:text-rose'));
      fireEvent.click(trashBtn!);
      await waitFor(() => expect(screen.getByText('Delete Task')).toBeInTheDocument());
      const deleteConfirmBtn = screen.getAllByText('Delete').find(el => el.closest('button')?.className.includes('bg-red'));
      fireEvent.click(deleteConfirmBtn!);
      await waitFor(() => expect(mockDeleteTask).toHaveBeenCalledWith('task-1'));
      expect(mockNavigate).toHaveBeenCalledWith('/crm/tasks');
    });
  });

  describe('Given notes section', () => {
    it('When rendered / Then shows existing notes', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('First note')).toBeInTheDocument());
      expect(screen.getByText('Second note')).toBeInTheDocument();
    });

    it('When no notes exist / Then shows empty message', async () => {
      mockGetTaskNotes.mockResolvedValue([]);
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('No notes yet')).toBeInTheDocument());
    });

    it('When notes are not supported / Then shows migration notice', async () => {
      mockGetTaskNotes.mockRejectedValue(new Error('Table not found'));
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText(/Notes feature not yet available/)).toBeInTheDocument());
    });

    it('When Add Note is clicked and note submitted / Then creates note', async () => {
      mockGetTaskNotes.mockResolvedValue([]);
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('+ Add Note')).toBeInTheDocument());
      fireEvent.click(screen.getByText('+ Add Note'));
      const textarea = screen.getByPlaceholderText('Add a note or comment...');
      fireEvent.change(textarea, { target: { value: 'New test note' } });
      fireEvent.click(screen.getByText('Add Note'));
      await waitFor(() => expect(mockCreateNote).toHaveBeenCalledWith({ content: 'New test note', task_id: 'task-1' }));
    });
  });

  describe('Given reschedule flow', () => {
    it('When Reschedule is clicked / Then shows reschedule modal', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Reschedule')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Reschedule'));
      await waitFor(() => expect(screen.getByTestId('reschedule-modal')).toBeInTheDocument());
    });

    it('When reschedule confirmed / Then updates due date', async () => {
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Reschedule')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Reschedule'));
      await waitFor(() => expect(screen.getByTestId('reschedule-modal')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Confirm Reschedule'));
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { due_date: '2026-06-01' }));
    });
  });

  describe('Given overdue task', () => {
    it('When task is open and past due / Then shows Overdue badge', async () => {
      mockGetTaskById.mockResolvedValue(makeTask({ due_date: '2024-01-01' }));
      render(<TaskDetailPage />);
      await waitFor(() => {
        const overdueLabels = screen.getAllByText('Overdue');
        expect(overdueLabels.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given assignee with avatar', () => {
    it('When assignee has avatar_url / Then renders avatar image', async () => {
      mockGetTaskById.mockResolvedValue(makeTask({ assigned_to: { id: 'user-1', full_name: 'Test User', avatar_url: 'https://img.test/avatar.jpg' } }));
      render(<TaskDetailPage />);
      await waitFor(() => {
        const img = screen.getByAltText('Test User');
        expect(img).toHaveAttribute('src', 'https://img.test/avatar.jpg');
      });
    });
  });

  describe('Given effectiveFlagsLoaded guard — flicker prevention', () => {
    it('When effectiveFlagsLoaded is false / Then Delete button is absent (no flicker)', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: false,
        isFeatureEnabled: () => false,
      } as any);
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());
      // canCreateTask is false before flags resolve — delete button must not flash
      const deleteBtn = screen.queryByTitle('Delete');
      expect(deleteBtn).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded is true and isFeatureEnabled returns true / Then Delete button is present', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
      } as any);
      render(<TaskDetailPage />);
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());
      // The delete Trash2 icon button is rendered when canCreateTask is true
      const trashBtn = document.querySelector('[data-testid="icon-Trash2"]')?.closest('button');
      expect(trashBtn).toBeTruthy();
    });
  });
});
