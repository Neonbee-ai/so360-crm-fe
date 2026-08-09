import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetWishlist = vi.fn();
const mockShowError = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getMarketingWishlist: (...a: any[]) => mockGetWishlist(...a),
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

vi.mock('@so360/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@so360/design-system')>();
  return {
    ...actual,
    toast: { ...actual.toast, error: mockShowError },
  };
});

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

import MarketingWishlistPage from './MarketingWishlistPage';

const makeWishlist = () => [
  {
    id: 'w1',
    added_at: '2026-01-10',
    items: { name: 'Cool Sneakers', image_urls: ['https://img.test/1.jpg'] },
    storefront_customers: { first_name: 'Alice', last_name: 'Smith', email: 'alice@test.com', crm_lead_id: 'lead-1' },
  },
  {
    id: 'w2',
    added_at: '2026-01-12',
    items: { name: 'Red Jacket', image_urls: [] },
    storefront_customers: { first_name: 'Bob', last_name: '', email: 'bob@test.com', crm_lead_id: null },
  },
  {
    id: 'w3',
    added_at: '2026-01-14',
    items: null,
    storefront_customers: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetWishlist.mockResolvedValue(makeWishlist());
});

describe('MarketingWishlistPage', () => {
  describe('Given no store selected', () => {
    it('When rendered / Then shows empty state', () => {
      render(<MarketingWishlistPage />);
      expect(screen.getByText(/No wishlist items found/)).toBeInTheDocument();
    });
  });

  describe('Given a store is selected', () => {
    it('When store is picked / Then loads wishlist items', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Cool Sneakers')).toBeInTheDocument());
      expect(screen.getByText('Red Jacket')).toBeInTheDocument();
    });

    it('When item has customer with CRM lead / Then renders link to lead', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Cool Sneakers')).toBeInTheDocument());
      const link = screen.getByText('Alice Smith').closest('a');
      expect(link?.getAttribute('href')).toBe('/crm/leads/lead-1');
    });

    it('When item has customer without CRM lead / Then renders name as text', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Red Jacket')).toBeInTheDocument());
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('When item has no customer / Then renders Anonymous', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getAllByText('Anonymous').length).toBeGreaterThan(0));
    });

    it('When item has no product name / Then renders Unknown Item', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Unknown Item')).toBeInTheDocument());
    });

    it('When item has product image / Then renders image tag', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Cool Sneakers')).toBeInTheDocument());
      const img = screen.getByAltText('Cool Sneakers');
      expect(img.getAttribute('src')).toBe('https://img.test/1.jpg');
    });

    it('When search matches product name / Then filters list', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Cool Sneakers')).toBeInTheDocument());
      const searchInput = screen.getByPlaceholderText('Filter by product or customer name...');
      await userEvent.type(searchInput, 'Sneakers');
      expect(screen.getByText('Cool Sneakers')).toBeInTheDocument();
      expect(screen.queryByText('Red Jacket')).not.toBeInTheDocument();
    });

    it('When search matches customer name / Then filters list', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Cool Sneakers')).toBeInTheDocument());
      const searchInput = screen.getByPlaceholderText('Filter by product or customer name...');
      await userEvent.type(searchInput, 'Alice');
      expect(screen.getByText('Cool Sneakers')).toBeInTheDocument();
      expect(screen.queryByText('Red Jacket')).not.toBeInTheDocument();
    });

    it('When wishlist count renders / Then shows correct total', async () => {
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText(/Wishlist Activity Feed \(3\)/)).toBeInTheDocument());
    });
  });

  describe('Given API error', () => {
    it('When wishlist load fails / Then shows error toast', async () => {
      mockGetWishlist.mockRejectedValue(new Error('Server error'));
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Server error'));
    });
  });

  describe('Given loading state', () => {
    it('When data is loading / Then shows spinner text', async () => {
      mockGetWishlist.mockReturnValue(new Promise(() => {}));
      render(<MarketingWishlistPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText(/Tracking intent/)).toBeInTheDocument());
    });
  });
});
