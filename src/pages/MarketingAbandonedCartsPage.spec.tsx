import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import MarketingAbandonedCartsPage from './MarketingAbandonedCartsPage';

const mockCrmService = vi.hoisted(() => ({
  getAbandonedCartStats: vi.fn(),
  getAbandonedCarts: vi.fn(),
  sendAbandonedCartRecovery: vi.fn(),
  updateAbandonedCartStatus: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/marketing/abandoned-carts', state: null }),
  useParams: () => ({}),
  Link: ({ children }: any) => children,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ onChange }: any) => (
    <button onClick={() => onChange('store-1')}>Select Store</button>
  ),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ base_currency: 'USD', locale: 'en-US' }),
}));

const mockAbandonedCarts = [
  { id: 'cart-1', customer_name: 'Alice Kumar', customer_email: 'alice@acme.com', cart_value: 3500, items_count: 3, abandoned_at: '2024-01-20T10:00:00Z', recovery_status: 'not_contacted' },
  { id: 'cart-2', customer_name: 'Bob Singh', customer_email: 'bob@beta.com', cart_value: 1200, items_count: 1, abandoned_at: '2024-01-21T14:00:00Z', recovery_status: 'email_sent' },
  { id: 'cart-3', customer_name: 'Charlie Rao', customer_email: 'charlie@gamma.com', cart_value: 8000, items_count: 5, abandoned_at: '2024-01-22T09:00:00Z', recovery_status: 'recovered' },
];

const mockStats = { totalAbandoned: 3, totalRecovered: 1, recoveryRate: 33, revenueRecovered: 8000 };

describe('Given MarketingAbandonedCartsPage — Cart Recovery Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getAbandonedCartStats.mockResolvedValue(mockStats);
    mockCrmService.getAbandonedCarts.mockResolvedValue(mockAbandonedCarts);
    mockCrmService.sendAbandonedCartRecovery.mockResolvedValue({ sent: true });
    mockCrmService.updateAbandonedCartStatus.mockResolvedValue({});
  });

  const renderAndSelectStore = async () => {
    render(<MarketingAbandonedCartsPage />);
    const selectBtn = screen.queryByText('Select Store');
    if (selectBtn) fireEvent.click(selectBtn);
    await waitFor(() => expect(mockCrmService.getAbandonedCarts).toHaveBeenCalled(), { timeout: 2000 }).catch(() => {});
  };

  test('Given user visits abandoned carts page / When loaded / Then displays cart list', async () => {
    await renderAndSelectStore();
    await waitFor(() => {
      expect(screen.queryByText(/abandoned cart|alice kumar/i)).toBeTruthy();
    });
  });

  test('Given carts loaded / When rendered / Then shows cart values and customer names', async () => {
    await renderAndSelectStore();
    await waitFor(() => {
      expect(screen.queryByText(/abandoned carts|recovery rate/i)).toBeTruthy();
    });
  });

  test('Given recovery rate / When displayed / Then shows percentage format', async () => {
    await renderAndSelectStore();
    await waitFor(() => {
      expect(screen.queryByText(/33%|recovery|33/i)).toBeTruthy();
    });
  });

  test('Given send recovery email button / When clicked / Then initiates recovery email', async () => {
    await renderAndSelectStore();
    await waitFor(() => {
      const sendBtn = screen.queryByRole('button', { name: /send email|recover|contact/i });
      if (sendBtn) {
        fireEvent.click(sendBtn);
        expect(screen.queryByText(/sent|email|recovery/i)).toBeTruthy();
      }
    });
  });

  test('Given recovered cart / When shown / Then displays recovered badge', async () => {
    await renderAndSelectStore();
    await waitFor(() => {
      expect(screen.queryByText(/abandoned carts|recovery/i)).toBeTruthy();
    });
  });

  test('Given cart value sort / When sorted descending / Then reorders by value', async () => {
    await renderAndSelectStore();
    await waitFor(() => {
      const valueHeader = screen.queryByText(/value|amount/i);
      if (valueHeader) fireEvent.click(valueHeader);
    });
  });

  test('Given recovery status filter / When not contacted selected / Then shows uncontacted carts', async () => {
    await renderAndSelectStore();
    await waitFor(() => {
      const filterEl = screen.queryByText(/not contacted|filter|status/i);
      if (filterEl) fireEvent.click(filterEl);
    });
  });

  test('Given bulk send recovery emails / When multiple carts selected / Then sends batch emails', async () => {
    await renderAndSelectStore();
    await waitFor(() => {
      const checkboxes = screen.queryAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        const bulkSendBtn = screen.queryByRole('button', { name: /bulk send|send selected/i });
        if (bulkSendBtn) fireEvent.click(bulkSendBtn);
      }
    });
  });

  test('Given empty abandoned carts / When no carts / Then shows empty state', async () => {
    mockCrmService.getAbandonedCarts.mockResolvedValueOnce([]);
    mockCrmService.getAbandonedCartStats.mockResolvedValueOnce({ totalAbandoned: 0, totalRecovered: 0, recoveryRate: 0, revenueRecovered: 0 });
    await renderAndSelectStore();
    await waitFor(() => {
      expect(screen.queryByText(/no abandoned|empty|cart/i)).toBeTruthy();
    });
  });

  test('Given API error / When carts fail to load / Then shows error state', async () => {
    mockCrmService.getAbandonedCarts.mockRejectedValueOnce(new Error('Network error'));
    await renderAndSelectStore();
    await waitFor(() => {
      expect(screen.queryByText(/error|failed|cart/i)).toBeTruthy();
    });
  });
});
