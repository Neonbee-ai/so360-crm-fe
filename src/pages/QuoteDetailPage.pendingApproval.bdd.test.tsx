/**
 * BDD: sending a quote whose approval threshold is crossed (commit dc660e0).
 * The backend answers { sent:false, pending_approval:true, approval_reasons }
 * and the page must explain why instead of reporting a generic failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetQuoteById = vi.fn();
const mockSendQuote = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('../services/crmService', () => ({
  // ProposalEstimatorPanel (estimatorService) reads crmApiClient from this module.
  crmApiClient: { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({}), put: vi.fn().mockResolvedValue({}) },
  crmService: {
    getQuoteById: (...a: any[]) => mockGetQuoteById(...a),
    sendQuote: (...a: any[]) => mockSendQuote(...a),
    getStockAvailability: vi.fn().mockResolvedValue({ items: [] }),
  },
}));
vi.mock('../components/ProductPickerModal', () => ({ ProductPickerModal: () => null }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'q-1' }), useNavigate: () => vi.fn() }));
vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useOrganization: () => ({ currentOrg: { id: 'org-1', name: 'Test Org' } }),
}));
vi.mock('@so360/formatters', () => ({ useFormatters: () => ({ formatCurrency: (v: number) => `$${v}`, formatDate: (d: string) => d }) }));
vi.mock('@so360/design-system', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useConfirm: () => [vi.fn(async () => true), null],
  toast: { success: (...a: any[]) => mockToastSuccess(...a), error: (...a: any[]) => mockToastError(...a), info: vi.fn() },
  getErrorMessage: (e: any, fallback: string) => e?.message || fallback,
  QuotaBar: () => <div data-testid="quota-bar" />,
  QuotaGate: ({ children }: any) => <>{children}</>,
  CrossLinkChip: () => <span data-testid="cross-link-chip" />,
}));

import QuoteDetailPage from './QuoteDetailPage';

const quote = {
  id: 'q-1', title: 'Test Quote', status: 'draft' as const, quote_number: 'Q-0001',
  grand_total: 5000, subtotal: 5000, tax_amount: 0, discount_amount: 0, created_at: '2024-01-01',
  lines: [{ id: 'ql1', description: 'Widget A', quantity: 2, unit_price: 2500, line_total: 5000, discount_percent: 0, tax_rate: 0 }],
  customer_name: 'Acme Corp',
};

const openSendAndSubmit = async () => {
  const { container } = render(<QuoteDetailPage />);
  await waitFor(() => screen.getByText('Test Quote'));
  fireEvent.click(screen.getAllByText('Email to Customer')[0]);
  const input = await waitFor(() => {
    const el = container.ownerDocument.querySelector('[name="quote-send-to"]') as HTMLInputElement;
    expect(el).toBeTruthy();
    return el;
  });
  fireEvent.change(input, { target: { value: 'buyer@acme.test' } });
  fireEvent.click(screen.getByText('Send quotation'));
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuoteById.mockResolvedValue(quote);
});

describe('Given a quote that crosses a configured approval threshold', () => {
  describe('When the user sends it by email', () => {
    it('Then the toast explains each reason and the send modal closes', async () => {
      mockSendQuote.mockResolvedValue({
        sent: false, pending_approval: true,
        approval_reasons: [{ rule: 'discount', actual: 25, threshold: 10 }, { rule: 'total', actual: 9000, threshold: 5000 }],
      });
      await openSendAndSubmit();
      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(
        'Approval required before sending: Discount 25% exceeds 10%; Total 9000 exceeds 5000',
      ));
      expect(mockToastSuccess).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText('Send quotation')).not.toBeInTheDocument());
    });

    it('Then it still reports approval is required when no reasons are supplied', async () => {
      mockSendQuote.mockResolvedValue({ sent: false, pending_approval: true });
      await openSendAndSubmit();
      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Approval required before sending'));
    });
  });
});

describe('Given a quote that is within approval limits', () => {
  describe('When the user sends it by email', () => {
    it('Then a success toast names the recipient', async () => {
      mockSendQuote.mockResolvedValue({ sent: true, to: 'buyer@acme.test' });
      await openSendAndSubmit();
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Quotation emailed to buyer@acme.test'));
    });

    it('Then a refusal shows the backend reason', async () => {
      mockSendQuote.mockResolvedValue({ sent: false, reason: 'No recipient' });
      await openSendAndSubmit();
      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('No recipient'));
    });
  });
});
