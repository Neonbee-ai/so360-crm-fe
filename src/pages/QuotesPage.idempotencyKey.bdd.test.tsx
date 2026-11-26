/**
 * QuotesPage — Create Quote sends one Idempotency-Key per form session (Pulse 3f510e56)
 *
 * crm-be returns the quote already created for a repeated key, so a retry
 * after a lost response/timeout must reuse the key, while a fresh form
 * (modal reopened, or after a successful create) must mint a new one.
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
  await user.click(await screen.findByText('Acme — Q3 Expansion', { selector: 'span' }));
  return user;
}

const keyOf = (call: number) => mockCreateQuote.mock.calls[call][1]?.idempotencyKey;

describe('QuotesPage — Create Quote Idempotency-Key', () => {
  beforeEach(() => mockIsAuto.mockResolvedValue(true));

  it('Given the New Quote form / When Create Quote is clicked / Then a non-empty Idempotency-Key is sent', async () => {
    const user = await openModalWithDeal();
    await user.click(screen.getByRole('button', { name: 'Create Quote' }));
    await waitFor(() => expect(mockCreateQuote).toHaveBeenCalledTimes(1));
    expect(typeof keyOf(0)).toBe('string');
    expect(keyOf(0).length).toBeGreaterThan(0);
  });

  it('Given the first create failed / When the user retries the same form / Then the same key is sent again', async () => {
    mockCreateQuote.mockRejectedValueOnce(new Error('Gateway timeout')).mockResolvedValueOnce({ id: 'q-retry' });
    const user = await openModalWithDeal();

    await user.click(screen.getByRole('button', { name: 'Create Quote' }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Gateway timeout'));
    await user.click(await screen.findByRole('button', { name: 'Create Quote' }));

    await waitFor(() => expect(mockCreateQuote).toHaveBeenCalledTimes(2));
    expect(keyOf(1)).toBe(keyOf(0));
  });

  it('Given a create failed / When the modal is closed and reopened and the user creates again / Then a new key is sent', async () => {
    mockCreateQuote.mockRejectedValueOnce(new Error('Gateway timeout')).mockResolvedValueOnce({ id: 'q-2' });
    const user = await openModalWithDeal();

    await user.click(screen.getByRole('button', { name: 'Create Quote' }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Gateway timeout'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Create New Quote')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /New Quote/i }));
    await waitFor(() => expect(screen.getByText('Create New Quote')).toBeInTheDocument());
    await user.click(screen.getByText('Select a deal...'));
    await user.click(await screen.findByText('Acme — Q3 Expansion', { selector: 'span' }));
    await user.click(screen.getByRole('button', { name: 'Create Quote' }));

    await waitFor(() => expect(mockCreateQuote).toHaveBeenCalledTimes(2));
    expect(keyOf(1)).not.toBe(keyOf(0));
  });
});
