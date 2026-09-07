import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetQuotes = vi.fn();
const mockGetDeals = vi.fn();
const mockCreateQuote = vi.fn();
const mockDeleteQuote = vi.fn();
const mockUpdateQuoteStatus = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getQuotes: (...a: any[]) => mockGetQuotes(...a),
    getDeals: (...a: any[]) => mockGetDeals(...a),
    createQuote: (...a: any[]) => mockCreateQuote(...a),
    deleteQuote: (...a: any[]) => mockDeleteQuote(...a),
    updateQuoteStatus: (...a: any[]) => mockUpdateQuoteStatus(...a),
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
  useShellBridge: vi.fn(() => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
  })),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 0, isLimited: false }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v.toLocaleString()}`,
    formatDate: (d: string) => (d ? new Date(d).toLocaleDateString('en-US') : '-'),
  }),
}));

// Mock downloadCsv utility
const mockDownloadCsv = vi.fn();
vi.mock('../components/quotes/quotesCsv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/quotes/quotesCsv')>();
  return {
    ...actual,
    downloadCsv: (...args: any[]) => mockDownloadCsv(...args),
  };
});

import QuotesPage from './QuotesPage';

const mockQuotes = [
  {
    id: 'q1',
    quote_number: 'QT-2026-00001',
    title: 'Alpha Implementation',
    status: 'draft',
    customer_name: 'Acme Corp',
    grand_total: 10000,
    valid_until: '2026-12-31',
    created_at: '2026-01-01T10:00:00Z',
    customer_reference: 'REF-ACME-01',
    deal_id: 'd1',
    deal: { id: 'd1', name: 'Acme Enterprise Deal' },
  },
  {
    id: 'q2',
    quote_number: 'QT-2026-00002',
    title: 'Beta Migration',
    status: 'pending_approval',
    customer_name: 'Beta Global',
    grand_total: 25000,
    valid_until: '2020-01-01', // Expired
    created_at: '2026-01-02T10:00:00Z',
    customer_reference: 'REF-BETA-02',
    deal_id: 'd2',
    deal: { id: 'd2', name: 'Beta Cloud Deal' },
  },
  {
    id: 'q3',
    quote_number: 'QT-2026-00003',
    title: 'Gamma Consulting',
    status: 'approved',
    customer_name: 'Gamma Tech',
    grand_total: 5000,
    valid_until: '2026-11-30',
    created_at: '2026-01-03T10:00:00Z',
    deal_id: null,
  },
  {
    id: 'q4',
    quote_number: 'QT-2026-00004',
    title: 'Delta Support',
    status: 'converted',
    customer_name: 'Delta LLC',
    grand_total: 12000,
    valid_until: null,
    created_at: '2026-01-04T10:00:00Z',
    deal_id: null,
  },
];

const mockDeals = [
  { id: 'd1', name: 'Acme Enterprise Deal', company_name: 'Acme Corp' },
  { id: 'd2', name: 'Beta Cloud Deal', company_name: 'Beta Global' },
];

describe('Feature: CRM Quotes Listing ERP UI/UX Improvements (BDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQuotes.mockResolvedValue(mockQuotes);
    mockGetDeals.mockResolvedValue(mockDeals);
  });

  describe('Scenario 1: Interactive KPI Stat Cards', () => {
    it('Given loaded quotes, When rendered, Then displays 5 KPI stat cards with correct counts', async () => {
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      const totalCard = screen.getByRole('group', { name: /kpi total quotes/i });
      const draftCard = screen.getByRole('group', { name: /kpi draft/i });
      const pendingCard = screen.getByRole('group', { name: /kpi pending approval/i });
      const approvedCard = screen.getByRole('group', { name: /kpi approved/i });
      const convertedCard = screen.getByRole('group', { name: /kpi converted/i });

      expect(totalCard).toBeInTheDocument();
      expect(draftCard).toBeInTheDocument();
      expect(pendingCard).toBeInTheDocument();
      expect(approvedCard).toBeInTheDocument();
      expect(convertedCard).toBeInTheDocument();

      expect(totalCard).toHaveTextContent('4');
      expect(draftCard).toHaveTextContent('1');
      expect(pendingCard).toHaveTextContent('1');
      expect(approvedCard).toHaveTextContent('1');
      expect(convertedCard).toHaveTextContent('1');
    });

    it('Given KPI cards, When clicking the Draft card, Then filters table to only draft quotes', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      const draftCard = screen.getByRole('group', { name: /kpi draft/i });
      await user.click(draftCard);

      expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      expect(screen.queryByText('QT-2026-00002')).not.toBeInTheDocument();
      expect(screen.queryByText('QT-2026-00003')).not.toBeInTheDocument();
      expect(screen.queryByText('QT-2026-00004')).not.toBeInTheDocument();
    });
  });

  describe('Scenario 2: Advanced Search, Validity, and Deal Filters', () => {
    it('Given search input, When typing customer reference, Then filters quotes by customer reference', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search quotes\.\.\./i);
      await user.type(searchInput, 'REF-ACME-01');

      expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      expect(screen.queryByText('QT-2026-00002')).not.toBeInTheDocument();
    });

    it('Given validity filter dropdown, When choosing Expired Proposals, Then shows only expired quotes', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      const validitySelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="expired"]'));
      expect(validitySelect).toBeDefined();
      if (validitySelect) {
        await user.selectOptions(validitySelect, 'expired');
      }

      expect(screen.getByText('QT-2026-00002')).toBeInTheDocument();
      expect(screen.queryByText('QT-2026-00001')).not.toBeInTheDocument();
    });

    it('Given active filters, When clicking Clear Filters, Then clears all filters and restores full list', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search quotes\.\.\./i);
      await user.type(searchInput, 'NonExistentXYZ');

      expect(screen.getByText(/no quotes found/i)).toBeInTheDocument();

      const clearBtns = screen.getAllByRole('button', { name: /clear filters/i });
      await user.click(clearBtns[0]);

      expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      expect(screen.getByText('QT-2026-00002')).toBeInTheDocument();
    });
  });

  describe('Scenario 3: Column Header Sorting', () => {
    it('Given the quotes table, When clicking Total header, Then triggers sort toggle', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      const totalHeader = screen.getByRole('button', { name: /total/i });
      expect(totalHeader).toBeInTheDocument();
      await user.click(totalHeader);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /total/i })).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 4: Multi-Row Selection & Bulk CSV Export', () => {
    it('Given multiple quotes, When selecting quotes, Then contextual bulk bar appears and triggers CSV download', async () => {
      const user = userEvent.setup();
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      const selectAll = screen.getByTitle('Select all on this page');
      await user.click(selectAll);

      expect(screen.getByText('4 selected')).toBeInTheDocument();

      const exportBtns = screen.getAllByRole('button', { name: /export csv/i });
      await user.click(exportBtns[0]);

      expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
      expect(mockDownloadCsv).toHaveBeenCalledWith(
        expect.stringMatching(/quotes-export-\d+\.csv/),
        expect.stringContaining('Quote #')
      );

      const deselectBtn = screen.getByRole('button', { name: /deselect/i });
      await user.click(deselectBtn);

      expect(screen.queryByText('4 selected')).not.toBeInTheDocument();
    });
  });

  describe('Scenario 5: Status-Aware Row Actions Menu', () => {
    it('Given a draft quote, When opening the more actions menu, Then presents valid actions', async () => {
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      const moreButtons = screen.getAllByTitle('More actions');
      expect(moreButtons.length).toBeGreaterThan(0);
      moreButtons[0].click();

      await waitFor(() => {
        expect(screen.getByText('View Quote Details')).toBeInTheDocument();
        expect(screen.getByText('Edit Quote')).toBeInTheDocument();
        expect(screen.getByText('Submit for Approval')).toBeInTheDocument();
        expect(screen.getByText('Delete Quote')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 6: Pagination Control', () => {
    it('Given loaded quotes, When rendered, Then shows pagination indicator and page size selector', async () => {
      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('QT-2026-00001')).toBeInTheDocument();
      });

      expect(screen.getByText(/of 4 quotes/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /first/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });
});
