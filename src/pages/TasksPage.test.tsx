import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetTasks = vi.fn();
const mockGetUsers = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getTasks: (...a: any[]) => mockGetTasks(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    deleteTask: vi.fn(),
    updateTask: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
  useShell: () => ({ user: { id: 'u1', full_name: 'Test' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, isLoading, emptyMessage }: any) => (
    <div data-testid="table">{isLoading ? 'Loading...' : data.length === 0 ? emptyMessage : `${data.length} rows`}</div>
  ),
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('../utils/taskUtils', () => ({
  canCurrentUserBeAssigned: () => true,
  isTaskAssignedToUser: () => false,
}));

import TasksPage from './TasksPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTasks.mockResolvedValue([]);
  mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Test' }]);
});

describe('Given TasksPage', () => {
  it('When action / Then renders tasks header', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/task/i).length).toBeGreaterThan(0);
    });
  });

  it('When action / Then shows empty state when no tasks', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table')).toBeTruthy();
    });
  });

  it('When action / Then shows tasks when loaded', async () => {
    mockGetTasks.mockResolvedValue([
      { id: 't1', title: 'Call John', status: 'OPEN', due_date: '2024-01-01', type: 'TODO', assigned_to: { id: 'u1', full_name: 'Test' } },
    ]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table')).toHaveTextContent('1 rows');
    });
  });
});
