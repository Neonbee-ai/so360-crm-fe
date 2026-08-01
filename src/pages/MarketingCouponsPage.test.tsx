import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetCoupons = vi.fn();
const mockCreateCoupon = vi.fn();
const mockUpdateCoupon = vi.fn();
const mockDeleteCoupon = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getCoupons: (...a: any[]) => mockGetCoupons(...a),
    createCoupon: (...a: any[]) => mockCreateCoupon(...a),
    updateCoupon: (...a: any[]) => mockUpdateCoupon(...a),
    deleteCoupon: (...a: any[]) => mockDeleteCoupon(...a),
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
  useToast: () => ({ toasts: [], showSuccess: mockShowSuccess, showError: mockShowError, dismissToast: vi.fn() }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

vi.mock('./marketing/marketingMappers', () => ({
  formatMoney: (v: any) => `$${v || 0}`,
}));

import MarketingCouponsPage from './MarketingCouponsPage';

const coupons = [
  { id: 'cp1', code: 'SAVE10', description: '10% off', discount_type: 'percentage', discount_value: 10, min_order_amount: 100, usage_limit: 50, usage_count: 5, valid_from: '2024-01-01', valid_until: '2024-12-31', is_active: true },
  { id: 'cp2', code: 'FLAT20', description: 'Flat $20 off', discount_type: 'fixed', discount_value: 20, min_order_amount: 0, usage_limit: 0, usage_count: 0, valid_from: '', valid_until: '', is_active: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetCoupons.mockResolvedValue(coupons);
  mockCreateCoupon.mockResolvedValue({ id: 'cp-new' });
  mockUpdateCoupon.mockResolvedValue({ id: 'cp1' });
  mockDeleteCoupon.mockResolvedValue({});
});

describe('Given MarketingCouponsPage', () => {
  it('When action / Then renders store picker', () => {
    render(<MarketingCouponsPage />);
    expect(screen.getByTestId('store-picker')).toBeInTheDocument();
  });

  it('When action / Then loads coupons when store selected', async () => {
    render(<MarketingCouponsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => {
      expect(mockGetCoupons).toHaveBeenCalledWith('store-1');
      expect(screen.getByText('SAVE10')).toBeInTheDocument();
      expect(screen.getByText('FLAT20')).toBeInTheDocument();
    });
  });

  it('When action / Then shows coupon details', async () => {
    render(<MarketingCouponsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => {
      expect(screen.getByText('10% off')).toBeInTheDocument();
    });
  });

  it('When action / Then shows create form when Add Coupon clicked', async () => {
    render(<MarketingCouponsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => screen.getByText('SAVE10'));
    const addBtn = screen.getByText(/add coupon|create|new coupon/i);
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/code/i)).toBeInTheDocument();
    });
  });

  it('When action / Then handles load error', async () => {
    mockGetCoupons.mockRejectedValue(new Error('Load failed'));
    render(<MarketingCouponsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('Load failed');
    });
  });

  it('When action / Then persists store to localStorage', () => {
    render(<MarketingCouponsPage />);
    fireEvent.change(screen.getByTestId('store-picker'), { target: { value: 'store-1' } });
    expect(localStorage.getItem('crm_marketing_store_id')).toBe('store-1');
  });
});
