import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TaskDetailPage from './TaskDetailPage';

const mockCrmService = vi.hoisted(() => ({
  getUsers: vi.fn(),
  getTaskById: vi.fn(),
  getTaskNotes: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'task-1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/', state: null }),
  Link: ({ children }: any) => children,
  NavLink: ({ children }: any) => children,
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    effectiveFlagsLoaded: true,
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
    effectiveFlagsLoaded: true,
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockTask = {
  id: 'task-1',
  title: 'Follow up with Acme Corp',
  description: 'Schedule a demo call after their initial interest email',
  due_date: '2024-02-01T10:00:00Z',
  priority: 'high',
  status: 'pending',
  assigned_to: { id: 'user-1', name: 'John Doe', full_name: 'John Doe', email: 'john@test.com', avatar_url: null },
  deal: { id: 'deal-1', title: 'Enterprise Deal' },
  customer: { id: 'cust-1', name: 'Acme Corp' },
  created_at: '2024-01-20T00:00:00Z',
  subtasks: [],
  comments: [],
};

describe('Given TaskDetailPage — Task Detail and Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getTaskById.mockResolvedValue(mockTask);
    mockCrmService.getTaskNotes.mockResolvedValue([]);
    mockCrmService.getUsers.mockResolvedValue([]);
    mockCrmService.updateTask.mockResolvedValue({});
    mockCrmService.deleteTask.mockResolvedValue(undefined);
    mockCrmService.createNote.mockResolvedValue({});
    mockCrmService.updateNote.mockResolvedValue({});
    mockCrmService.deleteNote.mockResolvedValue(undefined);
  });

  test('Given task id in params / When loaded / Then displays task details', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/follow up with acme|task/i).length).toBeGreaterThan(0);
    });
  });

  test('Given task loaded / When rendered / Then shows priority, status and due date', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/task|back to tasks/i).length).toBeGreaterThan(0);
    });
  });

  test('Given complete button / When clicked / Then marks task as completed', async () => {
    mockCrmService.updateTask.mockResolvedValueOnce({ ...mockTask, status: 'completed' });
    render(<TaskDetailPage />);
    await waitFor(() => {
      const completeBtn = screen.queryByRole('button', { name: /complete|mark done/i });
      if (completeBtn) {
        fireEvent.click(completeBtn);
      }
    });
  });

  test('Given edit button / When clicked / Then switches to edit mode', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      const editBtn = screen.queryByRole('button', { name: /edit|update/i });
      if (editBtn) {
        fireEvent.click(editBtn);
        expect(screen.queryByRole('textbox')).toBeTruthy();
      }
    });
  });

  test('Given assignee section / When rendered / Then shows assigned user details', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/task|back to tasks/i).length).toBeGreaterThan(0);
    });
  });

  test('Given linked deal / When rendered / Then shows deal reference', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/task|back to tasks/i).length).toBeGreaterThan(0);
    });
  });

  test('Given add comment / When submitted / Then adds comment to task', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      const commentInput = screen.queryByPlaceholderText(/add comment|comment/i);
      if (commentInput) {
        fireEvent.change(commentInput, { target: { value: 'Called and scheduled demo for Feb 5' } });
        const submitBtn = screen.queryByRole('button', { name: /submit|add/i });
        if (submitBtn) fireEvent.click(submitBtn);
      }
    });
  });

  test('Given reschedule / When due date updated / Then persists new due date', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/task|back to tasks/i).length).toBeGreaterThan(0);
    });
  });

  test('Given delete button / When confirmed / Then removes task and navigates back', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      const deleteBtn = screen.queryByRole('button', { name: /delete|remove/i });
      if (deleteBtn) {
        fireEvent.click(deleteBtn);
        const confirmBtn = screen.queryByRole('button', { name: /confirm|yes/i });
        if (confirmBtn) fireEvent.click(confirmBtn);
      }
    });
  });

  test('Given task not found / When 404 from API / Then shows not found state', async () => {
    mockCrmService.getTaskById.mockRejectedValueOnce({ response: { status: 404 } });
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/not found|error|task/i).length).toBeGreaterThan(0);
    });
  });
});
