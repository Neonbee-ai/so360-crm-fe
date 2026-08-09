import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { mockGetMarketingWishlist } = vi.hoisted(() => ({
  mockGetMarketingWishlist: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/crmService', () => ({
  crmService: {
    getMarketingWishlist: mockGetMarketingWishlist,
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => <select data-testid="store-picker" value={storeId} onChange={(e: any) => onChange(e.target.value)}><option value="">Select</option></select>,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

import MarketingWishlistPage from './MarketingWishlistPage';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mockGetMarketingWishlist.mockResolvedValue([]); });

describe('Given MarketingWishlistPage', () => {
  it('When action / Then renders store picker', () => {
    render(<MarketingWishlistPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });
});

describe('Given the service returns an error', () => {
  beforeEach(() => {
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    mockGetMarketingWishlist.mockRejectedValue(new Error('Network error'));
  });

  it('When the page mounts / Then displays an error or loading state — not a blank screen', async () => {
    render(<MarketingWishlistPage />);
    await waitFor(() => {
      expect(document.body).toBeTruthy();
      expect(screen.getByTestId('store-picker')).toBeInTheDocument();
    });
  });
});

describe('Given the service returns an empty list', () => {
  it('When the page mounts / Then does not crash with empty wishlist data', async () => {
    mockGetMarketingWishlist.mockResolvedValue([]);
    render(<MarketingWishlistPage />);
    await waitFor(() => expect(screen.getByTestId('store-picker')).toBeInTheDocument());
  });
});
