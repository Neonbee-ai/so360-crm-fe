import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Regression coverage for the "Approval in Progress" panel amber/warning
// color scoping fix: the panel container must not carry a text-amber-*
// class (which previously cascaded amber text onto every child), while
// the icon and the compact "Locked" badge retain their scoped amber accent.

const mockGetQuoteById = vi.fn();
const mockUpdateQuote = vi.fn();
const mockSubmitQuoteForApproval = vi.fn();
const mockWithdrawQuoteApproval = vi.fn();
const mockApproveQuote = vi.fn();
const mockRejectQuote = vi.fn();
const mockGetQuoteApprovalHistory = vi.fn();
const mockGetApprovalsInbox = vi.fn();
const mockGetApprovers = vi.fn();
const mockGetStockAvailability = vi.fn();
const mockGetQuotes = vi.fn();
const mockGetDeals = vi.fn();

vi.mock('../services/crmService', () => ({
  // ProposalEstimatorPanel (estimatorService) reads crmApiClient from this module.
  crmApiClient: { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({}), put: vi.fn().mockResolvedValue({}) },
  crmService: {
    getQuoteById: (...a: any[]) => mockGetQuoteById(...a),
    updateQuote: (...a: any[]) => mockUpdateQuote(...a),
    submitQuoteForApproval: (...a: any[]) => mockSubmitQuoteForApproval(...a),
    withdrawQuoteApproval: (...a: any[]) => mockWithdrawQuoteApproval(...a),
    approveQuote: (...a: any[]) => mockApproveQuote(...a),
    rejectQuote: (...a: any[]) => mockRejectQuote(...a),
    getQuoteApprovalHistory: (...a: any[]) => mockGetQuoteApprovalHistory(...a),
    getApprovalsInbox: (...a: any[]) => mockGetApprovalsInbox(...a),
    getApprovers: (...a: any[]) => mockGetApprovers(...a),
    getStockAvailability: (...a: any[]) => mockGetStockAvailability(...a),
    getQuotes: (...a: any[]) => mockGetQuotes(...a),
    getDeals: (...a: any[]) => mockGetDeals(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'quote-100' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/crm/quotes', search: '' }),
}));

let currentMockUser = { id: 'user-submitter-1', name: 'Submitter User' };

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({
    settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' },
  }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    user: currentMockUser,
    currentOrg: { id: 'org-1', name: 'Test Org' },
  }),
  useQuota: () => ({
    quotas: [],
    isLoading: false,
    error: null,
    isExceeded: () => false,
    getQuota: () => ({ current_usage: 5, limit: 100, is_unlimited: false }),
    getPercentage: () => 5,
    refresh: async () => {},
  }),
  useOrganization: () => ({ currentOrg: { id: 'org-1', name: 'Test Org' } }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 10, isLimited: () => false }),
}));

vi.mock('@so360/formatters', () => ({
  useFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatDate: (d: string) => d,
  }),
}));

vi.mock('@so360/design-system', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useConfirm: () => [vi.fn(async () => true), null],
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  getErrorMessage: (e: any, fallback: string) => e?.message || fallback,
  QuotaBar: () => <div data-testid="quota-bar" />,
  QuotaGate: ({ children }: any) => <>{children}</>,
  CrossLinkChip: () => <span data-testid="cross-link-chip" />,
}));

import QuoteDetailPage from './QuoteDetailPage';

const baseDraftQuote = {
  id: 'quote-100',
  quote_number: 'Q-2026-001',
  title: 'Enterprise Software License',
  status: 'draft',
  grand_total: 15000,
  total_amount: 15000,
  created_by: { id: 'user-submitter-1', name: 'Submitter User' },
  submitted_by: 'user-submitter-1',
  lines: [
    { id: 'line-1', description: 'License Seat x 10', quantity: 10, unit_price: 1500, item_id: 'prod-1' },
  ],
  created_at: '2026-09-01T10:00:00Z',
};

const pendingQuoteWithApprovers = {
  ...baseDraftQuote,
  status: 'pending_approval',
  current_approval_request_id: 'req-cycle-1',
  current_approval_request: {
    id: 'req-cycle-1',
    quote_id: 'quote-100',
    requested_by: 'user-submitter-1',
    requested_at: '2026-09-01T11:00:00Z',
    status: 'pending',
    total_amount_snapshot: 15000,
    notes: 'Please approve high-value enterprise license',
    approvers: [
      {
        id: 'app-1',
        request_id: 'req-cycle-1',
        quote_id: 'quote-100',
        approver_user_id: 'user-approver-1',
        approver_name: 'Alice Director',
        approver_email: 'alice@example.com',
        status: 'pending',
        decision_at: null,
      },
    ],
  },
};

describe('QuoteDetailPage Approval-in-Progress panel styling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockUser = { id: 'user-submitter-1', name: 'Submitter User' };
    mockGetQuoteById.mockResolvedValue(pendingQuoteWithApprovers);
    mockGetApprovers.mockResolvedValue([]);
    mockGetStockAvailability.mockResolvedValue({ items: [{ item_id: 'prod-1', available_quantity: 50 }] });
    mockGetQuoteApprovalHistory.mockResolvedValue([]);
    mockGetApprovalsInbox.mockResolvedValue([]);
    mockGetQuotes.mockResolvedValue([pendingQuoteWithApprovers]);
    mockGetDeals.mockResolvedValue([]);
  });

  describe('Given a quote with status pending_approval and locked panel', () => {
    it('Then the panel renders as a Comb warning Alert with token colours only', async () => {
      render(<QuoteDetailPage />);

      const heading = await screen.findByText('Approval in Progress');
      const container = (heading.closest('[role="alert"]') ?? heading.parentElement) as HTMLElement;
      expect(container).toBeTruthy();
      expect(container.className).not.toMatch(/(amber|yellow|orange)-\d/);
    });

    it('Then the body description uses standard muted text color, not amber', async () => {
      render(<QuoteDetailPage />);

      const body = await screen.findByText(/currently undergoing approval review/i);
      expect(body.className).toContain('text-fg-muted');
      expect(body.className).not.toMatch(/text-warning/);
    });

    it('Then the "Locked" badge renders as a compact warning Badge', async () => {
      render(<QuoteDetailPage />);

      const badge = await screen.findByText('Locked');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Given the Required Approvers section with an approver name and PENDING status', () => {
    it('Then the approver name and status render inside a Badge', async () => {
      render(<QuoteDetailPage />);

      const approverName = await screen.findByText('Alice Director');
      expect(approverName.className).not.toMatch(/text-warning/);
      expect(approverName.parentElement?.textContent).toContain('(pending)');
    });
  });

  describe('Given the "Required Approvers" label', () => {
    it('Then the label uses standard muted text color, not amber', async () => {
      render(<QuoteDetailPage />);

      const label = await screen.findByText('Required Approvers:');
      expect(label.className).toContain('text-fg-muted');
      expect(label.className).not.toMatch(/text-warning/);
    });
  });

  describe('Given the current user is an authorized pending approver (not the submitter)', () => {
    it('Then the assigned-reviewer note renders with its scoped emerald accent', async () => {
      currentMockUser = { id: 'user-approver-1', name: 'Alice Director' };

      render(<QuoteDetailPage />);

      const note = await screen.findByText(/you are an assigned reviewer/i);
      expect(note.className).toContain('text-success');
    });
  });

  describe('Given approvers with decided statuses (approved / rejected)', () => {
    it('Then the approved approver chip uses the success tone and the rejected approver chip uses the danger tone', async () => {
      mockGetQuoteById.mockResolvedValue({
        ...pendingQuoteWithApprovers,
        current_approval_request: {
          ...pendingQuoteWithApprovers.current_approval_request,
          approvers: [
            { id: 'app-approved', approver_user_id: 'user-approver-2', approver_name: 'Bob VP', status: 'approved' },
            { id: 'app-rejected', approver_user_id: 'user-approver-3', approver_name: 'Carol CFO', status: 'rejected' },
          ],
        },
      });

      render(<QuoteDetailPage />);

      const approvedName = await screen.findByText('Bob VP');
      expect(approvedName.closest('[data-tone]')).toHaveAttribute('data-tone', 'success');

      const rejectedName = await screen.findByText('Carol CFO');
      expect(rejectedName.closest('[data-tone]')).toHaveAttribute('data-tone', 'danger');

      // Names themselves stay neutral regardless of the chip's semantic tone.
      expect(approvedName.className).not.toMatch(/text-(success|danger|warning)/);
      expect(rejectedName.className).not.toMatch(/text-(success|danger|warning)/);
    });
  });
});
