/**
 * QuoteDetailPage — the customer a quote was raised for is visible on it
 *
 * A quote created from a deal now carries `customer_id` (crm-be resolves it from
 * `deals.lead_id`). The page already fetched that customer, but used it only for
 * the printed document and the send-email default — nothing on screen said who
 * the quote was for, so a seller had no way to confirm the link was right.
 *
 * These specs pin the panel, and pin that it stays quiet when there is no linked
 * customer rather than rendering an empty card.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetQuoteById = vi.fn();
const mockGetStockAvailability = vi.fn();
const mockGetLeadById = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getQuoteById: (...a: any[]) => mockGetQuoteById(...a),
    updateQuote: vi.fn(),
    submitQuoteForApproval: vi.fn(),
    approveQuote: vi.fn(),
    rejectQuote: vi.fn(),
    convertQuoteToOrder: vi.fn(),
    getStockAvailability: (...a: any[]) => mockGetStockAvailability(...a),
    sendQuote: vi.fn(),
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'q-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useOrganization: () => ({ currentOrg: { id: 'org-1', name: 'Test Org' } }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({ formatCurrency: (v: number) => `$${v}`, formatDate: (d: string) => d }),
}));

import QuoteDetailPage from './QuoteDetailPage';

const quoteFromDeal = {
  id: 'q-1',
  title: 'Quote for Acme — Q3 Expansion',
  status: 'draft',
  customer_id: 'lead-acme',
  deal_id: 'd1',
  subtotal: 45000,
  total_amount: 45000,
  created_at: '2026-01-01',
  lines: [
    { id: 'ql1', description: 'Product A', quantity: 2, unit_price: 10000, line_total: 20000, item_id: 'i1', discount_percent: 0, tax_rate: 0 },
    { id: 'ql2', description: 'Product B', quantity: 1, unit_price: 25000, line_total: 25000, item_id: 'i2', discount_percent: 0, tax_rate: 0 },
  ],
  deal: { id: 'd1', name: 'Acme — Q3 Expansion', company_name: 'Acme Ltd' },
};

const customer = {
  id: 'lead-acme',
  company_name: 'Acme Ltd',
  contact_name: 'Priya Nair',
  contact_email: 'ap@acme.example',
  phone: '+91 98400 00000',
  tax_id: '29ABCDE1234F1Z5',
};

beforeEach(async () => {
  vi.clearAllMocks();
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
  mockGetQuoteById.mockResolvedValue(quoteFromDeal);
  mockGetStockAvailability.mockResolvedValue({ items: [] });
  mockGetLeadById.mockResolvedValue(customer);
});

describe('QuoteDetailPage — the linked customer', () => {
  describe('Given a quote created from a deal, carrying that deal\'s customer', () => {
    it('When the page loads / Then the customer is fetched by the id the quote carries', async () => {
      render(<QuoteDetailPage />);

      await waitFor(() => expect(mockGetLeadById).toHaveBeenCalledWith('lead-acme'));
    });

    it('When the page loads / Then the customer panel names the company and its contact', async () => {
      render(<QuoteDetailPage />);

      await waitFor(() => expect(screen.getByText('Customer')).toBeInTheDocument());
      expect(screen.getAllByText('Acme Ltd').length).toBeGreaterThan(0);
      expect(screen.getByText('Priya Nair')).toBeInTheDocument();
    });

    it('When the page loads / Then the contact details carried over from the customer are shown', async () => {
      render(<QuoteDetailPage />);

      await waitFor(() => expect(screen.getByText('ap@acme.example')).toBeInTheDocument());
      expect(screen.getByText('+91 98400 00000')).toBeInTheDocument();
      expect(screen.getByText('29ABCDE1234F1Z5')).toBeInTheDocument();
    });

    it("When the deal's line items came across / Then they are listed on the quote", async () => {
      render(<QuoteDetailPage />);

      await waitFor(() => expect(screen.getAllByText(/Product A/).length).toBeGreaterThan(0));
      expect(screen.getAllByText(/Product B/).length).toBeGreaterThan(0);
    });
  });

  describe('Given the customer has no phone or tax id on file', () => {
    it('When the page loads / Then those rows are omitted rather than shown blank', async () => {
      mockGetLeadById.mockResolvedValue({ id: 'lead-acme', company_name: 'Acme Ltd', contact_email: 'ap@acme.example' });
      render(<QuoteDetailPage />);

      await waitFor(() => expect(screen.getByText('Customer')).toBeInTheDocument());
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
      expect(screen.queryByText('Tax ID')).not.toBeInTheDocument();
    });
  });

  describe('Given a quote with no linked customer', () => {
    it('When the page loads / Then no customer panel is rendered and no lookup is made', async () => {
      mockGetQuoteById.mockResolvedValue({ ...quoteFromDeal, customer_id: undefined });
      render(<QuoteDetailPage />);

      await waitFor(() => expect(screen.getByText('Quote Details')).toBeInTheDocument());
      expect(mockGetLeadById).not.toHaveBeenCalled();
      expect(screen.queryByText('Customer')).not.toBeInTheDocument();
    });
  });
});
