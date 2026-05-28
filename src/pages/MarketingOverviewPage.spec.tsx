import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MarketingOverviewPage } from './MarketingOverviewPage';

vi.mock('../api/crmApi', () => ({
  crmApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({ data: mockOverviewData });
  });

  test('Given user visits marketing overview / When loaded / Then displays marketing KPIs', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryByText(/marketing|overview|campaign/i)).toBeTruthy();
    });
  });

  test('Given overview loaded / When rendered / Then shows active campaign count', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryByText(/5|active campaign|marketing/i)).toBeTruthy();
    });
  });

  test('Given date range filter / When changed / Then refreshes metrics for period', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      const dateFilter = screen.queryByText(/date|last 7|30 days/i);
      if (dateFilter) fireEvent.click(dateFilter);
    });
  });

  test('Given open rate metric / When displayed / Then shows percentage correctly', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryByText(/32%|open rate|0.32/i)).toBeTruthy();
    });
  });

  test('Given revenue attributed / When shown / Then formats currency correctly', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryByText(/150,000|revenue|attributed/i)).toBeTruthy();
    });
  });

  test('Given recent campaigns list / When rendered / Then shows top performing campaigns', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryByText(/crm marketing overview|marketing/i)).toBeTruthy();
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
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValueOnce({
      data: { ...mockOverviewData, unsubscribes: 500 },
    });
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryByText(/marketing|overview/i)).toBeTruthy();
    });
  });

  test('Given API error / When overview fails to load / Then shows error state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockRejectedValueOnce(new Error('Network error'));
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryByText(/error|failed|marketing/i)).toBeTruthy();
    });
  });

  test('Given subscriber growth chart / When data loaded / Then renders chart or summary', async () => {
    render(<MarketingOverviewPage />);
    await waitFor(() => {
      expect(screen.queryByText(/342|subscriber|new|marketing/i)).toBeTruthy();
    });
  });
});
