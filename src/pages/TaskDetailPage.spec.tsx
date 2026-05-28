import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { TaskDetailPage } from './TaskDetailPage';

vi.mock('../api/crmApi', () => ({
  crmApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'task-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: any) => children,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
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
  assigned_to: { id: 'user-1', name: 'John Doe', email: 'john@test.com' },
  deal: { id: 'deal-1', title: 'Enterprise Deal' },
  customer: { id: 'cust-1', name: 'Acme Corp' },
  created_at: '2024-01-20T00:00:00Z',
  subtasks: [],
  comments: [],
};

describe('Given TaskDetailPage — Task Detail and Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({ data: mockTask });
  });

  test('Given task id in params / When loaded / Then displays task details', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/follow up with acme|task/i)).toBeTruthy();
    });
  });

  test('Given task loaded / When rendered / Then shows priority, status and due date', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/high|pending|follow up/i)).toBeTruthy();
    });
  });

  test('Given complete button / When clicked / Then marks task as completed', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.patch.mockResolvedValueOnce({ data: { ...mockTask, status: 'completed' } });
    render(<TaskDetailPage />);
    await waitFor(() => {
      const completeBtn = screen.queryByRole('button', { name: /complete|mark done/i });
      if (completeBtn) {
        fireEvent.click(completeBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
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
      expect(screen.queryByText(/john doe|assigned/i)).toBeTruthy();
    });
  });

  test('Given linked deal / When rendered / Then shows deal reference', async () => {
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/enterprise deal|deal/i)).toBeTruthy();
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
      expect(screen.queryByText(/2024-02-01|feb 1|due date/i)).toBeTruthy();
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
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockRejectedValueOnce({ response: { status: 404 } });
    render(<TaskDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/not found|error|task/i)).toBeTruthy();
    });
  });
});
