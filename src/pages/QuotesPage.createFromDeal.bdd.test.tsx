/**
 * QuotesPage — creating a quote from a deal must not suppress its population
 *
 * The Create Quote modal used to post `{ deal_id, title: 'New Quote', lines: [] }`.
 * crm-be honours an explicitly supplied title and line array, so that payload
 * actively overrode the derivation: the seller landed on a blank draft titled
 * "New Quote" and retyped the customer and products the CRM already held.
 *
 * The page now sends the deal alone and lets crm-be seed the draft from the deal
 * and its products. These specs pin that payload, because the defect lived
 * entirely in what the page chose to send.
 */
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
  useLocation: () => ({ pathname: '/crm/quotes', search: '', hash: '', state: null, key: 'test' }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
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

const deals = [
  { id: 'deal-1', name: 'Acme — Q3 Expansion', company_name: 'Acme Ltd' },
  { id: 'deal-2', name: 'Beta Retrofit', company_name: 'Beta Inc' },
];

beforeEach(async () => {
  vi.clearAllMocks();
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
  // One existing quote, so the list renders instead of the empty state — whose
  // own "Create Quote" button would otherwise collide with the modal's.
  mockGetQuotes.mockResolvedValue([
    { id: 'q1', quote_number: 'QT-2026-00022', title: 'Existing', status: 'draft', customer_name: 'Acme Ltd', grand_total: 15000, valid_until: null, created_at: '2026-01-10T10:00:00Z', deal: { company_name: 'Acme Ltd' } },
  ]);
  mockGetDeals.mockResolvedValue(deals);
  mockCreateQuote.mockResolvedValue({ id: 'q-new' });
});

/** Opens the modal, picks `dealName`, and confirms. */
async function createQuoteFromDeal(dealName: string) {
  const user = userEvent.setup();
  render(<QuotesPage />);
  await waitFor(() => expect(mockGetDeals).toHaveBeenCalled());

  await user.click(screen.getByRole('button', { name: /New Quote/i }));
  await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());

  await user.click(screen.getByText('Select a deal...'));
  await user.click(await screen.findByText(dealName));
  await user.click(screen.getByRole('button', { name: 'Create Quote' }));

  await waitFor(() => expect(mockCreateQuote).toHaveBeenCalled());
  return mockCreateQuote.mock.calls[0][0];
}

describe('QuotesPage — New Quote from a deal', () => {
  describe('Given the seller picks a deal in the Create Quote modal', () => {
    it('When the quote is created / Then only the deal is sent', async () => {
      const payload = await createQuoteFromDeal('Acme — Q3 Expansion');

      expect(payload).toEqual({ deal_id: 'deal-1' });
    });

    it('When the quote is created / Then no placeholder title is sent', async () => {
      const payload = await createQuoteFromDeal('Acme — Q3 Expansion');

      // A supplied title wins over the deal-derived one in crm-be, so sending
      // 'New Quote' is what named every quote "New Quote".
      expect(payload.title).toBeUndefined();
    });

    it('When the quote is created / Then `lines` is absent, not an empty array', async () => {
      const payload = await createQuoteFromDeal('Acme — Q3 Expansion');

      // crm-be treats a present `lines` key — empty array included — as the
      // caller's own line set, and skips seeding from the deal's products.
      expect('lines' in payload).toBe(false);
    });

    it('When a different deal is picked / Then that deal is the one sent', async () => {
      const payload = await createQuoteFromDeal('Beta Retrofit');

      expect(payload).toEqual({ deal_id: 'deal-2' });
    });

    it('When the quote comes back / Then the seller lands on the populated draft', async () => {
      await createQuoteFromDeal('Acme — Q3 Expansion');

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q-new'));
    });
  });

  describe('Given no deal has been picked yet', () => {
    it('When the modal is open / Then Create Quote is disabled and nothing is sent', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);
      await waitFor(() => expect(mockGetDeals).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /New Quote/i }));
      await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());

      expect(screen.getByRole('button', { name: 'Create Quote' })).toBeDisabled();
      expect(mockCreateQuote).not.toHaveBeenCalled();
    });
  });
});
