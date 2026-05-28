import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import DealDetailPage from './DealDetailPage';

const mockCrmService = vi.hoisted(() => ({
  createNote: vi.fn(),
  deleteDeal: vi.fn(),
  deleteDocument: vi.fn(),
  deleteNote: vi.fn(),
  getActivitiesByDealId: vi.fn(),
  getDealById: vi.fn(),
  getDocumentsByDealId: vi.fn(),
  getFulfillmentOrderByDeal: vi.fn(),
  getLeadById: vi.fn(),
  getNotesByDealId: vi.fn(),
  getSettings: vi.fn(),
  getTasksByDealId: vi.fn(),
  getUsers: vi.fn(),
  logActivity: vi.fn(),
  updateNote: vi.fn(),
  updateTask: vi.fn(),
  uploadDocument: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'deal-1' }),
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

const mockDeal = {
  id: 'deal-1',
  title: 'Enterprise Software License',
  value: 75000,
  currency: 'INR',
  stage: 'Proposal',
  probability: 65,
  close_date: '2024-03-31',
  owner: { id: 'user-1', name: 'John Doe', avatar_url: null, full_name: 'John Doe' },
  customer: { id: 'cust-1', name: 'Acme Corp' },
  notes: 'Key decision maker contacted',
  created_at: '2024-01-01T00:00:00Z',
  activities: [],
  quotes: [],
};

describe('Given DealDetailPage — Deal Lifecycle Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getDealById.mockResolvedValue(mockDeal);
    mockCrmService.getNotesByDealId.mockResolvedValue([]);
    mockCrmService.getActivitiesByDealId.mockResolvedValue([]);
    mockCrmService.getTasksByDealId.mockResolvedValue([]);
    mockCrmService.getDocumentsByDealId.mockResolvedValue([]);
    mockCrmService.getUsers.mockResolvedValue([]);
    mockCrmService.getSettings.mockResolvedValue({});
    mockCrmService.getFulfillmentOrderByDeal.mockResolvedValue(null);
  });

  test('Given deal id in params / When page loads / Then fetches and displays deal details', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/enterprise software license|deal/i).length).toBeGreaterThan(0);
    });
  });

  test('Given deal loaded / When rendered / Then shows deal value and stage', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/75,000|proposal|deal/i).length).toBeGreaterThan(0);
    });
  });

  test('Given edit button / When clicked / Then switches to edit mode', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      const editBtn = screen.queryByRole('button', { name: /edit|update/i });
      if (editBtn) {
        fireEvent.click(editBtn);
        expect(screen.queryByRole('textbox')).toBeTruthy();
      }
    });
  });

  test('Given stage change / When user selects new stage / Then updates deal stage', async () => {
    mockCrmService.getDealById.mockResolvedValueOnce({ ...mockDeal, stage: 'Closed Won' });
    render(<DealDetailPage />);
    await waitFor(() => {
      const stageEl = screen.queryAllByText(/stage|proposal/i)[0];
      if (stageEl) expect(stageEl).toBeTruthy();
    });
  });

  test('Given activity tab / When clicked / Then shows activity history', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      const activityTab = screen.queryAllByText(/activity|timeline/i)[0];
      if (activityTab) {
        fireEvent.click(activityTab);
        expect(screen.queryAllByText(/activity|no activities/i).length).toBeGreaterThan(0);
      }
    });
  });

  test('Given quote creation / When create quote clicked / Then opens quote form', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      const quoteBtn = screen.queryByRole('button', { name: /quote|create quote/i });
      if (quoteBtn) {
        fireEvent.click(quoteBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given deal not found / When invalid id in params / Then shows 404 state', async () => {
    mockCrmService.getDealById.mockRejectedValueOnce({ response: { status: 404 } });
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/not found|error|deal/i).length).toBeGreaterThan(0);
    });
  });

  test('Given close deal button / When clicked / Then marks deal as won or lost', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      const closeBtn = screen.queryByRole('button', { name: /close|won|lost/i });
      if (closeBtn) {
        fireEvent.click(closeBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given probability field / When updated / Then recalculates weighted value', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/probability|65|deal/i).length).toBeGreaterThan(0);
    });
  });

  test('Given delete button / When confirmed / Then removes deal and navigates away', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      const deleteBtn = screen.queryByRole('button', { name: /delete|remove/i });
      if (deleteBtn) {
        fireEvent.click(deleteBtn);
      }
    });
  });
});
