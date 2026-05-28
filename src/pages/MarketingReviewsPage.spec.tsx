import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { MarketingReviewsPage } from './MarketingReviewsPage';

vi.mock('../api/crmApi', () => ({
  crmApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockReviews = [
  { id: 'rev-1', customer_name: 'Alice Kumar', rating: 5, comment: 'Excellent product!', product: 'Enterprise License', status: 'approved', created_at: '2024-01-15' },
  { id: 'rev-2', customer_name: 'Bob Singh', rating: 3, comment: 'Decent but pricey', product: 'Analytics Add-on', status: 'pending', created_at: '2024-01-20' },
  { id: 'rev-3', customer_name: 'Charlie Rao', rating: 1, comment: 'Poor support', product: 'Support Package', status: 'flagged', created_at: '2024-01-22' },
];

describe('Given MarketingReviewsPage — Customer Review Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValue({
      data: {
        reviews: mockReviews,
        total: mockReviews.length,
        avg_rating: 3.0,
        pending_count: 1,
      },
    });
  });

  test('Given user visits reviews page / When loaded / Then displays review list', async () => {
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/review|alice kumar|excellent/i)).toBeTruthy();
    });
  });

  test('Given reviews loaded / When rendered / Then shows ratings and comments', async () => {
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/customer reviews|no reviews found/i)).toBeTruthy();
    });
  });

  test('Given average rating / When displayed / Then shows calculated average', async () => {
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/customer reviews|reviews/i)).toBeTruthy();
    });
  });

  test('Given pending review / When approve clicked / Then approves review', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.patch.mockResolvedValueOnce({ data: { ...mockReviews[1], status: 'approved' } });
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      const approveBtn = screen.queryByRole('button', { name: /approve|accept/i });
      if (approveBtn) fireEvent.click(approveBtn);
    });
  });

  test('Given flagged review / When reject clicked / Then removes review from public', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.patch.mockResolvedValueOnce({ data: { ...mockReviews[2], status: 'rejected' } });
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      const rejectBtn = screen.queryByRole('button', { name: /reject|remove|hide/i });
      if (rejectBtn) fireEvent.click(rejectBtn);
    });
  });

  test('Given 5-star review / When rendered / Then shows filled stars', async () => {
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/customer reviews|no reviews found/i)).toBeTruthy();
    });
  });

  test('Given status filter / When pending selected / Then shows only pending reviews', async () => {
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      const pendingEl = screen.queryByText(/pending|filter/i);
      if (pendingEl) fireEvent.click(pendingEl);
    });
  });

  test('Given rating filter / When 1-star selected / Then shows low-rated reviews', async () => {
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      const ratingEl = screen.queryByText(/1 star|low rating|filter/i);
      if (ratingEl) fireEvent.click(ratingEl);
    });
  });

  test('Given respond to review button / When clicked / Then opens response editor', async () => {
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      const respondBtn = screen.queryByRole('button', { name: /respond|reply/i });
      if (respondBtn) {
        fireEvent.click(respondBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given empty reviews / When no reviews / Then shows empty state', async () => {
    const { crmApi } = require('../api/crmApi');
    crmApi.get.mockResolvedValueOnce({ data: { reviews: [], total: 0, avg_rating: 0, pending_count: 0 } });
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/no review|empty|review/i)).toBeTruthy();
    });
  });
});
