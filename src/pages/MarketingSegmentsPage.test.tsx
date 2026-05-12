import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetMarketingSegments = vi.fn();
const mockGetTopBuyers = vi.fn();
const mockGetInactive = vi.fn();
const mockGetCustomerSegments = vi.fn();
const mockCreateCustomerSegment = vi.fn();
const mockDeleteCustomerSegment = vi.fn();
const mockGetSegmentMembers = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getMarketingSegments: (...a: any[]) => mockGetMarketingSegments(...a),
    getMarketingTopBuyers: (...a: any[]) => mockGetTopBuyers(...a),
    getMarketingInactiveCustomers: (...a: any[]) => mockGetInactive(...a),
    getCustomerSegments: (...a: any[]) => mockGetCustomerSegments(...a),
    createCustomerSegment: (...a: any[]) => mockCreateCustomerSegment(...a),
    deleteCustomerSegment: (...a: any[]) => mockDeleteCustomerSegment(...a),
    getCustomerSegmentMembers: (...a: any[]) => mockGetSegmentMembers(...a),
    addCustomerSegmentMembers: vi.fn(),
    removeCustomerSegmentMembers: vi.fn(),
    getCustomers: vi.fn().mockResolvedValue([]),
    getLeads: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => (
    <select data-testid="store-picker" value={storeId} onChange={(e: any) => onChange(e.target.value)}>
      <option value="">Select</option>
      <option value="store-1">Store 1</option>
    </select>
  ),
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: any) => d || '',
  formatMoney: (v: any) => `$${v || 0}`,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD' } }),
  useShell: () => ({ isModuleEnabled: () => true }),
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import MarketingSegmentsPage from './MarketingSegmentsPage';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetMarketingSegments.mockResolvedValue({
    data: [{ segment: 'VIP', count: 10, avgSpend: 500 }],
  });
  mockGetTopBuyers.mockResolvedValue({
    data: [{ customerId: 'c1', name: 'Alice', totalSpent: 1000 }],
  });
  mockGetInactive.mockResolvedValue({
    data: [{ customerId: 'c2', name: 'Bob', daysSinceLastOrder: 90 }],
  });
  mockGetCustomerSegments.mockResolvedValue([
    { id: 'seg1', name: 'VIP Customers', description: 'Top spenders', member_count: 5, created_at: '2024-01-01' },
  ]);
  mockGetSegmentMembers.mockResolvedValue({ members: [] });
});

describe('MarketingSegmentsPage', () => {
  it('renders store picker', () => {
    render(<MarketingSegmentsPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });

  it('loads manual segments on mount', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      expect(mockGetCustomerSegments).toHaveBeenCalled();
    });
  });

  it('loads storefront segments when store selected', async () => {
    render(<MarketingSegmentsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => {
      expect(mockGetMarketingSegments).toHaveBeenCalledWith('store-1');
    });
  });

  it('displays manual segments', async () => {
    render(<MarketingSegmentsPage />);
    await waitFor(() => {
      expect(screen.getByText('VIP Customers')).toBeInTheDocument();
    });
  });

  it('handles load error', async () => {
    mockGetMarketingSegments.mockRejectedValue(new Error('fail'));
    render(<MarketingSegmentsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => {
      expect(screen.getByText(/fail/i)).toBeInTheDocument();
    });
  });
});
