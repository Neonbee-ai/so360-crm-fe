/**
 * BDD: Download PDF is a visible header action on a quote (industry oracle:
 * ServiceTitan/Procore show PDF next to Send). It must not hide in the overflow
 * menu when a header slot is free, and it stays gated by action:crm:quote_pdf_download.
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

const quote = (status: string) => ({
  id: 'q-1', title: 'Test Quote', status, quote_number: 'Q-0001',
  grand_total: 5000, subtotal: 5000, tax_amount: 0, discount_amount: 0, created_at: '2024-01-01',
  lines: [{ id: 'ql1', description: 'Widget A', quantity: 2, unit_price: 2500, line_total: 5000, discount_percent: 0, tax_rate: 0 }],
  customer_name: 'Acme Corp',
});

const pdfButton = () => screen.queryAllByRole('button', { name: /Download PDF/i })[0] ?? null;

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(flags)) delete flags[k];
  mockDownload.mockResolvedValue(undefined);
});

describe('Given an approved quote and the PDF flag on', () => {
  beforeEach(() => mockGetQuoteById.mockResolvedValue(quote('approved')));
  describe('When the quote page loads', () => {
    it('Then Download PDF is a visible header button next to Email to Customer', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      expect(pdfButton()).toBeTruthy();
      expect(screen.getAllByText('Email to Customer').length).toBeGreaterThan(0);
    });
  });
  describe('When the user clicks Download PDF', () => {
    it('Then the quote PDF download is requested for this quote', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      fireEvent.click(pdfButton()!);
      await waitFor(() => expect(mockDownload).toHaveBeenCalledWith(expect.objectContaining({ id: 'q-1' })));
    });
  });
});

describe('Given an approved quote and the PDF flag off', () => {
  beforeEach(() => {
    flags['action:crm:quote_pdf_download'] = false;
    mockGetQuoteById.mockResolvedValue(quote('approved'));
  });
  describe('When the quote page loads', () => {
    it('Then no Download PDF button is shown', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      expect(pdfButton()).toBeNull();
    });
  });
});

describe('Given a draft quote with both header slots taken (Edit, Email)', () => {
  beforeEach(() => mockGetQuoteById.mockResolvedValue(quote('draft')));
  describe('When the quote page loads', () => {
    it('Then Edit and Email stay visible (Download PDF does not displace them)', async () => {
      render(<QuoteDetailPage />);
      await waitFor(() => screen.getByText('Test Quote'));
      expect(screen.getAllByRole('button', { name: /^Edit$/ }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Email to Customer/ }).length).toBeGreaterThan(0);
    });
  });
});
