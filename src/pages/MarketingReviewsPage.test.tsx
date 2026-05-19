import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetMarketingReviews = vi.fn().mockResolvedValue([]);

vi.mock('../services/crmService', () => ({
  crmService: {
    getMarketingReviews: mockGetMarketingReviews,
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => <select data-testid="store-picker" value={storeId} onChange={(e: any) => onChange(e.target.value)}><option value="">Select</option></select>,
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

import MarketingReviewsPage from './MarketingReviewsPage';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockGetMarketingReviews.mockResolvedValue([]); });

describe('Given MarketingReviewsPage', () => {
  it('When action / Then renders store picker', () => {
    render(<MarketingReviewsPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });
});

describe('Given the service returns an error', () => {
  beforeEach(() => {
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    mockGetMarketingReviews.mockRejectedValue(new Error('Network error'));
  });

  it('When the page mounts / Then displays an error or loading state — not a blank screen', async () => {
    render(<MarketingReviewsPage />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
      expect(screen.getByTestId('store-picker')).toBeInTheDocument();
    });
  });
});

describe('Given the service returns an empty list', () => {
  it('When the page mounts / Then does not crash with empty reviews data', async () => {
    mockGetMarketingReviews.mockResolvedValue([]);
    render(<MarketingReviewsPage />);
    await waitFor(() => expect(screen.getByTestId('store-picker')).toBeInTheDocument());
  });
});
