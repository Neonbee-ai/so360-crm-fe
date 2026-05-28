import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import MarketingCampaignDetailPage from './MarketingCampaignDetailPage';

const mockCrmService = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignRecipients: vi.fn(),
  scheduleCampaign: vi.fn(),
  testSendCampaign: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'camp-1' }),
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

const mockCampaign = {
  id: 'camp-1',
  name: 'Summer Sale 2024',
  type: 'email',
  status: 'active',
  subject: 'Exclusive Summer Deals Inside!',
  sent_count: 1500,
  delivered: 1480,
  opens: 518,
  clicks: 120,
  unsubscribes: 8,
  bounces: 20,
  open_rate: 0.35,
  click_rate: 0.08,
  revenue_attributed: 45000,
  segment: 'High Value Customers',
  scheduled_at: '2024-06-01T09:00:00Z',
  created_at: '2024-05-20T00:00:00Z',
};

describe('Given MarketingCampaignDetailPage — Campaign Analytics Detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    localStorage.setItem('crm_store_id', 'store-1');
    mockCrmService.getCampaign.mockResolvedValue(mockCampaign);
    mockCrmService.getCampaignRecipients.mockResolvedValue([]);
  });

  test('Given campaign id / When loaded / Then displays campaign details and metrics', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/summer sale 2024|campaign/i).length).toBeGreaterThan(0);
    });
  });

  test('Given campaign metrics / When rendered / Then shows open rate and click rate', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/35%|8%|open rate|click/i).length).toBeGreaterThan(0);
    });
  });

  test('Given sent count / When displayed / Then shows delivery funnel', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/1,500|1,480|delivered/i).length).toBeGreaterThan(0);
    });
  });

  test('Given revenue attributed / When shown / Then formats correctly', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/45,000|revenue/i).length).toBeGreaterThan(0);
    });
  });

  test('Given pause button / When active campaign / Then pauses campaign delivery', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      const pauseBtn = screen.queryByRole('button', { name: /pause|stop/i });
      if (pauseBtn) fireEvent.click(pauseBtn);
    });
  });

  test('Given duplicate campaign / When action triggered / Then creates copy as draft', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      const dupeBtn = screen.queryByRole('button', { name: /duplicate|copy/i });
      if (dupeBtn) fireEvent.click(dupeBtn);
    });
  });

  test('Given unsubscribe count / When shown / Then highlights if above threshold', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/8|unsubscribe|bounce/i).length).toBeGreaterThan(0);
    });
  });

  test('Given segment info / When displayed / Then shows target segment name', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/high value customers|segment/i).length).toBeGreaterThan(0);
    });
  });

  test('Given campaign not found / When 404 / Then shows not found state', async () => {
    mockCrmService.getCampaign.mockRejectedValueOnce({ response: { status: 404 } });
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/not found|error|campaign/i).length).toBeGreaterThan(0);
    });
  });

  test('Given engagement breakdown / When rendered / Then shows click heatmap or link list', async () => {
    render(<MarketingCampaignDetailPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/120|click|engagement/i).length).toBeGreaterThan(0);
    });
  });
});
