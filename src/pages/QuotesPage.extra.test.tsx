/**
 * Extra coverage for QuotesPage: search/filter, create modal, delete flow, error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetQuotes = vi.fn();
const mockGetDeals = vi.fn();
const mockCreateQuote = vi.fn();
const mockDeleteQuote = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getQuotes: (...a: any[]) => mockGetQuotes(...a),
    getDeals: (...a: any[]) => mockGetDeals(...a),
    createQuote: (...a: any[]) => mockCreateQuote(...a),
    isQuoteAutoNumbering: async () => true,
    deleteQuote: (...a: any[]) => mockDeleteQuote(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  // The list stamps its own URL onto each quote it opens, so Quote Detail's
  // Back control can return here instead of guessing from history.
  useLocation: () => ({ pathname: '/crm/quotes', search: '', hash: '', state: null, key: 'test' }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 0, isLimited: false }),}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatDate: (d: string) => d,
  }),
}));

vi.mock('@so360/design-system', async (importOriginal) => {
  const actual: any = await importOriginal();
  const RowMenu = ({ items }: any) => {
    const [open, setOpen] = React.useState(false);
    return (
      <span>
        <button title="More actions" aria-label="More actions" onClick={() => setOpen(true)} />
        {open && items.map((it: any) => <button key={it.label} role="menuitem" onClick={() => it.onSelect()}>{it.label}</button>)}
      </span>
    );
  };
  return {
    ...actual,
    DataTable: ({ rows, loading, emptyState, columns, rowActions }: any) => {
      if (loading) return <div>Loading...</div>;
      if (rows.length === 0) return <div>{emptyState}</div>;
      return (
        <div data-testid="table">
          {rows.map((row: any, i: number) => (
            <div key={i} data-testid="table-row">
              {columns.map((col: any) => (
                <span key={col.key} data-testid={`col-${col.key}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </span>
              ))}
              {rowActions && <RowMenu items={rowActions(row)} />}
            </div>
          ))}
        </div>
      );
    },
  };
});

import QuotesPage from './QuotesPage';

const sampleQuotes = [
  {
    id: 'q1', quote_number: 'Q-001', title: 'Annual License',
    status: 'draft', grand_total: 12000, customer_name: 'Acme Corp',
    valid_until: '2024-12-31', created_at: '2024-01-01',
    deal: { id: 'd1', name: 'Acme Deal', company_name: 'Acme Corp' },
    deal_id: 'd1',
  },
  {
    id: 'q2', quote_number: 'Q-002', title: 'Hardware Bundle',
    status: 'approved', grand_total: 5000, customer_name: 'Beta Ltd',
    valid_until: null, created_at: '2024-02-01',
    deal: { id: 'd2', name: 'Beta Deal', company_name: 'Beta Ltd' },
    deal_id: 'd2',
  },
  {
    id: 'q3', quote_number: 'Q-003', title: 'Support Contract',
    status: 'pending_approval', grand_total: 3000, customer_name: 'Gamma Inc',
    valid_until: '2025-06-30', created_at: '2024-03-01',
    deal: null, deal_id: null,
  },
];

const sampleDeals = [
  { id: 'd1', name: 'Acme Deal', company_name: 'Acme Corp' },
  { id: 'd2', name: 'Beta Deal', company_name: 'Beta Ltd' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuotes.mockResolvedValue(sampleQuotes);
  mockGetDeals.mockResolvedValue(sampleDeals);
  mockCreateQuote.mockResolvedValue({ id: 'q-new', status: 'draft' });
  mockDeleteQuote.mockResolvedValue({});
});

describe('Given QuotesPage — data display', () => {
  it('When action / Then renders all 3 quotes as table rows', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(3);
    });
  });

  it('When action / Then shows quote numbers via column accessor', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getByText('Q-001')).toBeInTheDocument();
      expect(screen.getByText('Q-002')).toBeInTheDocument();
    });
  });

  it('When action / Then shows draft status badge', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    });
  });

  it('When action / Then shows approved status badge', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    });
  });

  it('When action / Then shows pending approval status badge', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Pending Approval').length).toBeGreaterThan(0);
    });
  });

  it('When action / Then clicking quote number navigates to quote detail', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Q-001'));
    fireEvent.click(screen.getByText('Q-001'));
    // The list records where the reader came from, so Quote Detail's Back
      // control returns here rather than falling through to the linked deal.
      expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q1', { state: { from: '/crm/quotes' } });
  });

  it('When action / Then shows "No valid until" dash for quote without valid_until', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Q-002'));
    // valid_until is null so accessor returns '-'
    const cells = screen.getAllByTestId('col-valid_until');
    expect(cells.some(el => el.textContent === '-')).toBe(true);
  });
});

describe('Given QuotesPage — search filter', () => {
  it('When action / Then renders search input', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Quotes'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('When action / Then filtering by title reduces visible rows', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Annual' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(1);
    });
  });

  it('When action / Then filtering by customer name works', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Beta' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(1);
    });
  });

  it('When action / Then empty search shows all rows', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'xyz-no-match' } });
    await waitFor(() => {
      expect(screen.queryByTestId('table-row')).not.toBeInTheDocument();
    });
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(3);
    });
  });
});

describe('Given QuotesPage — status filter', () => {
  it('When action / Then renders the Status quick filter', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Quotes'));
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  it('When action / Then filtering by draft status shows only draft quotes', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'draft' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(1);
    });
  });

  it('When action / Then filtering by customer name works', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Beta' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(1);
    });
  });

  it('When action / Then empty search shows all rows', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'xyz-no-match' } });
    await waitFor(() => {
      expect(screen.queryByTestId('table-row')).not.toBeInTheDocument();
    });
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(3);
    });
  });
});

describe('Given QuotesPage — status filter', () => {
  it('When action / Then renders the Status quick filter', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Quotes'));
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  it('When action / Then filtering by draft status shows only draft quotes', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'draft' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(1);
    });
  });
});

describe('Given QuotesPage — create quote modal', () => {
  it('When action / Then shows New Quote button', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Quotes'));
    expect(screen.getByText('New Quote')).toBeInTheDocument();
  });

  it('When action / Then clicking New Quote opens create modal', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('New Quote'));
    fireEvent.click(screen.getByText('New Quote'));
    await waitFor(() => {
      expect(screen.getByText(/select deal/i)).toBeInTheDocument();
    });
  });

  it('When action / Then create modal lists available deals', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('New Quote'));
    fireEvent.click(screen.getByText('New Quote'));
    await waitFor(() => screen.getByText('Select a deal...'));
    fireEvent.click(screen.getByText('Select a deal...'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search deals...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Acme Deal/i })).toBeInTheDocument();
    });
  });

  it('When action / Then Create Quote button calls createQuote with selected dealId', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('New Quote'));
    fireEvent.click(screen.getByText('New Quote'));
    await waitFor(() => screen.getByText('Select a deal...'));
    fireEvent.click(screen.getByText('Select a deal...'));
    await waitFor(() => screen.getByRole('button', { name: /Acme Deal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Acme Deal/i }));
    fireEvent.click(screen.getByText(/^Create Quote$/));
    await waitFor(() => {
      expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({ deal_id: 'd1' }));
    });
  });

  it('When action / Then successful create navigates to new quote', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('New Quote'));
    fireEvent.click(screen.getByText('New Quote'));
    await waitFor(() => screen.getByText('Select a deal...'));
    fireEvent.click(screen.getByText('Select a deal...'));
    await waitFor(() => screen.getByRole('button', { name: /Acme Deal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Acme Deal/i }));
    fireEvent.click(screen.getByText(/^Create Quote$/));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q-new');
    });
  });
});

describe('Given QuotesPage — delete quote', () => {
  it('When action / Then draft quotes show a delete icon button', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    // The delete button appears only for draft quotes (q1 is draft)
    fireEvent.click(screen.getAllByTitle('More actions')[0]);
    expect(await screen.findByRole('menuitem', { name: /Delete Quote/ })).toBeInTheDocument();
  });

  it('When action / Then clicking delete shows confirmation dialog', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    fireEvent.click(screen.getAllByTitle('More actions')[0]);
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete Quote/ }));
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });
});

describe('Given QuotesPage — error state', () => {
  it('When action / Then shows error when getQuotes fails', async () => {
    mockGetQuotes.mockRejectedValue(new Error('Load failed'));
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getByText(/load failed|failed to load/i)).toBeInTheDocument();
    });
  });
});
