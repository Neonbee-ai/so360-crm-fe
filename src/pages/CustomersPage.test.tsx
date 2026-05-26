import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetCustomers = vi.fn();
const mockGetCustomerStats = vi.fn();
const mockGetCustomerSegmentCustomers = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getCustomers: (...args: any[]) => mockGetCustomers(...args),
    getCustomerStats: (...args: any[]) => mockGetCustomerStats(...args),
    getCustomerSegmentCustomers: (...args: any[]) => mockGetCustomerSegmentCustomers(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/crm/customers', search: '' }),
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    isFeatureEnabled: () => true,
  }),
  useActivity: () => ({ recordActivity: async () => {} }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 0, isLimited: false }),}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, isLoading, emptyMessage }: any) => (
    <div data-testid="table">
      {isLoading ? 'Loading...' : data.length === 0 ? emptyMessage : `${data.length} rows`}
    </div>
  ),
}));

import CustomersPage from './CustomersPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCustomers.mockResolvedValue([]);
  mockGetCustomerStats.mockResolvedValue({ total: 0 });
});

describe('Given CustomersPage', () => {
  it('When action / Then renders header', async () => {
    render(<CustomersPage />);
    expect(screen.getByText('Customers')).toBeInTheDocument();
  });

  it('When action / Then shows loading then data', async () => {
    mockGetCustomers.mockResolvedValue([{ id: '1', contact_name: 'John', email: 'j@x.com', channel: 'manual', created_at: '2024-01-01' }]);
    render(<CustomersPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table')).toHaveTextContent('1 rows');
    });
  });

  it('When action / Then shows empty state', async () => {
    render(<CustomersPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table')).toHaveTextContent('No customers found');
    });
  });

  it('When action / Then displays stats', async () => {
    mockGetCustomerStats.mockResolvedValue({ total: 42 });
    render(<CustomersPage />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });
});
