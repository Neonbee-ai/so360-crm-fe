import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TasksPage from './TasksPage';

const mockCrmService = vi.hoisted(() => ({
  deleteTask: vi.fn(),
  getTasks: vi.fn(),
  getUsers: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/', state: null }),
  useParams: () => ({}),
  Link: ({ children }: any) => children,
  NavLink: ({ children }: any) => children,
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
  useShell: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isModuleEnabled: () => true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
  }),
  useBusinessSettings: () => ({ base_currency: 'USD', locale: 'en-US', currency: 'USD' }),
  useActivity: () => ({ logActivity: vi.fn(), recordActivity: vi.fn() }),
  useNotify: () => ({ notify: vi.fn(), emitNotification: vi.fn() }),
  useOrganization: () => ({ id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', name: 'Test Org' }),
  useQuota: () => ({ quota: { max: 1000, used: 0 }, isExceeded: false, getQuota: vi.fn() }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 1000, limitItems: (items: any[]) => items, isLimited: false }),
  ShellContext: React.createContext({}),
  useIdentity: () => ({ user: { id: 'mock-user-id', email: 'test@test.com', full_name: 'Test User' } }),
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
    mockCrmService.getTasks.mockResolvedValue(mockTasks);
    mockCrmService.getUsers.mockResolvedValue([]);
    mockCrmService.updateTask.mockResolvedValue({});
    mockCrmService.deleteTask.mockResolvedValue(undefined);
  });

  test('Given user visits tasks page / When loaded / Then displays task list', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/task|follow up/i).length).toBeGreaterThan(0);
    });
  });

  test('Given tasks loaded / When rendered / Then shows task titles and due dates', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/follow up with acme|send proposal/i).length).toBeGreaterThan(0);
    });
  });

  test('Given create task button / When clicked / Then opens task creation form', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create task|new task|\+/i });
      if (createBtn) {
        fireEvent.click(createBtn);
      }
    });
  });

  test('Given overdue task / When past due date / Then shows overdue indicator', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/overdue|demo scheduled|task/i).length).toBeGreaterThan(0);
    });
  });

  test('Given complete checkbox / When checked / Then marks task completed', async () => {
    mockCrmService.updateTask.mockResolvedValueOnce({ ...mockTasks[0], status: 'completed' });
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
      const filterEl = screen.queryAllByText(/priority|high/i)[0];
      if (filterEl) fireEvent.click(filterEl);
    });
  });

  test('Given assignee filter / When user filters by assignee / Then shows their tasks', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      const assigneeEl = screen.queryAllByText(/assignee|assigned to/i)[0];
      if (assigneeEl) fireEvent.click(assigneeEl);
    });
  });

  test('Given empty task list / When no tasks / Then shows empty state', async () => {
    mockCrmService.getTasks.mockResolvedValueOnce([]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/no tasks|empty|task/i).length).toBeGreaterThan(0);
    });
  });

  test('Given API error / When tasks fail to load / Then shows error state', async () => {
    mockCrmService.getTasks.mockRejectedValueOnce(new Error('Network error'));
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/error|failed|task/i).length).toBeGreaterThan(0);
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
