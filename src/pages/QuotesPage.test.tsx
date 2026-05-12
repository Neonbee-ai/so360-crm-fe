import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetQuotes = vi.fn();
const mockGetDeals = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getQuotes: (...a: any[]) => mockGetQuotes(...a),
    getDeals: (...a: any[]) => mockGetDeals(...a),
    deleteQuote: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
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
  Table: ({ data, isLoading, emptyMessage }: any) => (
    <div data-testid="table">{isLoading ? 'Loading...' : data.length === 0 ? emptyMessage : `${data.length} rows`}</div>
  ),
}));

import QuotesPage from './QuotesPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuotes.mockResolvedValue([]);
  mockGetDeals.mockResolvedValue([]);
});

describe('QuotesPage', () => {
  it('renders quotes header', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getByText('Quotes')).toBeInTheDocument();
    });
  });

  it('shows empty state', async () => {
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getByText('No quotes found')).toBeInTheDocument();
    });
  });

  it('shows quotes when loaded', async () => {
    mockGetQuotes.mockResolvedValue([
      { id: 'q1', title: 'Quote 1', status: 'draft', total: 1000, created_at: '2024-01-01', deal: { name: 'D1' } },
    ]);
    render(<QuotesPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table')).toHaveTextContent('1 rows');
    });
  });
});
