import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../services/crmService', () => ({
  crmService: {
    getMarketingReviews: vi.fn().mockResolvedValue([]),
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

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('MarketingReviewsPage', () => {
  it('renders store picker', () => {
    render(<MarketingReviewsPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });
});
