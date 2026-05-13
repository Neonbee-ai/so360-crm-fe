import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetReviews = vi.fn();
const mockShowError = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getMarketingReviews: (...a: any[]) => mockGetReviews(...a),
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

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: mockShowError, dismissToast: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

import MarketingReviewsPage from './MarketingReviewsPage';

const makeReviews = () => [
  {
    id: 'r1',
    title: 'Great Product',
    content: 'Loved the quality and fit',
    rating: 5,
    is_approved: true,
    created_at: '2026-01-10',
    items: { name: 'Running Shoes' },
    storefront_customers: { first_name: 'Alice', last_name: 'Smith', crm_lead_id: 'lead-1' },
  },
  {
    id: 'r2',
    title: null,
    content: null,
    rating: 2,
    is_approved: false,
    created_at: '2026-01-12',
    items: null,
    storefront_customers: { first_name: 'Bob', last_name: null, crm_lead_id: null },
  },
  {
    id: 'r3',
    title: 'Decent',
    content: 'Works well for hiking',
    rating: 3,
    is_approved: true,
    created_at: '2026-01-14',
    items: { name: 'Hiking Boots' },
    storefront_customers: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetReviews.mockResolvedValue(makeReviews());
});

describe('MarketingReviewsPage', () => {
  describe('Given no store selected', () => {
    it('When rendered / Then shows no reviews empty state', () => {
      render(<MarketingReviewsPage />);
      expect(screen.getByText(/No reviews found/)).toBeInTheDocument();
    });
  });

  describe('Given a store is selected', () => {
    it('When store is picked / Then loads and displays reviews', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Great Product')).toBeInTheDocument());
      expect(screen.getByText('Decent')).toBeInTheDocument();
    });

    it('When review is approved / Then shows Approved badge', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Great Product')).toBeInTheDocument());
      const approved = screen.getAllByText('Approved');
      expect(approved.length).toBeGreaterThan(0);
    });

    it('When review is pending / Then shows Pending Approval badge', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Pending Approval')).toBeInTheDocument());
    });

    it('When review has no title / Then shows Untitled Review', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Untitled Review')).toBeInTheDocument());
    });

    it('When review has no content / Then shows No content provided', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText(/"No content provided"/)).toBeInTheDocument());
    });

    it('When review has no product / Then shows Unknown Item', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Unknown Item')).toBeInTheDocument());
    });

    it('When reviewer has CRM lead ID / Then renders link to lead', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
      const link = screen.getByText('Alice Smith').closest('a');
      expect(link?.getAttribute('href')).toBe('/crm/leads/lead-1');
    });

    it('When reviewer has no CRM lead ID / Then renders name as text', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    });

    it('When reviewer is anonymous / Then renders Anonymous', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getAllByText('Anonymous').length).toBeGreaterThan(0));
    });

    it('When review content is present / Then displays quoted content', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText(/"Loved the quality and fit"/)).toBeInTheDocument());
    });
  });

  describe('Given status filter', () => {
    it('When pending filter clicked / Then shows only pending reviews', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Great Product')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'pending' }));
      expect(screen.getByText('Untitled Review')).toBeInTheDocument();
      expect(screen.queryByText('Great Product')).not.toBeInTheDocument();
    });

    it('When approved filter clicked / Then shows only approved reviews', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Great Product')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'approved' }));
      expect(screen.getByText('Great Product')).toBeInTheDocument();
      expect(screen.queryByText('Untitled Review')).not.toBeInTheDocument();
    });

    it('When all filter clicked / Then shows all reviews', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Great Product')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'pending' }));
      fireEvent.click(screen.getByRole('button', { name: 'all' }));
      expect(screen.getByText('Great Product')).toBeInTheDocument();
      expect(screen.getByText('Untitled Review')).toBeInTheDocument();
    });
  });

  describe('Given search filter', () => {
    it('When searching by product name / Then filters reviews', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Great Product')).toBeInTheDocument());
      const searchInput = screen.getByPlaceholderText('Filter by product, title, or content...');
      await userEvent.type(searchInput, 'Running Shoes');
      expect(screen.getByText('Great Product')).toBeInTheDocument();
      expect(screen.queryByText('Decent')).not.toBeInTheDocument();
    });

    it('When searching by review content / Then filters reviews', async () => {
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText('Decent')).toBeInTheDocument());
      const searchInput = screen.getByPlaceholderText('Filter by product, title, or content...');
      await userEvent.type(searchInput, 'hiking');
      expect(screen.getByText('Decent')).toBeInTheDocument();
      expect(screen.queryByText('Great Product')).not.toBeInTheDocument();
    });
  });

  describe('Given API error', () => {
    it('When review load fails / Then shows error toast', async () => {
      mockGetReviews.mockRejectedValue(new Error('Cannot fetch'));
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Cannot fetch'));
    });
  });

  describe('Given loading state', () => {
    it('When reviews are loading / Then shows loading spinner', async () => {
      mockGetReviews.mockReturnValue(new Promise(() => {}));
      render(<MarketingReviewsPage />);
      fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
      await waitFor(() => expect(screen.getByText(/Loading reviews/)).toBeInTheDocument());
    });
  });
});
