/**
 * BDD: Preview Quote is shown to everyone; the document-layouts flag no longer gates it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetQuoteById = vi.fn();
const mockDownload = vi.fn();
const flags: Record<string, boolean> = {};

vi.mock('../services/crmService', () => ({
  // ProposalEstimatorPanel (estimatorService) reads crmApiClient from this module.
  crmApiClient: { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({}), put: vi.fn().mockResolvedValue({}) },
  crmService: {
    getQuoteById: (...a: any[]) => mockGetQuoteById(...a),
    getStockAvailability: vi.fn().mockResolvedValue({ items: [] }),
  },
}));
vi.mock('../utils/quotePdfDownload', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  downloadQuotePdf: (...a: any[]) => mockDownload(...a),
}));
vi.mock('../components/ProductPickerModal', () => ({ ProductPickerModal: () => null }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'q-1' }), useNavigate: () => vi.fn() }));
vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
    isFeatureEnabled: (k: string) => flags[k] ?? true, isFeatureHidden: () => false,
  }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useOrganization: () => ({ currentOrg: { id: 'org-1', name: 'Test Org' } }),
}));
vi.mock('@so360/formatters', () => ({ useFormatters: () => ({ formatCurrency: (v: number) => `$${v}`, formatDate: (d: string) => d }) }));
vi.mock('@so360/design-system', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useConfirm: () => [vi.fn(async () => true), null],
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  getErrorMessage: (e: any, fallback: string) => e?.message || fallback,
  QuotaBar: () => <div data-testid="quota-bar" />,
  QuotaGate: ({ children }: any) => <>{children}</>,
  CrossLinkChip: () => <span data-testid="cross-link-chip" />,
}));

import QuoteDetailPage from './QuoteDetailPage';

const quote = {
  id: 'q-1', title: 'Test Quote', status: 'draft', quote_number: 'Q-0001',
  grand_total: 5000, subtotal: 5000, tax_amount: 0, discount_amount: 0, created_at: '2024-01-01',
  lines: [{ id: 'ql1', description: 'Widget A', quantity: 2, unit_price: 2500, line_total: 5000, discount_percent: 0, tax_rate: 0 }],
  customer_name: 'Acme Corp',
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(flags)) delete flags[k];
  mockGetQuoteById.mockResolvedValue(quote);
});

describe('Given the document-layouts flag is off', () => {
  beforeEach(() => { flags['submodule:core:document_layouts'] = false; });
  describe('When the quote page loads and the overflow menu is opened', () => {
    it('Then Preview Quote is still available', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      const trigger = screen.queryAllByRole('button', { name: /more|actions|overflow/i })[0];
      if (trigger) fireEvent.click(trigger);
      expect(screen.getAllByText('Preview Quote').length).toBeGreaterThan(0);
    });
  });
});
