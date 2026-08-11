import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// This spec intentionally uses the REAL Table component (unlike QuotesPage.bdd.test.tsx,
// which stubs it out) so the row-click vs. row-action click-bubbling bug is actually
// exercised: a mocked Table that ignores column accessors can never catch this class of bug.

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
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 0, isLimited: false }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v.toLocaleString()}`,
    formatDate: (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  }),
}));

import QuotesPage from './QuotesPage';

const quotes = [
  { id: 'q1', quote_number: 'QT-2026-00022', title: 'New Quote', status: 'draft', customer_name: 'Acme Corp', grand_total: 15000, valid_until: '2025-06-30', created_at: '2025-01-10T10:00:00Z', deal: { company_name: 'Acme Corp' } },
  { id: 'q2', quote_number: 'QT-2026-00023', title: 'Consulting Services', status: 'approved', customer_name: 'Beta Inc', grand_total: 8000, valid_until: null, created_at: '2025-02-15T10:00:00Z', deal: { company_name: 'Beta Inc' } },
];

beforeEach(async () => {
  vi.clearAllMocks();
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
  mockGetQuotes.mockResolvedValue(quotes);
  mockGetDeals.mockResolvedValue([]);
  mockDeleteQuote.mockResolvedValue({});
});

describe('QuotesPage — delete action (real Table)', () => {
  describe('Given a draft quote row with a Delete icon', () => {
    it('When Delete is clicked / Then it opens the confirm dialog instead of navigating to Quote Detail', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00022')).toBeInTheDocument());

      await user.click(screen.getByTitle('Delete'));

      expect(mockNavigate).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByText('Delete Quote?')).toBeInTheDocument());
    });

    it('When the confirm dialog opens / Then it identifies the quote by number and title', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00022')).toBeInTheDocument());
      await user.click(screen.getByTitle('Delete'));
      await waitFor(() => {
        // The number now appears twice — in the table row it was clicked from,
        // and again in the dialog identifying what is about to be deleted. That
        // second occurrence IS the behaviour under test, so assert on the count
        // rather than asking for a single match.
        expect(screen.getAllByText(/QT-2026-00022/).length).toBeGreaterThan(1);
        expect(screen.getAllByText(/New Quote/).length).toBeGreaterThan(0);
      });
    });

    it('When Cancel is clicked / Then the dialog closes, no API call is made, and the quote remains', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00022')).toBeInTheDocument());
      await user.click(screen.getByTitle('Delete'));
      await waitFor(() => expect(screen.getByText('Delete Quote?')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockDeleteQuote).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText('Delete Quote?')).not.toBeInTheDocument());
      expect(screen.getByText('QT-2026-00022')).toBeInTheDocument();
    });

    it('When Delete Quote is confirmed / Then it calls the delete API with the quote id and removes the row from the list', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00022')).toBeInTheDocument());
      await user.click(screen.getByTitle('Delete'));
      await waitFor(() => expect(screen.getByText('Delete Quote?')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Delete Quote' }));

      await waitFor(() => expect(mockDeleteQuote).toHaveBeenCalledWith('q1'));
      await waitFor(() => expect(screen.queryByText('QT-2026-00022')).not.toBeInTheDocument());
      expect(screen.getByText('QT-2026-00023')).toBeInTheDocument();
    });

    it('When Delete Quote is clicked twice quickly / Then the delete API is only called once', async () => {
      const user = userEvent.setup();
      let resolveDelete: (v: any) => void;
      mockDeleteQuote.mockReturnValueOnce(new Promise((resolve) => { resolveDelete = resolve; }));
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00022')).toBeInTheDocument());
      await user.click(screen.getByTitle('Delete'));
      await waitFor(() => expect(screen.getByText('Delete Quote?')).toBeInTheDocument());

      const confirmBtn = screen.getByRole('button', { name: 'Delete Quote' });
      await user.click(confirmBtn);
      await user.click(confirmBtn);

      expect(mockDeleteQuote).toHaveBeenCalledTimes(1);
      resolveDelete!({});
    });

    it('Given the delete API fails / When confirmed / Then shows the error and keeps the quote in the list', async () => {
      mockDeleteQuote.mockRejectedValueOnce(new Error('Quote is linked to a Sales Order'));
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00022')).toBeInTheDocument());
      await user.click(screen.getByTitle('Delete'));
      await waitFor(() => expect(screen.getByText('Delete Quote?')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Delete Quote' }));

      await waitFor(() => expect(screen.getByText('Quote is linked to a Sales Order')).toBeInTheDocument());
      expect(screen.getByText('QT-2026-00022')).toBeInTheDocument();
    });
  });

  describe('Given a non-draft quote row', () => {
    it('When rendered / Then no Delete icon is shown', async () => {
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00023')).toBeInTheDocument());
      // only the draft quote (q1) exposes delete
      expect(screen.getAllByTitle('Delete')).toHaveLength(1);
    });
  });

  describe('Given the View icon on a row', () => {
    it('When clicked / Then navigates to the quote detail without opening the delete dialog', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00022')).toBeInTheDocument());
      const viewButtons = screen.getAllByTitle('View');
      await user.click(viewButtons[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q1');
      expect(screen.queryByText('Delete Quote?')).not.toBeInTheDocument();
    });
  });

  describe('Given the row itself (not an action icon)', () => {
    it('When clicked / Then navigates to the quote detail (existing behaviour preserved)', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(screen.getByText('QT-2026-00022')).toBeInTheDocument());
      await user.click(screen.getByText('QT-2026-00022'));
      expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q1');
    });
  });
});
