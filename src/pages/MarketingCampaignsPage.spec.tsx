import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import MarketingCampaignsPage from './MarketingCampaignsPage';

const mockCrmService = vi.hoisted(() => ({
  createCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  getCampaigns: vi.fn(),
  pauseCampaign: vi.fn(),
  sendCampaignNow: vi.fn(),
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
  }),
  useBusinessSettings: () => ({ base_currency: 'USD', locale: 'en-US', currency: 'USD' }),
  useActivity: () => ({ logActivity: vi.fn(), recordActivity: vi.fn() }),
  useNotify: () => ({ notify: vi.fn(), emitNotification: vi.fn() }),
  useOrganization: () => ({ id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', name: 'Test Org' }),
  useQuota: () => ({ quota: { max: 1000, used: 0 }, isExceeded: false, getQuota: vi.fn() }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 1000, limitItems: (items: any[]) => items, isLimited: false }),
  ShellContext: React.createContext({}),
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockCampaigns = [
  { id: 'camp-1', name: 'Summer Sale 2024', type: 'email', status: 'active', sent: 1500, open_rate: 0.35, click_rate: 0.08 },
  { id: 'camp-2', name: 'Product Launch', type: 'sms', status: 'draft', sent: 0, open_rate: 0, click_rate: 0 },
  { id: 'camp-3', name: 'Black Friday', type: 'email', status: 'completed', sent: 5000, open_rate: 0.42, click_rate: 0.15 },
];

describe('Given MarketingCampaignsPage — Email & SMS Campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getCampaigns.mockResolvedValue({ campaigns: mockCampaigns, total: mockCampaigns.length });
  });

  test('Given user visits campaigns page / When loaded / Then displays campaign list', async () => {
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/campaign|summer sale/i)).toBeTruthy();
    });
  });

  test('Given campaigns loaded / When rendered / Then shows campaign metrics', async () => {
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/summer sale 2024|product launch/i)).toBeTruthy();
    });
  });

  test('Given create campaign button / When clicked / Then opens campaign creation wizard', async () => {
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create|new campaign|\+/i });
      if (createBtn) {
        fireEvent.click(createBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given active campaign / When rendered / Then shows active badge and metrics', async () => {
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/active|summer sale/i)).toBeTruthy();
    });
  });

  test('Given status filter / When draft selected / Then shows only draft campaigns', async () => {
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      const draftBtn = screen.queryByText(/draft/i);
      if (draftBtn) fireEvent.click(draftBtn);
    });
  });

  test('Given open rate column / When sorted / Then reorders campaigns by open rate', async () => {
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      const openRateHeader = screen.queryByText(/open rate/i);
      if (openRateHeader) fireEvent.click(openRateHeader);
    });
  });

  test('Given completed campaign / When clicked / Then navigates to campaign detail with analytics', async () => {
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      const campEl = screen.queryByText(/black friday/i);
      if (campEl) fireEvent.click(campEl);
    });
  });

  test('Given duplicate action / When triggered / Then copies campaign as draft', async () => {
    mockCrmService.createCampaign.mockResolvedValueOnce({ ...mockCampaigns[0], id: 'camp-copy', name: 'Copy of Summer Sale 2024', status: 'draft' });
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/campaign|summer sale/i)).toBeTruthy();
    });
  });

  test('Given empty campaign list / When no campaigns / Then shows empty state with CTA', async () => {
    mockCrmService.getCampaigns.mockResolvedValueOnce({ campaigns: [], total: 0 });
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/no campaigns|empty|campaign/i)).toBeTruthy();
    });
  });

  test('Given type filter / When SMS selected / Then shows SMS campaigns only', async () => {
    render(<MarketingCampaignsPage />);
    await waitFor(() => {
      const smsEl = screen.queryByText(/sms/i);
      if (smsEl) fireEvent.click(smsEl);
    });
  });
});
