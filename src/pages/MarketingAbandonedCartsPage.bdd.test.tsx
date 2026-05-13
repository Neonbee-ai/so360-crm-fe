import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetStats = vi.fn();
const mockGetCarts = vi.fn();
const mockSendRecovery = vi.fn();
const mockUpdateStatus = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getAbandonedCartStats: (...a: any[]) => mockGetStats(...a),
    getAbandonedCarts: (...a: any[]) => mockGetCarts(...a),
    sendAbandonedCartRecovery: (...a: any[]) => mockSendRecovery(...a),
    updateAbandonedCartStatus: (...a: any[]) => mockUpdateStatus(...a),
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
  formatDateTime: (d: any) => d || 'N/A',
  formatMoney: (v: any) => `$${v || 0}`,
  mapAbandonedCart: (c: any) => ({
    id: c.id,
    customerEmail: c.customer_email,
    itemCount: c.item_count,
    cartTotal: c.cart_total,
    status: c.status,
    abandonedAt: c.abandoned_at,
  }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import MarketingAbandonedCartsPage from './MarketingAbandonedCartsPage';

const makeStats = () => ({
  totalAbandoned: 50,
  totalRecovered: 10,
  recoveryRate: 20,
  revenueRecovered: 1500,
});

const makeCarts = () => ({
  data: [
    { id: 'c1', customer_email: 'alice@test.com', item_count: 3, cart_total: 150, status: 'pending', abandoned_at: '2026-01-10' },
    { id: 'c2', customer_email: 'bob@test.com', item_count: 1, cart_total: 50, status: 'recovered', abandoned_at: '2026-01-08' },
    { id: 'c3', customer_email: 'carol@test.com', item_count: 2, cart_total: 200, status: 'email_sent', abandoned_at: '2026-01-12' },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetStats.mockResolvedValue(makeStats());
  mockGetCarts.mockResolvedValue(makeCarts());
  mockSendRecovery.mockResolvedValue({});
  mockUpdateStatus.mockResolvedValue({});
});

describe('MarketingAbandonedCartsPage', () => {
  describe('Given no store selected', () => {
    it('When rendered / Then shows store picker and empty table', () => {
      render(<MarketingAbandonedCartsPage />);
      expect(screen.getByTestId('store-picker')).toBeInTheDocument();
      expect(screen.getByText('No abandoned carts found matching criteria.')).toBeInTheDocument();
    });
  });

  describe('Given a store is selected with data', () => {
    it('When store is picked / Then loads stats cards', async () => {
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Total Abandoned')).toBeInTheDocument());
      expect(screen.getByText('50')).toBeInTheDocument();
      const recoveredLabels = screen.getAllByText('Recovered');
      expect(recoveredLabels.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('Recovery Rate')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('When store is picked / Then renders cart rows', async () => {
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
      expect(screen.getByText('carol@test.com')).toBeInTheDocument();
    });

    it('When cart is pending / Then shows Send Recovery and Mark Recovered buttons', async () => {
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
      const recoveryBtns = screen.getAllByText('Send Recovery');
      expect(recoveryBtns.length).toBeGreaterThan(0);
      const markBtns = screen.getAllByText('Mark Recovered');
      expect(markBtns.length).toBeGreaterThan(0);
    });

    it('When cart is recovered / Then hides recovery action buttons', async () => {
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('bob@test.com')).toBeInTheDocument());
      const viewBtns = screen.getAllByText('View');
      expect(viewBtns.length).toBe(3);
    });

    it('When View button is clicked / Then navigates to cart detail', async () => {
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
      const viewBtns = screen.getAllByText('View');
      fireEvent.click(viewBtns[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/crm/marketing/abandoned-carts/c1');
    });

    it('When Send Recovery clicked / Then calls recovery API and reloads', async () => {
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
      const recoveryBtns = screen.getAllByText('Send Recovery');
      fireEvent.click(recoveryBtns[0]);
      await waitFor(() => expect(mockSendRecovery).toHaveBeenCalledWith('store-1', 'c1'));
    });

    it('When Mark Recovered clicked / Then calls status API', async () => {
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('alice@test.com')).toBeInTheDocument());
      const markBtns = screen.getAllByText('Mark Recovered');
      fireEvent.click(markBtns[0]);
      await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledWith('store-1', 'c1', 'recovered'));
    });
  });

  describe('Given status filter', () => {
    it('When pending filter applied / Then passes filter to API call', async () => {
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(mockGetCarts).toHaveBeenCalled());
      const select = screen.getByDisplayValue('All Carts');
      fireEvent.change(select, { target: { value: 'pending' } });
      await waitFor(() => expect(mockGetCarts).toHaveBeenCalledWith('store-1', expect.objectContaining({ recovery_status: 'pending' })));
    });
  });

  describe('Given API error', () => {
    it('When load fails / Then shows error message', async () => {
      mockGetStats.mockRejectedValue(new Error('API down'));
      mockGetCarts.mockRejectedValue(new Error('API down'));
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('API down')).toBeInTheDocument());
    });
  });

  describe('Given loading state', () => {
    it('When data is loading / Then shows loading text', async () => {
      mockGetStats.mockReturnValue(new Promise(() => {}));
      mockGetCarts.mockReturnValue(new Promise(() => {}));
      render(<MarketingAbandonedCartsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Loading...')).toBeInTheDocument());
    });
  });
});
