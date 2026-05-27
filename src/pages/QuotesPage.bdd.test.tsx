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

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 0, isLimited: false }),}));

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
  { id: 'd3', name: 'No Company Deal', company_name: '' },
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

    it('When clicking the deal trigger / Then opens dropdown and shows deal options', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => {
        expect(screen.getByText('Acme Deal')).toBeInTheDocument();
        expect(screen.getByText('Beta Deal')).toBeInTheDocument();
      });
    });

    it('When searching in deal dropdown / Then filters deals by name', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument());
      await user.type(screen.getByPlaceholderText('Search deals...'), 'Acme');
      await waitFor(() => {
        expect(screen.getByText('Acme Deal')).toBeInTheDocument();
        expect(screen.queryByText('Beta Deal')).not.toBeInTheDocument();
      });
    });

    it('When searching with no match / Then shows no deals found', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument());
      await user.type(screen.getByPlaceholderText('Search deals...'), 'zzz-no-match');
      await waitFor(() => expect(screen.getByText('No deals found')).toBeInTheDocument());
    });

    it('When selecting a deal from dropdown / Then closes dropdown and shows deal name in trigger', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByText('Acme Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Acme Deal'));
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search deals...')).not.toBeInTheDocument();
        expect(screen.getByText('Acme Deal')).toBeInTheDocument();
      });
    });

    it('When a deal is selected / Then Create Quote button becomes enabled', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      const createBtn = screen.getByRole('button', { name: 'Create Quote' });
      expect(createBtn).toBeDisabled();
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByText('Acme Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Acme Deal'));
      await waitFor(() => expect(createBtn).not.toBeDisabled());
    });

    it('When searching by company name / Then filters deals matching the company', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument());
      await user.type(screen.getByPlaceholderText('Search deals...'), 'Beta Inc');
      await waitFor(() => {
        expect(screen.getByText('Beta Deal')).toBeInTheDocument();
        expect(screen.queryByText('Acme Deal')).not.toBeInTheDocument();
      });
    });

    it('When a deal without company_name is in the list / Then option renders without company subtitle', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByText('No Company Deal')).toBeInTheDocument());
      // the option exists but has no company subtitle — only one text node for this deal
      const optionBtn = screen.getByText('No Company Deal').closest('li');
      expect(optionBtn?.querySelectorAll('span').length).toBe(1);
    });

    it('When a deal without company_name is selected / Then trigger shows name only without subtitle', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByText('No Company Deal')).toBeInTheDocument());
      await user.click(screen.getByText('No Company Deal'));
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search deals...')).not.toBeInTheDocument();
        // trigger shows the deal name
        expect(screen.getByText('No Company Deal')).toBeInTheDocument();
        // trigger must not render a company subtitle span — parentElement is the outer flex span
        const outerSpan = screen.getByText('No Company Deal').parentElement;
        expect(outerSpan?.querySelectorAll('span').length).toBe(1);
      });
    });

    it('When selecting a deal then reopening dropdown / Then selected deal is highlighted', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByText('Acme Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Acme Deal'));
      // reopen via the trigger button (now labelled by the selected deal name span)
      await waitFor(() => expect(screen.queryByPlaceholderText('Search deals...')).not.toBeInTheDocument());
      const triggerBtn = screen.getByText('Acme Deal').closest('button') as HTMLElement;
      await user.click(triggerBtn);
      await waitFor(() => expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument());
      // the option button for the selected deal carries the highlight class
      const optionBtns = screen.getAllByRole('button', { name: /acme deal/i });
      const optionBtn = optionBtns.find(b => b.closest('li'));
      expect(optionBtn).toHaveClass('bg-blue-600/20');
      const nameSpan = optionBtn?.querySelector('span');
      expect(nameSpan).toHaveClass('text-blue-300');
    });

    it('When trigger clicked while dropdown is open / Then closes the dropdown (toggle)', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument());
      // click trigger again to close
      await user.click(screen.getByRole('button', { name: /select a deal/i }));
      await waitFor(() => expect(screen.queryByPlaceholderText('Search deals...')).not.toBeInTheDocument());
    });

    it('When clicking outside the dropdown / Then closes the dropdown', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument());
      await user.click(screen.getByText('Create New Quote'));
      await waitFor(() => expect(screen.queryByPlaceholderText('Search deals...')).not.toBeInTheDocument());
    });

    it('When Cancel is clicked after opening dropdown / Then resets dropdown and search state', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      await user.click(screen.getByText('Select a deal...'));
      await waitFor(() => expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument());
      await user.type(screen.getByPlaceholderText('Search deals...'), 'Acme');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByText('Create New Quote')).not.toBeInTheDocument());
      // reopen modal — dropdown must be closed and search cleared
      await user.click(screen.getByText('New Quote'));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
      expect(screen.queryByPlaceholderText('Search deals...')).not.toBeInTheDocument();
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
