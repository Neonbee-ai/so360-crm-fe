/**
 * BDD specs for MarketingOverviewPage
 *
 * Scenarios covered:
 *  - Heading renders on mount
 *  - Store picker prompt when no store selected
 *  - KPI cards: Abandoned Carts, Recovery Rate, Revenue Recovered, Email Open Rate
 *  - Navigation shortcut cards: Reviews, Wishlist, Newsletter, Coupons
 *  - Top Selling Products table
 *  - Top Buyers table
 *  - Inactive Customers list
 *  - Conversion Funnel metrics
 *  - Recent Storefront Searches
 *  - Empty states for each list
 *  - Loading state
 *  - API error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const mockGetAbandonedCartStats = vi.fn();
const mockGetMarketingSegments = vi.fn();
const mockGetMarketingBestSellingProducts = vi.fn();
const mockGetMarketingTopBuyers = vi.fn();
const mockGetMarketingInactiveCustomers = vi.fn();
const mockGetMarketingConversionFunnel = vi.fn();
const mockGetMarketingEmailPerformance = vi.fn();
const mockGetAllStorefrontSearches = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getAbandonedCartStats: (...a: any[]) => mockGetAbandonedCartStats(...a),
    getMarketingSegments: (...a: any[]) => mockGetMarketingSegments(...a),
    getMarketingBestSellingProducts: (...a: any[]) => mockGetMarketingBestSellingProducts(...a),
    getMarketingTopBuyers: (...a: any[]) => mockGetMarketingTopBuyers(...a),
    getMarketingInactiveCustomers: (...a: any[]) => mockGetMarketingInactiveCustomers(...a),
    getMarketingConversionFunnel: (...a: any[]) => mockGetMarketingConversionFunnel(...a),
    getMarketingEmailPerformance: (...a: any[]) => mockGetMarketingEmailPerformance(...a),
    getAllStorefrontSearches: (...a: any[]) => mockGetAllStorefrontSearches(...a),
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ onChange }: any) => (
    <button onClick={() => onChange('store-1')} data-testid="store-picker">
      Pick Store
    </button>
  ),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({
    settings: { base_currency: 'USD', document_language: 'en-US' },
  }),
  useActivity: () => ({ recordActivity: async () => {} }),
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatMoney: (v: number) => `$${(v || 0).toFixed(2)}`,
  MarketingKpiCard: {},
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

import MarketingOverviewPage from './MarketingOverviewPage';

// ── Fixtures ─────────────────────────────────────────────────────────────

const abandonedStats = {
  totalAbandoned: 42,
  totalRecovered: 12,
  recoveryRate: 28.5,
  revenueRecovered: 15000,
};

const emailPerf = { openRate: 35.2 };

const bestSelling = {
  data: [
    { itemId: 'p1', name: 'Wireless Headphones', quantitySold: 120 },
    { itemId: 'p2', name: 'Coffee Maker', quantitySold: 85 },
  ],
};

const topBuyers = {
  data: [
    { customerId: 'c1', name: 'Alice Johnson', email: 'alice@test.com', totalSpent: 5200 },
    { customerId: 'c2', name: null, email: 'bob@corp.com', totalSpent: 3400 },
  ],
};

const inactiveCustomers = {
  data: [
    { customerId: 'c3', name: 'Charlie Brown', email: 'charlie@test.com', daysSinceLastOrder: 90 },
  ],
};

const funnel = {
  funnel: {
    product_views: 8000,
    add_to_cart: 2500,
    checkout_started: 1200,
    purchases: 750,
  },
};

const searchLogs = [
  {
    id: 's1',
    search_query: 'wireless earbuds',
    created_at: '2025-05-10T10:00:00Z',
    storefront_customers: { first_name: 'Dana', last_name: 'Lee' },
  },
  {
    id: 's2',
    search_query: 'running shoes',
    created_at: '2025-05-11T09:00:00Z',
    storefront_customers: null,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function renderPage(storeId = 'store-1') {
  if (storeId) {
    localStorage.setItem('crm_marketing_store_id', storeId);
  } else {
    localStorage.removeItem('crm_marketing_store_id');
  }
  return render(<MarketingOverviewPage />);
}

function setupDefaultMocks() {
  mockGetAbandonedCartStats.mockResolvedValue(abandonedStats);
  mockGetMarketingSegments.mockResolvedValue([]);
  mockGetMarketingBestSellingProducts.mockResolvedValue(bestSelling);
  mockGetMarketingTopBuyers.mockResolvedValue(topBuyers);
  mockGetMarketingInactiveCustomers.mockResolvedValue(inactiveCustomers);
  mockGetMarketingConversionFunnel.mockResolvedValue(funnel);
  mockGetMarketingEmailPerformance.mockResolvedValue(emailPerf);
  mockGetAllStorefrontSearches.mockResolvedValue(searchLogs);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MarketingOverviewPage BDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  describe('Given page renders', () => {
    it('When mounted / Then shows CRM Marketing Overview heading', () => {
      renderPage();
      expect(screen.getByText('CRM Marketing Overview')).toBeInTheDocument();
    });

    it('When no store selected / Then shows select store prompt', () => {
      renderPage('');
      expect(screen.getByText(/select a store to load insights/i)).toBeInTheDocument();
    });
  });

  describe('Given KPI cards load successfully', () => {
    it('When data loads / Then shows Abandoned Carts KPI', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Abandoned Carts')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
      });
    });

    it('When data loads / Then shows Recovery Rate KPI', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Recovery Rate')).toBeInTheDocument();
        expect(screen.getByText('28.5%')).toBeInTheDocument();
      });
    });

    it('When data loads / Then shows Revenue Recovered KPI', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Revenue Recovered')).toBeInTheDocument();
      });
    });

    it('When data loads / Then shows Email Open Rate KPI', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Email Open Rate')).toBeInTheDocument();
        expect(screen.getByText('35.2%')).toBeInTheDocument();
      });
    });

    it('When data loads / Then shows recovered hint in Abandoned Carts card', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/recovered: 12/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given navigation shortcut cards', () => {
    it('When rendered / Then shows Customer Reviews link', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/customer reviews/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows Wishlist Feed link', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/wishlist feed/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows Newsletter Audience link', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/newsletter audience/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows Discount Coupons link', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/discount coupons/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given Top Selling Products section', () => {
    it('When data loads / Then shows product names', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
        expect(screen.getByText('Coffee Maker')).toBeInTheDocument();
      });
    });

    it('When data loads / Then shows quantity sold', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/120 sold/)).toBeInTheDocument();
        expect(screen.getByText(/85 sold/)).toBeInTheDocument();
      });
    });

    it('When no products / Then shows no sales data message', async () => {
      mockGetMarketingBestSellingProducts.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no sales data directly available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given Top Buyers section', () => {
    it('When data loads / Then shows buyer names', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });
    });

    it('When buyer has no name / Then falls back to email', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('bob@corp.com')).toBeInTheDocument();
      });
    });

    it('When no buyers / Then shows no buyer data message', async () => {
      mockGetMarketingTopBuyers.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no buyer data available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given Inactive Customers section', () => {
    it('When data loads / Then shows inactive customer name and days', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
        expect(screen.getByText(/90 days/)).toBeInTheDocument();
      });
    });

    it('When no inactive customers / Then shows no inactive customers message', async () => {
      mockGetMarketingInactiveCustomers.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no inactive customers identified/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given Conversion Funnel section', () => {
    it('When data loads / Then shows funnel metrics', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Product Views')).toBeInTheDocument();
        expect(screen.getByText('8000')).toBeInTheDocument();
        expect(screen.getByText('Add to Cart')).toBeInTheDocument();
        expect(screen.getByText('2500')).toBeInTheDocument();
        expect(screen.getByText('Checkout Started')).toBeInTheDocument();
        expect(screen.getByText('1200')).toBeInTheDocument();
        expect(screen.getByText('750')).toBeInTheDocument();
      });
    });
  });

  describe('Given Recent Storefront Searches', () => {
    it('When data loads / Then shows search queries', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/"wireless earbuds"/)).toBeInTheDocument();
        expect(screen.getByText(/"running shoes"/)).toBeInTheDocument();
      });
    });

    it('When customer has name / Then shows customer name', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/dana lee/i)).toBeInTheDocument();
      });
    });

    it('When customer is null / Then shows Anonymous', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/anonymous/i)).toBeInTheDocument();
      });
    });

    it('When no searches / Then shows no recent search activity', async () => {
      mockGetAllStorefrontSearches.mockResolvedValue([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no recent search activity found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given loading state', () => {
    it('When data is pending / Then shows loading indicator', () => {
      mockGetAbandonedCartStats.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Given API error', () => {
    it('When any fetch fails / Then shows error message', async () => {
      mockGetAbandonedCartStats.mockRejectedValue(new Error('Failed to load marketing overview'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Failed to load marketing overview')).toBeInTheDocument();
      });
    });
  });
});
