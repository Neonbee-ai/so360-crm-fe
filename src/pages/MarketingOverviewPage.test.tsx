import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetAbandonedCartStats = vi.fn();
const mockGetMarketingSegments = vi.fn();
const mockGetBestSelling = vi.fn();
const mockGetTopBuyers = vi.fn();
const mockGetInactive = vi.fn();
const mockGetFunnel = vi.fn();
const mockGetEmailPerf = vi.fn();
const mockGetSearches = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getAbandonedCartStats: (...a: any[]) => mockGetAbandonedCartStats(...a),
    getMarketingSegments: (...a: any[]) => mockGetMarketingSegments(...a),
    getMarketingBestSellingProducts: (...a: any[]) => mockGetBestSelling(...a),
    getMarketingTopBuyers: (...a: any[]) => mockGetTopBuyers(...a),
    getMarketingInactiveCustomers: (...a: any[]) => mockGetInactive(...a),
    getMarketingConversionFunnel: (...a: any[]) => mockGetFunnel(...a),
    getMarketingEmailPerformance: (...a: any[]) => mockGetEmailPerf(...a),
    getAllStorefrontSearches: (...a: any[]) => mockGetSearches(...a),
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
  formatMoney: (v: any) => `$${v || 0}`,
  MarketingKpiCard: ({ label, value }: any) => <div data-testid="kpi">{label}: {value}</div>,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

import MarketingOverviewPage from './MarketingOverviewPage';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetAbandonedCartStats.mockResolvedValue({ totalAbandoned: 10, totalRecovered: 3, recoveryRate: 30, revenueRecovered: 500 });
  mockGetMarketingSegments.mockResolvedValue({ data: [] });
  mockGetBestSelling.mockResolvedValue({ data: [{ itemId: 'i1', name: 'Widget', quantitySold: 50 }] });
  mockGetTopBuyers.mockResolvedValue({ data: [{ customerId: 'c1', name: 'Alice', totalSpent: 1000 }] });
  mockGetInactive.mockResolvedValue({ data: [{ customerId: 'c2', name: 'Bob', daysSinceLastOrder: 90 }] });
  mockGetFunnel.mockResolvedValue({ funnel: { product_views: 100, add_to_cart: 50, checkout_started: 20, purchases: 10 } });
  mockGetEmailPerf.mockResolvedValue({ openRate: 45 });
  mockGetSearches.mockResolvedValue([
    { id: 'sl1', search_query: 'shoes', created_at: '2024-01-01', storefront_customers: { first_name: 'Jane', last_name: 'Doe' } },
  ]);
});

describe('MarketingOverviewPage', () => {
  it('renders store picker', () => {
    render(<MarketingOverviewPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });

  it('shows select store message when no store selected', () => {
    render(<MarketingOverviewPage />);
    expect(screen.getByText(/select a store/i)).toBeInTheDocument();
  });

  it('loads data when store is selected', async () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(mockGetAbandonedCartStats).toHaveBeenCalledWith('store-1');
      expect(mockGetBestSelling).toHaveBeenCalled();
    });
  });

  it('displays KPI cards when data loads', async () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText(/abandoned carts/i)).toBeInTheDocument();
      expect(screen.getByText(/recovery rate/i)).toBeInTheDocument();
    });
  });

  it('displays best selling products', async () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText('Widget')).toBeInTheDocument();
      expect(screen.getByText('50 sold')).toBeInTheDocument();
    });
  });

  it('displays top buyers', async () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  it('displays inactive customers', async () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('90 days')).toBeInTheDocument();
    });
  });

  it('displays conversion funnel data', async () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText('Product Views')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Add to Cart')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  it('displays search logs', async () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText(/"shoes"/)).toBeInTheDocument();
    });
  });

  it('shows navigation links to sub-pages', async () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText('Customer Reviews')).toBeInTheDocument();
      expect(screen.getByText('Wishlist Feed')).toBeInTheDocument();
      expect(screen.getByText('Newsletter Audience')).toBeInTheDocument();
      expect(screen.getByText('Discount Coupons')).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    mockGetAbandonedCartStats.mockRejectedValue(new Error('API Error'));
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('shows loading state', async () => {
    mockGetAbandonedCartStats.mockReturnValue(new Promise(() => {}));
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty states for no data', async () => {
    mockGetBestSelling.mockResolvedValue({ data: [] });
    mockGetTopBuyers.mockResolvedValue({ data: [] });
    mockGetInactive.mockResolvedValue({ data: [] });
    mockGetSearches.mockResolvedValue([]);
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });

    await waitFor(() => {
      expect(screen.getByText(/no sales data/i)).toBeInTheDocument();
      expect(screen.getByText(/no buyer data/i)).toBeInTheDocument();
      expect(screen.getByText(/no inactive/i)).toBeInTheDocument();
      expect(screen.getByText(/no recent search/i)).toBeInTheDocument();
    });
  });

  it('persists store to localStorage', () => {
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    expect(localStorage.getItem('crm_marketing_store_id')).toBe('store-1');
  });

  it('restores store from localStorage', () => {
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    render(<MarketingOverviewPage />);
    expect(mockGetAbandonedCartStats).toHaveBeenCalledWith('store-1');
  });

  it('handles search log with anonymous customer', async () => {
    mockGetSearches.mockResolvedValue([
      { id: 'sl2', search_query: 'boots', created_at: '2024-02-01', storefront_customers: null },
    ]);
    render(<MarketingOverviewPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => {
      expect(screen.getByText(/"boots"/)).toBeInTheDocument();
      expect(screen.getByText(/anonymous/i)).toBeInTheDocument();
    });
  });
});
