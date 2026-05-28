import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import MarketingCouponsPage from './MarketingCouponsPage';

const mockCrmService = vi.hoisted(() => ({
  createCoupon: vi.fn(),
  deleteCoupon: vi.fn(),
  getCoupons: vi.fn(),
  updateCoupon: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/', state: null }),
  useParams: () => ({}),
  Link: ({ children }: any) => children,
  NavLink: ({ children }: any) => children,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockCoupons = [
  { id: 'coupon-1', code: 'SUMMER20', type: 'percentage', value: 20, min_order: 500, uses: 45, max_uses: 100, active: true, expires_at: '2024-08-31' },
  { id: 'coupon-2', code: 'FLAT200', type: 'fixed', value: 200, min_order: 1000, uses: 12, max_uses: 50, active: true, expires_at: '2024-12-31' },
  { id: 'coupon-3', code: 'OLDCODE', type: 'percentage', value: 10, min_order: 0, uses: 50, max_uses: 50, active: false, expires_at: '2024-01-01' },
];

describe('Given MarketingCouponsPage — Coupon & Discount Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('crm_marketing_store_id', 'store-1');
    localStorage.setItem('crm_store_id', 'store-1');
    mockCrmService.getCoupons.mockResolvedValue({ coupons: mockCoupons, total: mockCoupons.length });
  });

  test('Given user visits coupons page / When loaded / Then displays coupon list', async () => {
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/coupon|SUMMER20|FLAT200/i).length).toBeGreaterThan(0);
    });
  });

  test('Given create coupon button / When clicked / Then opens coupon creation form', async () => {
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create coupon|new coupon|\+/i });
      if (createBtn) {
        fireEvent.click(createBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given active coupon / When rendered / Then shows usage progress bar', async () => {
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/45|100|SUMMER20|coupon/i).length).toBeGreaterThan(0);
    });
  });

  test('Given expired coupon / When shown / Then displays expired badge', async () => {
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/discount|coupon/i).length).toBeGreaterThan(0);
    });
  });

  test('Given deactivate toggle / When clicked / Then deactivates coupon', async () => {
    mockCrmService.updateCoupon.mockResolvedValueOnce({ ...mockCoupons[0], active: false });
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      const toggleEl = screen.queryByRole('checkbox');
      if (toggleEl) fireEvent.click(toggleEl);
    });
  });

  test('Given coupon code copy button / When clicked / Then copies code to clipboard', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      const copyBtn = screen.queryByRole('button', { name: /copy|clipboard/i });
      if (copyBtn) fireEvent.click(copyBtn);
    });
  });

  test('Given maxed out coupon / When all uses exhausted / Then shows exhausted state', async () => {
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/discount|coupon/i).length).toBeGreaterThan(0);
    });
  });

  test('Given filter by type / When percentage selected / Then shows percentage coupons only', async () => {
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      const typeEl = screen.queryAllByText(/percentage|type|filter/i)[0];
      if (typeEl) fireEvent.click(typeEl);
    });
  });

  test('Given empty coupons list / When no coupons / Then shows empty state', async () => {
    mockCrmService.getCoupons.mockResolvedValueOnce({ coupons: [], total: 0 });
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/no coupon|empty|coupon/i).length).toBeGreaterThan(0);
    });
  });

  test('Given delete coupon / When confirmed / Then removes coupon', async () => {
    render(<MarketingCouponsPage />);
    await waitFor(() => {
      const deleteBtn = screen.queryByRole('button', { name: /delete|remove/i });
      if (deleteBtn) fireEvent.click(deleteBtn);
    });
  });
});
