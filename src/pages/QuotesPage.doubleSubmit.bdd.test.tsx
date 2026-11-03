/**
 * QuotesPage — one Create Quote click burst creates one quote (Pulse 3f510e56)
 *
 * On live a single save produced 3 identical quotes: the New Quote modal's
 * Create Quote button stayed enabled while POST /quotes was in flight, so every
 * extra click/Enter sent another create. The handler now holds an in-flight
 * guard and the button is disabled ("Creating…") until the request settles.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe('QuotesPage — Create Quote submits once per in-flight request', () => {
  beforeEach(() => mockIsAuto.mockResolvedValue(true));

  it('Given a create request is in flight / When Create Quote is clicked three times in the same tick / Then only one quote is created', async () => {
    const pending = deferred<{ id: string }>();
    mockCreateQuote.mockReturnValue(pending.promise);
    await openModalWithDeal();
    const button = screen.getByRole('button', { name: 'Create Quote' });

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ id: 'q-new' }); });
    expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q-new');
  });

  it('Given a create request is in flight / When the modal re-renders / Then the button is disabled and reads Creating…', async () => {
    const pending = deferred<{ id: string }>();
    mockCreateQuote.mockReturnValue(pending.promise);
    const user = await openModalWithDeal();

    await user.click(screen.getByRole('button', { name: 'Create Quote' }));

    const busy = await screen.findByRole('button', { name: 'Creating…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await act(async () => { pending.resolve({ id: 'q-new' }); });
  });

  it('Given the create request failed / When the user retries / Then the button is re-enabled and a second request is sent', async () => {
    mockCreateQuote.mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce({ id: 'q-retry' });
    const user = await openModalWithDeal();

    await user.click(screen.getByRole('button', { name: 'Create Quote' }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Network down'));
    const retry = await screen.findByRole('button', { name: 'Create Quote' });
    expect(retry).not.toBeDisabled();
    await user.click(retry);

    await waitFor(() => expect(mockCreateQuote).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/crm/quotes/q-retry'));
  });
});
