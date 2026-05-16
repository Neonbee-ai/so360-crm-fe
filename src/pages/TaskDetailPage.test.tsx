import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetTaskById = vi.fn();
const mockGetUsers = vi.fn();
const mockGetTaskNotes = vi.fn();
const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockCreateNote = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getTaskById: (...a: any[]) => mockGetTaskById(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getTaskNotes: (...a: any[]) => mockGetTaskNotes(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    deleteTask: (...a: any[]) => mockDeleteTask(...a),
    createNote: (...a: any[]) => mockCreateNote(...a),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'task-1' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@so360/shell-context', () => ({
  ShellContext: React.createContext({ user: { id: 'u1' } }),
}));

vi.mock('./components/TaskModal', () => ({ default: () => null }));
vi.mock('./components/RescheduleModal', () => ({
  RescheduleModal: () => null,
}));

import TaskDetailPage from './TaskDetailPage';

const taskData = {
  id: 'task-1', title: 'Follow up with client', status: 'Open',
  due_date: '2099-06-15', type: 'TODO', description: 'Call them tomorrow',
  assigned_to: { id: 'u1', full_name: 'Test User', avatar_url: null },
  created_at: '2024-01-01',
  deal_id: 'd1', deal_name: 'Big Deal', lead_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTaskById.mockResolvedValue(taskData);
  mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Test User' }]);
  mockGetTaskNotes.mockResolvedValue([
    { id: 'tn1', content: 'Task note', created_at: '2024-01-02', author: { id: 'u1', full_name: 'Test' } },
  ]);
  mockUpdateTask.mockResolvedValue({ ...taskData, status: 'Done' });
  mockDeleteTask.mockResolvedValue(undefined);
});

describe('Given TaskDetailPage', () => {
  it('When action / Then shows loading state', () => {
    mockGetTaskById.mockReturnValue(new Promise(() => {}));
    render(<TaskDetailPage />);
    expect(screen.getByText(/loading task/i)).toBeInTheDocument();
  });

  it('When action / Then shows task not found', async () => {
    mockGetTaskById.mockResolvedValue(undefined);
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('When action / Then renders task detail', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Follow up with client')).toBeInTheDocument();
    });
  });

  it('When action / Then shows task description', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Call them tomorrow')).toBeInTheDocument();
    });
  });

  it('When action / Then shows associated deal', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Big Deal')).toBeInTheDocument();
    });
  });

  it('When action / Then shows task status', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Open')).toBeInTheDocument();
    });
  });

  it('When action / Then shows task notes', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Task note')).toBeInTheDocument();
    });
  });

  it('When action / Then shows overdue indicator for past due tasks', async () => {
    mockGetTaskById.mockResolvedValue({ ...taskData, due_date: '2020-01-01' });
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    });
  });

  it('When action / Then shows lead link when task has lead_id but no deal_id', async () => {
    mockGetTaskById.mockResolvedValue({ ...taskData, deal_id: null, deal_name: null, lead_id: 'l1' });
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('View Lead')).toBeInTheDocument();
    });
  });

  it('When action / Then shows empty description message when no description', async () => {
    mockGetTaskById.mockResolvedValue({ ...taskData, description: '' });
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/no additional description/i)).toBeInTheDocument();
    });
  });

  it('When action / Then handles notes not supported', async () => {
    mockGetTaskNotes.mockRejectedValue(new Error('Not supported'));
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/notes feature not yet available/i)).toBeInTheDocument();
    });
  });

  it('When action / Then shows Done status styling', async () => {
    mockGetTaskById.mockResolvedValue({ ...taskData, status: 'Done' });
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('When action / Then shows back to tasks link', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Back to Tasks')).toBeInTheDocument();
    });
  });
});
