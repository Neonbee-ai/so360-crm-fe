import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../services/crmService', () => ({
  crmService: {
    getAbandonedCartStats: vi.fn().mockResolvedValue({}),
    getAbandonedCarts: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: ({ storeId, onChange }: any) => <select data-testid="store-picker" value={storeId} onChange={(e: any) => onChange(e.target.value)}><option value="">Select</option></select>,
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: any) => d || '',
  formatMoney: (v: any) => `$${v || 0}`,
  mapAbandonedCart: (c: any) => c,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD' } }),
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import MarketingAbandonedCartsPage from './MarketingAbandonedCartsPage';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('MarketingAbandonedCartsPage', () => {
  it('renders store picker', () => {
    render(<MarketingAbandonedCartsPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });
});
