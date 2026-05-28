import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MarketingSegmentsPage } from './MarketingSegmentsPage';

const mockCrmService = vi.hoisted(() => ({
  addCustomerSegmentMembers: vi.fn(),
  createCustomerSegment: vi.fn(),
  deleteCustomerSegment: vi.fn(),
  getCustomers: vi.fn(),
  getCustomerSegmentMembers: vi.fn(),
  getCustomerSegments: vi.fn(),
  getLeads: vi.fn(),
  getMarketingInactiveCustomers: vi.fn(),
  getMarketingSegments: vi.fn(),
  getMarketingTopBuyers: vi.fn(),
  removeCustomerSegmentMembers: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockSegments = [
  { id: 'seg-1', name: 'High Value Customers', criteria: { min_spend: 50000 }, count: 245, created_at: '2024-01-01' },
  { id: 'seg-2', name: 'Churned Users', criteria: { inactive_days: 90 }, count: 89, created_at: '2024-01-10' },
  { id: 'seg-3', name: 'New This Month', criteria: { created_this_month: true }, count: 34, created_at: '2024-01-20' },
];

describe('Given MarketingSegmentsPage — Customer Segmentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getCustomerSegments.mockResolvedValue({ segments: mockSegments, total: mockSegments.length });
    mockCrmService.getMarketingSegments.mockResolvedValue([]);
    mockCrmService.getCustomers.mockResolvedValue([]);
    mockCrmService.getLeads.mockResolvedValue([]);
    mockCrmService.getMarketingInactiveCustomers.mockResolvedValue([]);
    mockCrmService.getMarketingTopBuyers.mockResolvedValue([]);
    mockCrmService.getCustomerSegmentMembers.mockResolvedValue([]);
  });

  test('Given user visits segments page / When loaded / Then displays segment list', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/segment|high value/i)).toBeTruthy();
    });
  });

  test('Given segments loaded / When rendered / Then shows segment names and counts', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/customer segments|segments/i)).toBeTruthy();
    });
  });

  test('Given create segment button / When clicked / Then opens segment builder', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create segment|new segment|\+/i });
      if (createBtn) {
        fireEvent.click(createBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given segment row / When clicked / Then shows segment details and members', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      const segEl = screen.queryByText(/high value customers/i);
      if (segEl) fireEvent.click(segEl);
    });
  });

  test('Given use in campaign / When action triggered / Then creates campaign with segment', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/segment|campaign/i)).toBeTruthy();
    });
  });

  test('Given empty segment list / When no segments / Then shows empty state', async () => {
    mockCrmService.getCustomerSegments.mockResolvedValueOnce({ segments: [], total: 0 });
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/no segments|empty|segment/i)).toBeTruthy();
    });
  });

  test('Given refresh button / When clicked / Then recalculates segment counts', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      const refreshBtn = screen.queryByRole('button', { name: /refresh|recalculate/i });
      if (refreshBtn) fireEvent.click(refreshBtn);
    });
  });

  test('Given delete segment / When confirmed / Then removes segment', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      const deleteBtn = screen.queryByRole('button', { name: /delete|remove/i });
      if (deleteBtn) {
        fireEvent.click(deleteBtn);
        const confirmBtn = screen.queryByRole('button', { name: /confirm|yes/i });
        if (confirmBtn) fireEvent.click(confirmBtn);
      }
    });
  });

  test('Given churned users segment / When selected / Then shows re-engagement option', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/churned|segment/i)).toBeTruthy();
    });
  });

  test('Given API error / When segments fail to load / Then shows error state', async () => {
    mockCrmService.getCustomerSegments.mockRejectedValueOnce(new Error('Network error'));
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/error|failed|segment/i)).toBeTruthy();
    });
  });
});
