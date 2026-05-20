import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetQuoteById = vi.fn();
const mockUpdateQuote = vi.fn();
const mockSubmitQuoteForApproval = vi.fn();
const mockApproveQuote = vi.fn();
const mockRejectQuote = vi.fn();
const mockConvertQuoteToOrder = vi.fn();
const mockGetStockAvailability = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getQuoteById: (...a: any[]) => mockGetQuoteById(...a),
    updateQuote: (...a: any[]) => mockUpdateQuote(...a),
    submitQuoteForApproval: (...a: any[]) => mockSubmitQuoteForApproval(...a),
    approveQuote: (...a: any[]) => mockApproveQuote(...a),
    rejectQuote: (...a: any[]) => mockRejectQuote(...a),
    convertQuoteToOrder: (...a: any[]) => mockConvertQuoteToOrder(...a),
    getStockAvailability: (...a: any[]) => mockGetStockAvailability(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'q-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({
    settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' },
  }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatDate: (d: string) => d,
  }),
}));

import QuoteDetailPage from './QuoteDetailPage';

const quoteData = {
  id: 'q-1', title: 'Test Quote', status: 'draft', total: 5000, subtotal: 5000,
  tax_amount: 0, discount_amount: 0, valid_until: '2024-12-31',
  notes: 'Some notes', terms_and_conditions: 'Net 30', created_at: '2024-01-01',
  lines: [
    { id: 'ql1', description: 'Widget A', quantity: 2, unit_price: 2500, line_total: 5000, item_id: 'i1', discount_percent: 0, tax_rate: 0 },
  ],
  deal: { id: 'd1', name: 'Deal 1' },
  customer: { id: 'c1', company_name: 'Acme' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuoteById.mockResolvedValue(quoteData);
  mockGetStockAvailability.mockResolvedValue({ items: [{ item_id: 'i1', available_quantity: 100 }] });
  mockUpdateQuote.mockResolvedValue(quoteData);
  mockSubmitQuoteForApproval.mockResolvedValue({ ...quoteData, status: 'pending_approval' });
  mockApproveQuote.mockResolvedValue({ ...quoteData, status: 'approved' });
  mockRejectQuote.mockResolvedValue({ ...quoteData, status: 'rejected' });
  mockConvertQuoteToOrder.mockResolvedValue({ order_id: 'o1' });
});

describe('QuoteDetailPage', () => {
  describe('Given the quote is loading', () => {
    it('When fetch is pending / Then renders the page container without crashing', () => {
      mockGetQuoteById.mockReturnValue(new Promise(() => {}));
      render(<QuoteDetailPage />);
      expect(document.body).toBeTruthy();
    });
  });

  describe('Given the quote is not found', () => {
    it('When fetch fails / Then shows an error message', async () => {
      mockGetQuoteById.mockRejectedValue(new Error('Not found'));
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/not found|error|failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given a Draft quote is loaded', () => {
    it('When rendered / Then shows the quote title', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Test Quote')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the Draft status badge', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText(/draft/i).length).toBeGreaterThan(0);
      });
    });

    it('When rendered / Then shows the line item descriptions', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Widget A')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the linked deal name', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Deal 1')).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows the quote total amount', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('$5000').length).toBeGreaterThan(0);
      });
    });

    it('When rendered / Then shows the Submit for Approval action button', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/submit for approval/i)).toBeInTheDocument();
      });
    });

    it('When rendered / Then shows an Edit button', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      const editBtns = screen.getAllByText(/edit/i);
      expect(editBtns.length).toBeGreaterThan(0);
    });

    it('When line items have item_ids / Then fetches stock availability', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(mockGetStockAvailability).toHaveBeenCalledWith(['i1']);
      });
    });
  });

  describe('Given a quote in Pending Approval status', () => {
    it('When rendered / Then shows Approve and Reject buttons', async () => {
      mockGetQuoteById.mockResolvedValue({ ...quoteData, status: 'pending_approval' });
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/approve/i)).toBeInTheDocument();
        expect(screen.getByText(/reject/i)).toBeInTheDocument();
      });
    });
  });

  describe('Given an Approved quote', () => {
    it('When rendered / Then shows the Convert to Order button', async () => {
      mockGetQuoteById.mockResolvedValue({ ...quoteData, status: 'approved' });
      render(<QuoteDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/convert to order/i)).toBeInTheDocument();
      });
    });
  });
});
