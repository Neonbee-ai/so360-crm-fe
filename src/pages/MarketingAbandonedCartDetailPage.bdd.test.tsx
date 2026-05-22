import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetCart = vi.fn();
const mockSendRecovery = vi.fn();
const mockUpdateStatus = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getAbandonedCart: (...a: any[]) => mockGetCart(...a),
    sendAbandonedCartRecovery: (...a: any[]) => mockSendRecovery(...a),
    updateAbandonedCartStatus: (...a: any[]) => mockUpdateStatus(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ cartId: 'cart-1' }),
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: any) => d || 'N/A',
  formatMoney: (v: any) => `$${v || 0}`,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
  useActivity: () => ({ recordActivity: async () => {} }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import MarketingAbandonedCartDetailPage from './MarketingAbandonedCartDetailPage';

const makeCart = () => ({
  id: 'cart-1',
  customer_email: 'alice@test.com',
  recovery_status: 'pending',
  cart_total: 150,
  abandoned_at: '2026-01-10',
  items_summary: [
    { item_id: 'i1', name: 'Sneakers', qty: 2, price: 50 },
    { item_id: 'i2', item_name: 'Hat', quantity: 1, unit_price: 50 },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('crm_marketing_store_id', 'store-1');
  mockGetCart.mockResolvedValue(makeCart());
  mockSendRecovery.mockResolvedValue({});
  mockUpdateStatus.mockResolvedValue({});
});

describe('MarketingAbandonedCartDetailPage', () => {
  describe('Given no store selected', () => {
    it('When rendered / Then shows store selection prompt', () => {
      localStorage.clear();
      render(<MarketingAbandonedCartDetailPage />);
      expect(screen.getByText(/Select a store/)).toBeInTheDocument();
    });
  });

  describe('Given store is selected and cart loads', () => {
    it('When rendered / Then shows cart detail with customer email', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
    });

    it('When rendered / Then shows recovery status', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => expect(screen.getByText('pending')).toBeInTheDocument());
    });

    it('When rendered / Then shows back button', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      expect(screen.getByText(/Back to Abandoned Carts/)).toBeInTheDocument();
    });

    it('When back button clicked / Then navigates to list', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      fireEvent.click(screen.getByText(/Back to Abandoned Carts/));
      expect(mockNavigate).toHaveBeenCalledWith('/crm/marketing/abandoned-carts');
    });

    it('When rendered / Then shows item rows', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => expect(screen.getByText('Sneakers')).toBeInTheDocument());
      expect(screen.getByText('Hat')).toBeInTheDocument();
    });

    it('When Send Recovery clicked / Then calls API', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => expect(screen.getByText('Send Recovery')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Send Recovery'));
      await waitFor(() => expect(mockSendRecovery).toHaveBeenCalledWith('store-1', 'cart-1'));
    });

    it('When Mark Recovered clicked / Then calls update status API', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => expect(screen.getByText('Mark Recovered')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Mark Recovered'));
      await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledWith('store-1', 'cart-1', 'recovered'));
    });

    it('When Mark Expired clicked / Then calls update status API', async () => {
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => expect(screen.getByText('Mark Expired')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Mark Expired'));
      await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledWith('store-1', 'cart-1', 'expired'));
    });
  });

  describe('Given cart has no items', () => {
    it('When rendered / Then shows no item data message', async () => {
      mockGetCart.mockResolvedValue({ ...makeCart(), items_summary: [] });
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => expect(screen.getByText('No item data found.')).toBeInTheDocument());
    });
  });

  describe('Given loading state', () => {
    it('When loading / Then shows loading text', async () => {
      mockGetCart.mockReturnValue(new Promise(() => {}));
      render(<MarketingAbandonedCartDetailPage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Given API error', () => {
    it('When load fails / Then shows error message', async () => {
      mockGetCart.mockRejectedValue(new Error('Cart not found'));
      render(<MarketingAbandonedCartDetailPage />);
      await waitFor(() => expect(screen.getByText('Cart not found')).toBeInTheDocument());
    });
  });
});
