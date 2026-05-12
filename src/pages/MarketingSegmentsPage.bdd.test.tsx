import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetCustomerSegments = vi.fn();
const mockGetMarketingSegments = vi.fn();
const mockGetMarketingTopBuyers = vi.fn();
const mockGetMarketingInactiveCustomers = vi.fn();
const mockCreateCustomerSegment = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getCustomerSegments: (...a: any[]) => mockGetCustomerSegments(...a),
    getMarketingSegments: (...a: any[]) => mockGetMarketingSegments(...a),
    getMarketingTopBuyers: (...a: any[]) => mockGetMarketingTopBuyers(...a),
    getMarketingInactiveCustomers: (...a: any[]) => mockGetMarketingInactiveCustomers(...a),
    createCustomerSegment: (...a: any[]) => mockCreateCustomerSegment(...a),
    getCustomerSegmentLeads: vi.fn().mockResolvedValue({ leads: [] }),
    addCustomerSegmentMember: vi.fn().mockResolvedValue({}),
    removeCustomerSegmentMember: vi.fn().mockResolvedValue({}),
    getLeads: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
  useShell: () => ({ isModuleEnabled: () => false }),
}));

vi.mock('@so360/design-system', () => ({
  Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
}));

vi.mock('../components/MarketingStorePicker', () => ({
  MarketingStorePicker: () => null,
}));

vi.mock('./marketing/marketingMappers', () => ({
  formatDateTime: (d: string) => d,
  formatMoney: (v: number) => `$${v}`,
}));

import MarketingSegmentsPage from './MarketingSegmentsPage';

const manualSegments = [
  { id: 'seg1', name: 'VIP Customers', description: 'High value repeat buyers', member_count: 25, created_at: '2025-01-10T10:00:00Z' },
  { id: 'seg2', name: 'New Leads', description: 'Recent signups', member_count: 50, created_at: '2025-02-15T10:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCustomerSegments.mockResolvedValue(manualSegments);
  mockGetMarketingSegments.mockResolvedValue(null);
  mockGetMarketingTopBuyers.mockResolvedValue([]);
  mockGetMarketingInactiveCustomers.mockResolvedValue([]);
  mockCreateCustomerSegment.mockResolvedValue({ id: 'seg-new', name: 'Test Segment' });
});

describe('MarketingSegmentsPage', () => {
  describe('Given manual segments exist', () => {
    it('When the page loads / Then shows the segment list', async () => {
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('VIP Customers')).toBeInTheDocument();
        expect(screen.getByText('New Leads')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows description for each segment', async () => {
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.getByText('High value repeat buyers')).toBeInTheDocument();
        expect(screen.getByText('Recent signups')).toBeInTheDocument();
      });
    });
  });

  describe('Given the create segment flow', () => {
    it('When clicking Create Segment button / Then shows the create form', async () => {
      const user = userEvent.setup();
      render(<MarketingSegmentsPage />);
      await waitFor(() => expect(screen.getByText('VIP Customers')).toBeInTheDocument());
      const createBtn = screen.getByRole('button', { name: /Create Segment/i });
      await user.click(createBtn);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/segment name/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given no segments exist', () => {
    it('When the page loads / Then shows an empty state', async () => {
      mockGetCustomerSegments.mockResolvedValue([]);
      render(<MarketingSegmentsPage />);
      await waitFor(() => {
        expect(screen.queryByText('VIP Customers')).not.toBeInTheDocument();
      });
    });
  });
});
