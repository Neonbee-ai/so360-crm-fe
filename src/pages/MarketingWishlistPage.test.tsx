import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../services/crmService', () => ({
  crmService: {
    getMarketingWishlist: vi.fn().mockResolvedValue([]),
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

import MarketingWishlistPage from './MarketingWishlistPage';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('Given MarketingWishlistPage', () => {
  it('When action / Then renders store picker', () => {
    render(<MarketingWishlistPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });
});
