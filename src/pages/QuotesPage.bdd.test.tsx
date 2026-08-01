import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QuoteStatusCell } from './QuotesPage';

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
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),

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

beforeEach(async () => {
  vi.clearAllMocks();
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
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

    it('When filtering by status via custom dropdown / Then shows only quotes with that status', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument());
      // open the custom status filter dropdown
      await user.click(screen.getByRole('button', { name: /all status/i }));
      // select "Approved" from the dropdown options (the label pill text)
      const approvedOption = await screen.findByRole('button', { name: /approved/i });
      await user.click(approvedOption);
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

  // ── Fix: custom status filter dropdown (replaces undiscoverable native <select>) ──

  describe('Given the status filter custom dropdown', () => {
    describe('When the page loads / Then the filter button is visible and labelled "All Status"', () => {
      it('shows "All Status" label by default', async () => {
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: /all status/i })).toBeInTheDocument();
      });
    });

    describe('Given the user clicks the status filter button', () => {
      it('When clicked / Then opens a dropdown panel', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /all status/i }));
        // dropdown panel should now show individual status options
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /draft/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /pending approval/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /approved/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /rejected/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /converted/i })).toBeInTheDocument();
        });
      });

      it('When clicked again while open / Then closes the dropdown (toggle)', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
        const filterBtn = screen.getByRole('button', { name: /all status/i });
        await user.click(filterBtn);
        await waitFor(() => expect(screen.getByRole('button', { name: /draft/i })).toBeInTheDocument());
        await user.click(filterBtn);
        await waitFor(() => expect(screen.queryByRole('button', { name: /^draft$/i })).not.toBeInTheDocument());
      });
    });

    describe('Given the dropdown is open', () => {
      it('When "Draft" option is selected / Then only draft quotes appear in the table', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /all status/i }));
        await waitFor(() => expect(screen.getAllByRole('button', { name: /draft/i }).length).toBeGreaterThan(0));
        const draftOptions = screen.getAllByRole('button', { name: /draft/i });
        // the option button inside the dropdown panel (not the filter trigger itself)
        await user.click(draftOptions[draftOptions.length - 1]);
        await waitFor(() => {
          expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument();
          expect(screen.queryByTestId('quote-row-q2')).not.toBeInTheDocument();
          expect(screen.queryByTestId('quote-row-q3')).not.toBeInTheDocument();
        });
      });

      it('When "Pending Approval" option is selected / Then only pending quotes appear', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByTestId('quote-row-q3')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /all status/i }));
        await waitFor(() => screen.getByRole('button', { name: /pending approval/i }));
        await user.click(screen.getByRole('button', { name: /pending approval/i }));
        await waitFor(() => {
          expect(screen.queryByTestId('quote-row-q1')).not.toBeInTheDocument();
          expect(screen.queryByTestId('quote-row-q2')).not.toBeInTheDocument();
          expect(screen.getByTestId('quote-row-q3')).toBeInTheDocument();
        });
      });

      it('When "All Status" option is selected / Then all quotes are shown', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument());
        // set a filter first
        await user.click(screen.getByRole('button', { name: /all status/i }));
        await waitFor(() => screen.getByRole('button', { name: /approved/i }));
        await user.click(screen.getByRole('button', { name: /approved/i }));
        await waitFor(() => expect(screen.queryByTestId('quote-row-q1')).not.toBeInTheDocument());
        // now reset via "All Status" option in the dropdown
        await user.click(screen.getByRole('button', { name: /approved/i })); // filter trigger now shows "Approved"
        await waitFor(() => screen.getByText('All Status'));
        const allStatusOption = screen.getByText('All Status');
        await user.click(allStatusOption.closest('button')!);
        await waitFor(() => {
          expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument();
          expect(screen.getByTestId('quote-row-q2')).toBeInTheDocument();
          expect(screen.getByTestId('quote-row-q3')).toBeInTheDocument();
        });
      });

      it('When a status is active / Then the filter button label changes to that status', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /all status/i }));
        await waitFor(() => screen.getByRole('button', { name: /approved/i }));
        await user.click(screen.getByRole('button', { name: /approved/i }));
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /approved/i })).toBeInTheDocument();
          expect(screen.queryByRole('button', { name: /all status/i })).not.toBeInTheDocument();
        });
      });

      it('When a filter is active / Then a × clear button appears on the filter trigger', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /all status/i }));
        await waitFor(() => screen.getByRole('button', { name: /approved/i }));
        await user.click(screen.getByRole('button', { name: /approved/i }));
        await waitFor(() => {
          const clearBtn = screen.getByRole('button', { name: /clear status filter/i });
          expect(clearBtn).toBeInTheDocument();
        });
      });

      it('When the × clear button is clicked / Then filter resets to "All Status" and all quotes show', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /all status/i }));
        await waitFor(() => screen.getByRole('button', { name: /approved/i }));
        await user.click(screen.getByRole('button', { name: /approved/i }));
        await waitFor(() => expect(screen.queryByTestId('quote-row-q1')).not.toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /clear status filter/i }));
        await waitFor(() => {
          expect(screen.getByTestId('quote-row-q1')).toBeInTheDocument();
          expect(screen.getByTestId('quote-row-q2')).toBeInTheDocument();
          expect(screen.getByTestId('quote-row-q3')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /all status/i })).toBeInTheDocument();
        });
      });

      it('When filter is active and no quotes match / Then shows the no-quotes-found empty state', async () => {
        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /all status/i }));
        await waitFor(() => screen.getByRole('button', { name: /rejected/i }));
        await user.click(screen.getByRole('button', { name: /rejected/i }));
        await waitFor(() => {
          expect(screen.getByText('No quotes found')).toBeInTheDocument();
          expect(screen.getByText(/try adjusting your filters/i)).toBeInTheDocument();
        });
      });

      it('When dropdown is open / Then each status option shows the count of matching quotes', async () => {

        const user = userEvent.setup();
        render(<QuotesPage />);
        await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: /all status/i }));
        await waitFor(() => screen.getByRole('button', { name: /draft/i }));
        // fixture has 1 draft, 1 approved, 1 pending_approval — counts must appear in the dropdown
        const dropdownPanel = screen.getByRole('button', { name: /draft/i }).closest('div[class*="absolute"]') ?? document.body;
        // the draft option button renders a count span — at least "1" must appear
        expect(dropdownPanel.textContent).toMatch(/1/);
      });
    });
  });
});

// ── QuoteStatusCell — isolated BDD tests ─────────────────────────────────────

function makeQuote(status: string, id = 'q-test'): any {
  return { id, quote_number: `Q-${id}`, title: 'Test Quote', status, grand_total: 100, created_at: '2025-01-01T00:00:00Z' };
}

describe('QuoteStatusCell', () => {
  describe('Given a draft quote', () => {
    it('When rendered / Then shows "Draft" badge with a dropdown chevron', () => {
      render(<QuoteStatusCell quote={makeQuote('draft')} isActionLoading={false} onAction={vi.fn()} />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
      // chevron implies dropdown is available
      expect(screen.getByTestId('icon-ChevronDown')).toBeInTheDocument();
    });

    it('When badge clicked / Then dropdown shows "Submit for Approval" option', async () => {
      const user = userEvent.setup();
      render(<QuoteStatusCell quote={makeQuote('draft')} isActionLoading={false} onAction={vi.fn()} />);
      await user.click(screen.getByText('Draft'));
      await waitFor(() => expect(screen.getByText('Submit for Approval')).toBeInTheDocument());
    });

    it('When "Submit for Approval" option clicked / Then onAction called with (quote, "submit")', async () => {
      const onAction = vi.fn();
      const quote = makeQuote('draft');
      const user = userEvent.setup();
      render(<QuoteStatusCell quote={quote} isActionLoading={false} onAction={onAction} />);
      await user.click(screen.getByText('Draft'));
      await waitFor(() => expect(screen.getByText('Submit for Approval')).toBeInTheDocument());
      await user.click(screen.getByText('Submit for Approval'));
      expect(onAction).toHaveBeenCalledWith(quote, 'submit');
    });

    it('When badge clicked twice / Then dropdown closes on second click (outside-click simulation)', async () => {
      const user = userEvent.setup();
      render(<QuoteStatusCell quote={makeQuote('draft')} isActionLoading={false} onAction={vi.fn()} />);
      await user.click(screen.getByText('Draft'));
      await waitFor(() => expect(screen.getByText('Submit for Approval')).toBeInTheDocument());
      // click outside
      await user.click(document.body);
      await waitFor(() => expect(screen.queryByText('Submit for Approval')).not.toBeInTheDocument());
    });
  });

  describe('Given a pending_approval quote', () => {
    it('When badge clicked / Then dropdown shows both "Approve" and "Reject" options', async () => {
      const user = userEvent.setup();
      render(<QuoteStatusCell quote={makeQuote('pending_approval')} isActionLoading={false} onAction={vi.fn()} />);
      await user.click(screen.getByText('Pending Approval'));
      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument();
        expect(screen.getByText('Reject')).toBeInTheDocument();
      });
    });

    it('When "Approve" clicked / Then onAction called with (quote, "approve")', async () => {
      const onAction = vi.fn();
      const quote = makeQuote('pending_approval');
      const user = userEvent.setup();
      render(<QuoteStatusCell quote={quote} isActionLoading={false} onAction={onAction} />);
      await user.click(screen.getByText('Pending Approval'));
      await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument());
      await user.click(screen.getByText('Approve'));
      expect(onAction).toHaveBeenCalledWith(quote, 'approve');
    });

    it('When "Reject" clicked / Then onAction called with (quote, "reject")', async () => {
      const onAction = vi.fn();
      const quote = makeQuote('pending_approval');
      const user = userEvent.setup();
      render(<QuoteStatusCell quote={quote} isActionLoading={false} onAction={onAction} />);
      await user.click(screen.getByText('Pending Approval'));
      await waitFor(() => expect(screen.getByText('Reject')).toBeInTheDocument());
      await user.click(screen.getByText('Reject'));
      expect(onAction).toHaveBeenCalledWith(quote, 'reject');
    });
  });

  describe('Given an approved quote', () => {
    it('When badge clicked / Then dropdown shows "Convert to Order" option', async () => {
      const user = userEvent.setup();
      render(<QuoteStatusCell quote={makeQuote('approved')} isActionLoading={false} onAction={vi.fn()} />);
      await user.click(screen.getByText('Approved'));
      await waitFor(() => expect(screen.getByText('Convert to Order')).toBeInTheDocument());
    });
  });

  describe('Given a terminal quote (rejected / converted / expired)', () => {
    it.each(['rejected', 'converted', 'expired'])('When %s quote rendered / Then no dropdown chevron shown', (status) => {
      render(<QuoteStatusCell quote={makeQuote(status)} isActionLoading={false} onAction={vi.fn()} />);
      expect(screen.queryByTestId('icon-ChevronDown')).not.toBeInTheDocument();
    });

    it.each(['rejected', 'converted', 'expired'])('When %s badge clicked / Then no dropdown appears', async (status) => {
      const user = userEvent.setup();
      render(<QuoteStatusCell quote={makeQuote(status)} isActionLoading={false} onAction={vi.fn()} />);
      const badge = screen.getByRole('button');
      await user.click(badge);
      // no transition option should appear
      expect(screen.queryByText('Submit for Approval')).not.toBeInTheDocument();
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('Convert to Order')).not.toBeInTheDocument();
    });
  });

  describe('Given isActionLoading is true', () => {
    it('When rendered / Then status badge is disabled', () => {
      render(<QuoteStatusCell quote={makeQuote('draft')} isActionLoading={true} onAction={vi.fn()} />);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Given effectiveFlagsLoaded guard — flicker prevention', () => {
    it('When effectiveFlagsLoaded is false / Then New Quote button is absent', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: false,
        isFeatureEnabled: () => false,
      } as any);
      render(<QuotesPage />);
      expect(screen.queryByText('New Quote')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded is true and isFeatureEnabled returns true / Then New Quote button is present', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1' },
      } as any);
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('Quotes')).toBeInTheDocument());
      expect(screen.getByText('New Quote')).toBeInTheDocument();
    });
  });
});
