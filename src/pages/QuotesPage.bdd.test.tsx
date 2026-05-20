import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetQuotes = vi.fn();
const mockGetDeals = vi.fn();
const mockCreateQuote = vi.fn();
const mockDeleteQuote = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getQuotes: (...a: any[]) => mockGetQuotes(...a),
    getDeals: (...a: any[]) => mockGetDeals(...a),
    createQuote: (...a: any[]) => mockCreateQuote(...a),
    deleteQuote: (...a: any[]) => mockDeleteQuote(...a),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v.toLocaleString()}`,
    formatDate: (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  }),
}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, onRowClick }: any) => (
    <div data-testid="quotes-table">
      {data.map((q: any) => (
        <div key={q.id} data-testid={`quote-row-${q.id}`} onClick={() => onRowClick(q)}>
          {q.quote_number} - {q.title} - {q.status}
        </div>
      ))}
    </div>
  ),
}));

import QuotesPage from './QuotesPage';

const quotes = [
  { id: 'q1', quote_number: 'Q-001', title: 'Annual License', status: 'draft', customer_name: 'Acme Corp', grand_total: 15000, valid_until: '2025-06-30', created_at: '2025-01-10T10:00:00Z', deal: { company_name: 'Acme Corp' } },
  { id: 'q2', quote_number: 'Q-002', title: 'Consulting Services', status: 'approved', customer_name: 'Beta Inc', grand_total: 8000, valid_until: null, created_at: '2025-02-15T10:00:00Z', deal: { company_name: 'Beta Inc' } },
  { id: 'q3', quote_number: 'Q-003', title: 'Support Package', status: 'pending_approval', customer_name: 'Gamma LLC', grand_total: 5000, valid_until: '2025-07-15', created_at: '2025-03-01T10:00:00Z', deal: { company_name: 'Gamma LLC' } },
];

const deals = [
  { id: 'd1', name: 'Acme Deal', company_name: 'Acme Corp' },
  { id: 'd2', name: 'Beta Deal', company_name: 'Beta Inc' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuotes.mockResolvedValue(quotes);
  mockGetDeals.mockResolvedValue(deals);
  mockCreateQuote.mockResolvedValue({ id: 'q-new' });
  mockDeleteQuote.mockResolvedValue({});
});

describe('QuotesPage', () => {
  describe('Given quotes are loaded', () => {
    it('When the page renders / Then shows the Quotes header and New Quote button', async () => {
      render(<QuotesPage />);
      await waitFor(() => {
        expect(screen.getByText('Quotes')).toBeInTheDocument();
        expect(screen.getByText('New Quote')).toBeInTheDocument();
      });
    });

    it('When the page renders / Then displays all quotes in the table', async () => {
      render(<QuotesPage />);
      await waitFor(() => {
        expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument();
        expect(screen.getByTestId('quote-row-q2')).toBeInTheDocument();
        expect(screen.getByTestId('quote-row-q3')).toBeInTheDocument();
      });
    });

    it('When searching by quote number / Then filters quotes matching the term', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument());
      const searchInput = screen.getByPlaceholderText('Search quotes...');
      await user.type(searchInput, 'Q-002');
      await waitFor(() => {
        expect(screen.queryByTestId('quote-row-q1')).not.toBeInTheDocument();
        expect(screen.getByTestId('quote-row-q2')).toBeInTheDocument();
      });
    });

    it('When filtering by status / Then shows only quotes with that status', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument());
      const statusSelect = screen.getByDisplayValue('All Status');
      await user.selectOptions(statusSelect, 'approved');
      await waitFor(() => {
        expect(screen.queryByTestId('quote-row-q1')).not.toBeInTheDocument();
        expect(screen.getByTestId('quote-row-q2')).toBeInTheDocument();
      });
    });

    it('When clicking a quote row / Then navigates to the quote detail', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument());
      await user.click(screen.getByTestId('quote-row-q1'));
      expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q1');
    });

    it('When clicking New Quote / Then shows the create quote modal with deal selector', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => {
        expect(screen.getByText('Create New Quote')).toBeInTheDocument();
        expect(screen.getByText('Select a deal...')).toBeInTheDocument();
      });
    });

    it('When the page renders / Then shows stats cards with correct counts', async () => {
      render(<QuotesPage />);
      await waitFor(() => {
        expect(screen.getByText('Total Quotes')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('Given no quotes exist', () => {
    it('When the page renders / Then shows the no quotes found state', async () => {
      mockGetQuotes.mockResolvedValue([]);
      render(<QuotesPage />);
      await waitFor(() => {
        expect(screen.getByText('No quotes found')).toBeInTheDocument();
      });
    });
  });
});
