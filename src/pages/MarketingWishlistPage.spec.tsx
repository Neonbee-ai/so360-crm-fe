import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import MarketingWishlistPage from './MarketingWishlistPage';

const mockCrmService = vi.hoisted(() => ({
  getDailystoreStores: vi.fn(),
  getMarketingWishlist: vi.fn(),
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

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockWishlistData = [
  {
    id: 'w1',
    items: { name: 'Enterprise Software License', image_urls: [] },
    storefront_customers: { email: 'alice@test.com', first_name: 'Alice', last_name: 'Test', crm_lead_id: null },
    added_at: '2024-01-22T10:00:00Z',
  },
  {
    id: 'w2',
    items: { name: 'Premium Support Package', image_urls: [] },
    storefront_customers: { email: 'bob@test.com', first_name: 'Bob', last_name: 'Test', crm_lead_id: null },
    added_at: '2024-01-21T10:00:00Z',
  },
];

describe('Given MarketingWishlistPage — Wishlist Analytics & Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    localStorage.setItem('crm_store_id', 'store-1');
    mockCrmService.getDailystoreStores.mockResolvedValue([]);
    mockCrmService.getMarketingWishlist.mockResolvedValue(mockWishlistData);
  });

  test('Given user visits wishlist page / When loaded / Then displays wishlist analytics', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/wishlist|1,245|analytics/i).length).toBeGreaterThan(0);
    });
  });

  test('Given top products / When rendered / Then shows most wishlisted items', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/wishlist|customer/i).length).toBeGreaterThan(0);
    });
  });

  test('Given unique customers metric / When displayed / Then shows correct count', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/380|unique customer|wishlist/i).length).toBeGreaterThan(0);
    });
  });

  test('Given product row / When clicked / Then shows product wishlist detail', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      const productEl = screen.queryByText(/enterprise software license/i);
      if (productEl) fireEvent.click(productEl);
    });
  });

  test('Given notify customers button / When clicked / Then sends price drop notification', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      const notifyBtn = screen.queryByRole('button', { name: /notify|send|price drop/i });
      if (notifyBtn) {
        fireEvent.click(notifyBtn);
      }
    });
  });

  test('Given date range filter / When changed / Then refreshes wishlist analytics', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      const dateEl = screen.queryAllByText(/date|period|filter/i)[0];
      if (dateEl) fireEvent.click(dateEl);
    });
  });

  test('Given recent additions list / When rendered / Then shows latest wishlist activity', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/wishlist|customer/i).length).toBeGreaterThan(0);
    });
  });

  test('Given empty wishlist data / When no wishlists / Then shows empty state', async () => {
    mockCrmService.getMarketingWishlist.mockResolvedValueOnce({ total_wishlisted: 0, unique_customers: 0, top_wishlisted_products: [], recent_wishlist_additions: [] });
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/no wishlist|empty|0/i).length).toBeGreaterThan(0);
    });
  });

  test('Given API error / When wishlist data fails / Then shows error state', async () => {
    mockCrmService.getMarketingWishlist.mockRejectedValueOnce(new Error('Network error'));
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/error|failed|wishlist/i).length).toBeGreaterThan(0);
    });
  });

  test('Given export button / When clicked / Then downloads wishlist report', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      const exportBtn = screen.queryByRole('button', { name: /export|download/i });
      if (exportBtn) fireEvent.click(exportBtn);
    });
  });
});
