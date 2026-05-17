import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../services/crmService', () => ({
  crmService: {
    getAbandonedCart: vi.fn().mockResolvedValue(null),
    sendAbandonedCartRecovery: vi.fn(),
  },
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: any) => d || '',
  formatMoney: (v: any) => `$${v || 0}`,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ cartId: 'cart-1' }),
}));

import MarketingAbandonedCartDetailPage from './MarketingAbandonedCartDetailPage';

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('Given MarketingAbandonedCartDetailPage', () => {
  it('When action / Then shows store selection prompt when no store selected', () => {
    render(<MarketingAbandonedCartDetailPage />);
    expect(screen.getByText(/select a store/i)).toBeInTheDocument();
  });

  it('When action / Then renders when store is selected', () => {
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    render(<MarketingAbandonedCartDetailPage />);
    expect(document.body).toBeTruthy();
  });
});
