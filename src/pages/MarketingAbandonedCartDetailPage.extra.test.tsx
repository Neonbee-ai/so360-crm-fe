/**
 * Comprehensive coverage tests for MarketingAbandonedCartDetailPage.
 * The existing test file only has 2 tests (40% coverage). This file adds full coverage
 * of the cart display, action buttons, item table, and error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetAbandonedCart = vi.fn();
const mockSendAbandonedCartRecovery = vi.fn();
const mockUpdateAbandonedCartStatus = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getAbandonedCart: (...a: any[]) => mockGetAbandonedCart(...a),
    sendAbandonedCartRecovery: (...a: any[]) => mockSendAbandonedCartRecovery(...a),
    updateAbandonedCartStatus: (...a: any[]) => mockUpdateAbandonedCartStatus(...a),
  },
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: any) => d ? `dt:${d}` : '',
  formatMoney: (v: any, _curr: any, _loc: any) => `$${v || 0}`,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ cartId: 'cart-abc' }),
}));

import MarketingAbandonedCartDetailPage from './MarketingAbandonedCartDetailPage';

const STORE_KEY = 'crm_marketing_store_id';

const cartData = {
  id: 'cart-abc',
  customer_email: 'jane@example.com',
  recovery_status: 'pending',
  cart_total: 150,
  abandoned_at: '2024-03-15T10:00:00Z',
  items_summary: [
    { item_id: 'item-1', name: 'Blue Widget', qty: 2, price: 50 },
    { item_id: 'item-2', name: 'Red Gadget', qty: 1, price: 50 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockSendAbandonedCartRecovery.mockResolvedValue({});
  mockUpdateAbandonedCartStatus.mockResolvedValue({});
  // Re-fetch after action returns the same cart
  mockGetAbandonedCart.mockResolvedValue(cartData);
});

describe('MarketingAbandonedCartDetailPage — no store selected', () => {
  it('shows store selection prompt when no store in localStorage', () => {
    render(<MarketingAbandonedCartDetailPage />);
    expect(screen.getByText(/select a store/i)).toBeInTheDocument();
  });

  it('does not call getAbandonedCart when no store is set', () => {
    render(<MarketingAbandonedCartDetailPage />);
    expect(mockGetAbandonedCart).not.toHaveBeenCalled();
  });
});

describe('MarketingAbandonedCartDetailPage — with store selected', () => {
  beforeEach(() => {
    localStorage.setItem(STORE_KEY, 'store-1');
  });

  it('shows back navigation button', async () => {
    render(<MarketingAbandonedCartDetailPage />);
    await waitFor(() => screen.getByText(/back to abandoned carts/i));
    expect(screen.getByText(/back to abandoned carts/i)).toBeInTheDocument();
  });

  it('back button navigates to abandoned carts page', async () => {
    render(<MarketingAbandonedCartDetailPage />);
    await waitFor(() => screen.getByText(/back to abandoned carts/i));
    fireEvent.click(screen.getByText(/back to abandoned carts/i));
    expect(mockNavigate).toHaveBeenCalledWith('/crm/marketing/abandoned-carts');
  });

  it('shows loading state while fetching', () => {
    mockGetAbandonedCart.mockReturnValue(new Promise(() => {}));
    render(<MarketingAbandonedCartDetailPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('calls getAbandonedCart with correct storeId and cartId', async () => {
    render(<MarketingAbandonedCartDetailPage />);
    await waitFor(() => {
      expect(mockGetAbandonedCart).toHaveBeenCalledWith('store-1', 'cart-abc');
    });
  });

  it('shows error message when API fails', async () => {
    mockGetAbandonedCart.mockRejectedValue(new Error('Server error'));
    render(<MarketingAbandonedCartDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('shows default error message when error has no message', async () => {
    mockGetAbandonedCart.mockRejectedValue({});
    render(<MarketingAbandonedCartDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load abandoned cart detail/i)).toBeInTheDocument();
    });
  });

  describe('Given cart data is loaded', () => {
    it('shows customer email', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/jane@example.com/)).toBeInTheDocument();
      });
    });

    it('shows recovery status', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/pending/)).toBeInTheDocument();
      });
    });

    it('shows cart total', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('$150')).toBeInTheDocument();
      });
    });

    it('shows abandoned at datetime', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/dt:2024-03-15/)).toBeInTheDocument();
      });
    });

    it('shows Abandoned Cart Detail heading', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Abandoned Cart Detail')).toBeInTheDocument();
      });
    });

    it('shows item names in table', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Blue Widget')).toBeInTheDocument();
        expect(screen.getByText('Red Gadget')).toBeInTheDocument();
      });
    });

    it('shows item quantities', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('shows item prices', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        const priceEls = screen.getAllByText('$50');
        expect(priceEls.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('shows Send Recovery action button', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Send Recovery')).toBeInTheDocument();
      });
    });

    it('shows Mark Recovered button', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Mark Recovered')).toBeInTheDocument();
      });
    });

    it('shows Mark Expired button', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Mark Expired')).toBeInTheDocument();
      });
    });
  });

  describe('Given action buttons are clicked', () => {
    it('Send Recovery calls sendAbandonedCartRecovery with storeId and cartId', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => screen.getByText('Send Recovery'));
      fireEvent.click(screen.getByText('Send Recovery'));
      await waitFor(() => {
        expect(mockSendAbandonedCartRecovery).toHaveBeenCalledWith('store-1', 'cart-abc');
      });
    });

    it('Mark Recovered calls updateAbandonedCartStatus with "recovered"', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => screen.getByText('Mark Recovered'));
      fireEvent.click(screen.getByText('Mark Recovered'));
      await waitFor(() => {
        expect(mockUpdateAbandonedCartStatus).toHaveBeenCalledWith('store-1', 'cart-abc', 'recovered');
      });
    });

    it('Mark Expired calls updateAbandonedCartStatus with "expired"', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => screen.getByText('Mark Expired'));
      fireEvent.click(screen.getByText('Mark Expired'));
      await waitFor(() => {
        expect(mockUpdateAbandonedCartStatus).toHaveBeenCalledWith('store-1', 'cart-abc', 'expired');
      });
    });

    it('after Send Recovery, cart is refetched', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => screen.getByText('Send Recovery'));
      fireEvent.click(screen.getByText('Send Recovery'));
      await waitFor(() => {
        // Called once on mount + once after action
        expect(mockGetAbandonedCart).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Given cart has empty items_summary', () => {
    it('shows "No item data found." message', async () => {
      mockGetAbandonedCart.mockResolvedValue({ ...cartData, items_summary: [] });
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('No item data found.')).toBeInTheDocument();
      });
    });
  });

  describe('Given cart has non-array items_summary', () => {
    it('treats it as empty and shows no item data message', async () => {
      mockGetAbandonedCart.mockResolvedValue({ ...cartData, items_summary: null });
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('No item data found.')).toBeInTheDocument();
      });
    });
  });
});
