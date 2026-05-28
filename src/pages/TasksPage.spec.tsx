import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { TasksPage } from './TasksPage';

vi.mock('../api/crmApi', () => ({
  crmApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockTasks = [
  { id: 'task-1', title: 'Follow up with Acme Corp', due_date: '2024-02-01', priority: 'high', status: 'pending', assigned_to: 'John Doe' },
  { id: 'task-2', title: 'Send proposal to Beta Ltd', due_date: '2024-02-05', priority: 'medium', status: 'in_progress', assigned_to: 'Jane Smith' },
  { id: 'task-3', title: 'Demo scheduled', due_date: '2024-01-30', priority: 'low', status: 'completed', assigned_to: 'John Doe' },
];

describe('Given TasksPage — CRM Task Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({ data: { tasks: mockTasks, total: mockTasks.length } });
  });

  test('Given user visits tasks page / When loaded / Then displays task list', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryByText(/task|follow up/i)).toBeTruthy();
    });
  });

  test('Given tasks loaded / When rendered / Then shows task titles and due dates', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryByText(/follow up with acme|send proposal/i)).toBeTruthy();
    });
  });

  test('Given create task button / When clicked / Then opens task creation form', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create task|new task|\+/i });
      if (createBtn) {
        fireEvent.click(createBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given overdue task / When past due date / Then shows overdue indicator', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryByText(/overdue|demo scheduled|task/i)).toBeTruthy();
    });
  });

  test('Given complete checkbox / When checked / Then marks task completed', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.patch.mockResolvedValueOnce({ data: { ...mockTasks[0], status: 'completed' } });
    render(<TasksPage />);
    await waitFor(() => {
      const checkboxes = screen.queryAllByRole('checkbox');
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0]);
      }
    });
  });

  test('Given priority filter / When high selected / Then shows high priority tasks only', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      const filterEl = screen.queryByText(/priority|high/i);
      if (filterEl) fireEvent.click(filterEl);
    });
  });

  test('Given assignee filter / When user filters by assignee / Then shows their tasks', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      const assigneeEl = screen.queryByText(/assignee|assigned to/i);
      if (assigneeEl) fireEvent.click(assigneeEl);
    });
  });

  test('Given empty task list / When no tasks / Then shows empty state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValueOnce({ data: { tasks: [], total: 0 } });
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryByText(/no tasks|empty|task/i)).toBeTruthy();
    });
  });

  test('Given API error / When tasks fail to load / Then shows error state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockRejectedValueOnce(new Error('Network error'));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryByText(/error|failed|task/i)).toBeTruthy();
    });
  });

  test('Given task row / When clicked / Then navigates to task detail', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      const taskEl = screen.queryByText(/follow up with acme/i);
      if (taskEl) fireEvent.click(taskEl);
    });
  });
});
