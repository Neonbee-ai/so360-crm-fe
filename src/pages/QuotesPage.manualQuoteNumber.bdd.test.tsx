/**
 * QuotesPage — manual quote number when auto-numbering is off (Pulse 0d0775ba)
 *
 * Settings → Documents → Numbering lets an admin turn Sales Quote auto-numbering off. The
 * New Quote modal then has to collect the number: an editable, required
 * "Quote Number (manual)" field, sent to crm-be as `quote_number`. With
 * auto-numbering on the modal is unchanged and sends the deal alone.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetQuotes = vi.fn();
const mockGetDeals = vi.fn();
const mockCreateQuote = vi.fn();
const mockIsAuto = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getQuotes: (...a: any[]) => mockGetQuotes(...a),
    getDeals: (...a: any[]) => mockGetDeals(...a),
    createQuote: (...a: any[]) => mockCreateQuote(...a),
    deleteQuote: vi.fn(),
    isQuoteAutoNumbering: (...a: any[]) => mockIsAuto(...a),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/crm/quotes', search: '', hash: '', state: null, key: 'test' }),
}));

const mockToastError = vi.fn();
vi.mock('@so360/design-system', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, toast: { ...actual.toast, error: (...a: any[]) => mockToastError(...a), success: vi.fn() } };
});

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
    formatDate: (d: string) => new Date(d).toLocaleDateString('en-US'),
  }),
}));

import QuotesPage from './QuotesPage';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuotes.mockResolvedValue([
    { id: 'q1', quote_number: 'QT-2026-00022', title: 'Existing', status: 'draft', customer_name: 'Acme Ltd', grand_total: 15000, valid_until: null, created_at: '2026-01-10T10:00:00Z', deal: { company_name: 'Acme Ltd' } },
  ]);
  mockGetDeals.mockResolvedValue([{ id: 'deal-1', name: 'Acme — Q3 Expansion', company_name: 'Acme Ltd' }]);
  mockCreateQuote.mockResolvedValue({ id: 'q-new' });
});

/** Opens the New Quote modal and picks the deal. */
async function openModalWithDeal() {
  const user = userEvent.setup();
  render(<QuotesPage />);
  await waitFor(() => expect(mockGetDeals).toHaveBeenCalled());
  await user.click(screen.getByRole('button', { name: /New Quote/i }));
  await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
  await user.click(screen.getByText('Select a deal...'));
  await user.click(await screen.findByText('Acme — Q3 Expansion'));
  return user;
}

describe('QuotesPage — quote number follows Settings → Documents → Numbering', () => {
  describe('Given Sales Quote auto-numbering is ON', () => {
    beforeEach(() => mockIsAuto.mockResolvedValue(true));

    it('When the modal opens / Then there is no manual Quote Number field and only the deal is sent', async () => {
      const user = await openModalWithDeal();
      await waitFor(() => expect(mockIsAuto).toHaveBeenCalled());

      expect(screen.queryByLabelText(/Quote Number \(manual\)/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Create Quote' }));

      await waitFor(() => expect(mockCreateQuote).toHaveBeenCalledWith({ deal_id: 'deal-1' }));
    });
  });

  describe('Given Sales Quote auto-numbering is OFF', () => {
    beforeEach(() => mockIsAuto.mockResolvedValue(false));

    it('When the modal opens / Then a required manual Quote Number field is shown', async () => {
      await openModalWithDeal();

      expect(await screen.findByLabelText(/Quote Number \(manual\) \*/)).toBeInTheDocument();
      expect(screen.getByText(/turned off in Settings → Documents → Numbering/)).toBeInTheDocument();
    });

    it('When no number is entered / Then Create Quote stays disabled and nothing is sent', async () => {
      const user = await openModalWithDeal();
      const input = await screen.findByLabelText(/Quote Number \(manual\)/);

      await user.type(input, '   ');

      expect(screen.getByRole('button', { name: 'Create Quote' })).toBeDisabled();
      expect(mockCreateQuote).not.toHaveBeenCalled();
    });

    it('When a number is entered / Then it is sent trimmed as quote_number', async () => {
      const user = await openModalWithDeal();
      await user.type(await screen.findByLabelText(/Quote Number \(manual\)/), '  QT-501 ');

      await user.click(screen.getByRole('button', { name: 'Create Quote' }));

      await waitFor(() =>
        expect(mockCreateQuote).toHaveBeenCalledWith({ deal_id: 'deal-1', quote_number: 'QT-501' }),
      );
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q-new'));
    });

    it('When the number is already used / Then the server message is shown', async () => {
      mockCreateQuote.mockRejectedValue(new Error('Quote number QT-501 is already used by another quote in this organization.'));
      const user = await openModalWithDeal();
      await user.type(await screen.findByLabelText(/Quote Number \(manual\)/), 'QT-501');

      await user.click(screen.getByRole('button', { name: 'Create Quote' }));

      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/already used/)));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Given the setting could not be read but crm-be says a number is required', () => {
    beforeEach(() => mockIsAuto.mockResolvedValue(true));

    it('When creating fails with that message / Then the manual field appears', async () => {
      mockCreateQuote.mockRejectedValueOnce(
        new Error('Quote number is required: auto-numbering for Sales Quotes is turned off in Settings → Documents → Numbering.'),
      );
      const user = await openModalWithDeal();

      await user.click(screen.getByRole('button', { name: 'Create Quote' }));

      expect(await screen.findByLabelText(/Quote Number \(manual\)/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Quote' })).toBeDisabled();
    });
  });
});
