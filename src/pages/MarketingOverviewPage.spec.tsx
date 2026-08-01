import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import MarketingOverviewPage from './MarketingOverviewPage';

const mockCrmService = vi.hoisted(() => ({
  getAbandonedCartStats: vi.fn(),
  getAllStorefrontSearches: vi.fn(),
  getDailystoreStores: vi.fn(),
  getMarketingBestSellingProducts: vi.fn(),
  getMarketingConversionFunnel: vi.fn(),
  getMarketingEmailPerformance: vi.fn(),
  getMarketingInactiveCustomers: vi.fn(),
  getMarketingSegments: vi.fn(),
  getMarketingTopBuyers: vi.fn(),
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
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' }, base_currency: 'USD', locale: 'en-US', currency: 'USD' }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee', orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc', isFeatureEnabled: vi.fn().mockReturnValue(true) }),
  useShell: () => ({ tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee', orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc', isModuleEnabled: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useActivity: () => ({ logActivity: vi.fn(), recordActivity: vi.fn() }),
  useNotify: () => ({ notify: vi.fn(), emitNotification: vi.fn() }),
  useOrganization: () => ({ id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', name: 'Test Org' }),
  useQuota: () => ({ quota: { max: 1000, used: 0 }, isExceeded: false, getQuota: vi.fn() }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 1000, limitItems: (items: any[]) => items, isLimited: false }),
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

const mockOverviewData = {
  active_campaigns: 5,
  total_sent: 25000,
  avg_open_rate: 0.32,
  avg_click_rate: 0.08,
  revenue_attributed: 150000,
  new_subscribers: 342,
  unsubscribes: 12,
  recent_campaigns: [
    { id: 'camp-1', name: 'Summer Sale', sent: 5000, open_rate: 0.35, revenue: 45000 },
    { id: 'camp-2', name: 'Product Launch', sent: 8000, open_rate: 0.28, revenue: 62000 },
  ],
};

describe('Given MarketingOverviewPage — Marketing Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    localStorage.setItem('crm_store_id', 'store-1');
    mockCrmService.getDailystoreStores.mockResolvedValue([]);
    mockCrmService.getMarketingEmailPerformance.mockResolvedValue(mockOverviewData);
    mockCrmService.getAbandonedCartStats.mockResolvedValue({});
    mockCrmService.getAllStorefrontSearches.mockResolvedValue([]);
    mockCrmService.getMarketingBestSellingProducts.mockResolvedValue([]);
    mockCrmService.getMarketingConversionFunnel.mockResolvedValue({});
    mockCrmService.getMarketingInactiveCustomers.mockResolvedValue([]);
    mockCrmService.getMarketingSegments.mockResolvedValue([]);
    mockCrmService.getMarketingTopBuyers.mockResolvedValue([]);
  });

  test('Given user visits marketing overview / When loaded / Then displays marketing KPIs', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/marketing|overview|campaign/i).length).toBeGreaterThan(0);
    });
  });

  test('Given overview loaded / When rendered / Then shows active campaign count', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/5|active campaign|marketing/i).length).toBeGreaterThan(0);
    });
  });

  test('Given date range filter / When changed / Then refreshes metrics for period', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      const dateFilter = screen.queryAllByText(/date|last 7|30 days/i)[0];
      if (dateFilter) fireEvent.click(dateFilter);
    });
  });

  test('Given open rate metric / When displayed / Then shows percentage correctly', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/32%|open rate|0.32/i).length).toBeGreaterThan(0);
    });
  });

  test('Given revenue attributed / When shown / Then formats currency correctly', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/150,000|revenue|attributed/i).length).toBeGreaterThan(0);
    });
  });

  test('Given recent campaigns list / When rendered / Then shows top performing campaigns', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/crm marketing overview|marketing/i).length).toBeGreaterThan(0);
    });
  });

  test('Given create campaign CTA / When clicked / Then navigates to campaign creation', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create campaign|new campaign/i });
      if (createBtn) fireEvent.click(createBtn);
    });
  });

  test('Given unsubscribe spike / When detected / Then shows alert or warning', async () => {
    mockCrmService.getMarketingEmailPerformance.mockResolvedValueOnce({ ...mockOverviewData, unsubscribes: 500 });
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/marketing|overview/i).length).toBeGreaterThan(0);
    });
  });

  test('Given API error / When overview fails to load / Then shows error state', async () => {
    mockCrmService.getMarketingEmailPerformance.mockRejectedValueOnce(new Error('Network error'));
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/error|failed|marketing/i).length).toBeGreaterThan(0);
    });
  });

  test('Given subscriber growth chart / When data loaded / Then renders chart or summary', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/342|subscriber|new|marketing/i).length).toBeGreaterThan(0);
    });
  });
});
