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
    deleteQuote: (...a: any[]) => mockDeleteQuote(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatDate: (d: string) => d,
  }),
}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, isLoading, emptyMessage, columns }: any) => {
    if (isLoading) return <div>Loading...</div>;
    if (data.length === 0) return <div>{emptyMessage}</div>;
    return (
      <div data-testid="table">
        {data.map((row: any, i: number) => (
          <div key={i} data-testid="table-row">
            {columns.map((col: any) => (
              <span key={col.key} data-testid={`col-${col.key}`}>
                {col.accessor ? col.accessor(row) : row[col.key]}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

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

describe('QuotesPage — data display', () => {
  it('renders all 3 quotes as table rows', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(3);
    });
  });

  it('shows quote numbers via column accessor', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getByText('Q-001')).toBeInTheDocument();
      expect(screen.getByText('Q-002')).toBeInTheDocument();
    });
  });

  it('shows draft status badge', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
    });
  });

  it('shows approved status badge', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    });
  });

  it('shows pending approval status badge', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Pending Approval').length).toBeGreaterThan(0);
    });
  });

  it('clicking quote number navigates to quote detail', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Q-001'));
    fireEvent.click(screen.getByText('Q-001'));
    expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q1');
  });

  it('shows "No valid until" dash for quote without valid_until', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Q-002'));
    // valid_until is null so accessor returns '-'
    const cells = screen.getAllByTestId('col-valid_until');
    expect(cells.some(el => el.textContent === '-')).toBe(true);
  });
});

describe('QuotesPage — search filter', () => {
  it('renders search input', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Quotes'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('filtering by title reduces visible rows', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Annual' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(1);
    });
  });

  it('filtering by customer name works', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Beta' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(1);
    });
  });

  it('empty search shows all rows', async () => {
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

describe('QuotesPage — status filter', () => {
  it('renders status filter dropdown', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Quotes'));
    // Find the select for status
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('filtering by draft status shows only draft quotes', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'draft' } });
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(1);
    });
  });
});

describe('QuotesPage — create quote modal', () => {
  it('shows New Quote button', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('Quotes'));
    expect(screen.getByText('New Quote')).toBeInTheDocument();
  });

  it('clicking New Quote opens create modal', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('New Quote'));
    fireEvent.click(screen.getByText('New Quote'));
    await waitFor(() => {
      expect(screen.getByText(/select deal/i)).toBeInTheDocument();
    });
  });

  it('create modal lists available deals', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('New Quote'));
    fireEvent.click(screen.getByText('New Quote'));
    await waitFor(() => {
      expect(screen.getByText('Acme Deal - Acme Corp')).toBeInTheDocument();
    });
  });

  it('Create Quote button calls createQuote with selected dealId', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('New Quote'));
    fireEvent.click(screen.getByText('New Quote'));
    await waitFor(() => screen.getByText('Acme Deal - Acme Corp'));
    // Select a deal from dropdown
    const dealSelects = screen.getAllByRole('combobox');
    const dealSelect = dealSelects[dealSelects.length - 1];
    fireEvent.change(dealSelect, { target: { value: 'd1' } });
    fireEvent.click(screen.getByText(/^Create Quote$/));
    await waitFor(() => {
      expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({ deal_id: 'd1' }));
    });
  });

  it('successful create navigates to new quote', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getByText('New Quote'));
    fireEvent.click(screen.getByText('New Quote'));
    await waitFor(() => screen.getByText('Acme Deal - Acme Corp'));
    const dealSelects = screen.getAllByRole('combobox');
    const dealSelect = dealSelects[dealSelects.length - 1];
    fireEvent.change(dealSelect, { target: { value: 'd1' } });
    fireEvent.click(screen.getByText(/^Create Quote$/));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q-new');
    });
  });
});

describe('QuotesPage — delete quote', () => {
  it('draft quotes show a delete icon button', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    // The delete button appears only for draft quotes (q1 is draft)
    const deleteButtons = screen.getAllByTitle('Delete');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking delete shows confirmation dialog', async () => {
    render(<QuotesPage />);
    await waitFor(() => screen.getAllByTestId('table-row'));
    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });
});

describe('QuotesPage — error state', () => {
  it('shows error when getQuotes fails', async () => {
    mockGetQuotes.mockRejectedValue(new Error('Load failed'));
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getByText(/load failed|failed to load/i)).toBeInTheDocument();
    });
  });
});
