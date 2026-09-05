import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

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

vi.mock('@so360/design-system', () => ({
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
import QuotesPage from './QuotesPage';

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

const candidateReviewers = [
  {
    user_id: 'user-submitter-1',
    full_name: 'Submitter User',
    email: 'submitter@example.com',
    job_title: 'Sales Rep',
    department_name: 'Sales',
  },
  {
    user_id: 'user-approver-1',
    full_name: 'Alice Director',
    email: 'alice@example.com',
    job_title: 'Sales Director',
    department_name: 'Sales',
  },
  {
    user_id: 'user-approver-2',
    full_name: 'Bob VP',
    email: 'bob@example.com',
    job_title: 'VP Operations',
    department_name: 'Operations',
  },
];

const pendingQuoteWithMultiApprovers = {
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
      {
        id: 'app-2',
        request_id: 'req-cycle-1',
        quote_id: 'quote-100',
        approver_user_id: 'user-approver-2',
        approver_name: 'Bob VP',
        approver_email: 'bob@example.com',
        status: 'approved',
        decision_at: '2026-09-01T11:30:00Z',
        notes: 'Looks good from ops',
      },
    ],
  },
};

describe('CRM Quote Approval Workflow BDD Specifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMockUser = { id: 'user-submitter-1', name: 'Submitter User' };
    mockGetQuoteById.mockResolvedValue(baseDraftQuote);
    mockGetApprovers.mockResolvedValue(candidateReviewers);
    mockGetStockAvailability.mockResolvedValue({ items: [{ item_id: 'prod-1', available_quantity: 50 }] });
    mockGetQuoteApprovalHistory.mockResolvedValue([]);
    mockGetApprovalsInbox.mockResolvedValue([]);
    mockGetQuotes.mockResolvedValue([baseDraftQuote]);
    mockGetDeals.mockResolvedValue([]);
  });

  describe('Scenario 1: Submitter initiates approval and selects approvers', () => {
    it('Given a draft quote, When "Submit for Approval" is clicked, Then opens Approver Selection modal instead of instantaneous status change', async () => {
      render(<QuoteDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/submit for approval/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/submit for approval/i));

      await waitFor(() => {
        expect(screen.getByText('Submit Quote for Approval')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/search by name, email, department/i)).toBeInTheDocument();
      });

      // Does NOT call immediate submit before modal confirmation
      expect(mockSubmitQuoteForApproval).not.toHaveBeenCalled();
    });

    it('Given Approver Selection modal, When submitter attempts to select themselves, Then self-approval is blocked with an error', async () => {
      render(<QuoteDetailPage />);

      await waitFor(() => screen.getByText(/submit for approval/i));
      fireEvent.click(screen.getByText(/submit for approval/i));

      await waitFor(() => screen.getByPlaceholderText(/search by name, email, department/i));

      const searchInput = screen.getByPlaceholderText(/search by name, email, department/i);
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: 'Submitter' } });

      await waitFor(() => {
        expect(screen.getByText('Submitter User')).toBeInTheDocument();
      });

      // Click on self
      fireEvent.click(screen.getByText('Submitter User'));

      await waitFor(() => {
        expect(screen.getByText(/self-approval is not permitted/i)).toBeInTheDocument();
      });

      expect(mockSubmitQuoteForApproval).not.toHaveBeenCalled();
    });

    it('Given Approver Selection modal, When submitting with valid reviewer, Then calls crmService.submitQuoteForApproval with approver IDs', async () => {
      mockSubmitQuoteForApproval.mockResolvedValue(pendingQuoteWithMultiApprovers);

      render(<QuoteDetailPage />);

      await waitFor(() => screen.getByText(/submit for approval/i));
      fireEvent.click(screen.getByText(/submit for approval/i));

      await waitFor(() => screen.getByPlaceholderText(/search by name, email, department/i));

      const searchInput = screen.getByPlaceholderText(/search by name, email, department/i);
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: 'Alice' } });

      await waitFor(() => {
        expect(screen.getByText('Alice Director')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Alice Director'));

      // Alice should be selected as a chip
      await waitFor(() => {
        expect(screen.getByText('Alice Director')).toBeInTheDocument();
      });

      // Add submission notes
      const notesInput = screen.getByPlaceholderText(/add context or justification for this approval/i);
      fireEvent.change(notesInput, { target: { value: 'Urgent quarterly deal' } });

      // Click Send for Approval
      const sendButton = screen.getByRole('button', { name: /send for approval/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockSubmitQuoteForApproval).toHaveBeenCalledWith('quote-100', {
          approver_user_ids: ['user-approver-1'],
          notes: 'Urgent quarterly deal',
        });
      });
    });
  });

  describe('Scenario 2: Quote Details RBAC and Status Locking during Pending Approval', () => {
    it('Given a quote pending approval, When viewed by the submitter, Then displays Approval in Progress banner and Withdraw button, but NO Approve/Reject buttons', async () => {
      currentMockUser = { id: 'user-submitter-1', name: 'Submitter User' };
      mockGetQuoteById.mockResolvedValue(pendingQuoteWithMultiApprovers);

      render(<QuoteDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Approval in Progress')).toBeInTheDocument();
        expect(screen.getByText(/locked/i)).toBeInTheDocument();
        expect(screen.getByText(/withdraw request/i)).toBeInTheDocument();
      });

      // Submitter must NOT see Approve or Reject buttons
      expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();

      // Edit button must be locked
      expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    });

    it('Given a quote pending approval, When viewed by an assigned pending approver, Then displays Approve and Reject buttons', async () => {
      currentMockUser = { id: 'user-approver-1', name: 'Alice Director' };
      mockGetQuoteById.mockResolvedValue(pendingQuoteWithMultiApprovers);

      render(<QuoteDetailPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^approve$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
      });

      // Approver who is not the submitter cannot withdraw
      expect(screen.queryByText(/withdraw request/i)).not.toBeInTheDocument();
    });

    it('Given an assigned approver, When clicking Approve, Then executes approveQuote API call', async () => {
      currentMockUser = { id: 'user-approver-1', name: 'Alice Director' };
      mockGetQuoteById.mockResolvedValue(pendingQuoteWithMultiApprovers);
      mockApproveQuote.mockResolvedValue({ ...pendingQuoteWithMultiApprovers, status: 'approved' });

      render(<QuoteDetailPage />);

      await waitFor(() => screen.getByRole('button', { name: /^approve$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

      await waitFor(() => {
        expect(mockApproveQuote).toHaveBeenCalledWith('quote-100');
      });
    });

    it('Given an assigned approver, When clicking Reject, Then requires a mandatory rejection reason', async () => {
      currentMockUser = { id: 'user-approver-1', name: 'Alice Director' };
      mockGetQuoteById.mockResolvedValue(pendingQuoteWithMultiApprovers);

      render(<QuoteDetailPage />);

      await waitFor(() => screen.getByRole('button', { name: /^reject$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/please provide a reason/i)).toBeInTheDocument();
      });

      // Confirm reject button should be disabled without reason
      const confirmRejectBtn = screen.getByRole('button', { name: /reject quote/i });
      expect(confirmRejectBtn).toBeDisabled();

      // Enter reason and submit
      fireEvent.change(screen.getByPlaceholderText(/please provide a reason/i), {
        target: { value: 'Discount exceeds 15% threshold' },
      });
      expect(confirmRejectBtn).not.toBeDisabled();

      fireEvent.click(confirmRejectBtn);

      await waitFor(() => {
        expect(mockRejectQuote).toHaveBeenCalledWith('quote-100', 'Discount exceeds 15% threshold');
      });
    });
  });

  describe('Scenario 3: Submitter withdrawal of pending approval request', () => {
    it('Given submitter viewing pending quote, When clicking Withdraw Request and confirming, Then calls withdrawQuoteApproval and unlocks quote to draft', async () => {
      currentMockUser = { id: 'user-submitter-1', name: 'Submitter User' };
      mockGetQuoteById.mockResolvedValue(pendingQuoteWithMultiApprovers);
      mockWithdrawQuoteApproval.mockResolvedValue({ ...baseDraftQuote, status: 'draft' });

      render(<QuoteDetailPage />);

      await waitFor(() => screen.getByText(/withdraw request/i));
      fireEvent.click(screen.getByText(/withdraw request/i));

      await waitFor(() => {
        expect(screen.getByText('Withdraw Approval Request')).toBeInTheDocument();
      });

      const reasonInput = screen.getByPlaceholderText(/updating line item quantities or pricing/i);
      fireEvent.change(reasonInput, { target: { value: 'Client requested revised pricing' } });

      const confirmBtn = screen.getByRole('button', { name: /confirm withdrawal/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockWithdrawQuoteApproval).toHaveBeenCalledWith(
          'quote-100',
          'Client requested revised pricing'
        );
      });
    });
  });

  describe('Scenario 4: Visual Approval History Audit Trail', () => {
    it('Given a quote with past approval cycles, When rendered, Then displays audit trail with reviewers and decisions', async () => {
      const historyRecord = [
        {
          id: 'req-cycle-1',
          quote_id: 'quote-100',
          requested_by: 'Submitter User',
          requested_at: '2026-09-01T10:00:00Z',
          status: 'rejected' as const,
          total_amount_snapshot: 15000,
          notes: 'Initial cycle notes',
          approvers: [
            {
              id: 'app-hist-1',
              approver_user_id: 'user-approver-1',
              approver_name: 'Alice Director',
              approver_email: 'alice@example.com',
              status: 'rejected' as const,
              decision_at: '2026-09-01T10:30:00Z',
              notes: 'Too high discount',
            },
          ],
        },
      ];
      mockGetQuoteApprovalHistory.mockResolvedValue(historyRecord);

      render(<QuoteDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Approval History & Audit Trail')).toBeInTheDocument();
        expect(screen.getByText('Cycle 1')).toBeInTheDocument();
        expect(screen.getByText('Initial cycle notes')).toBeInTheDocument();
        expect(screen.getByText('Too high discount')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 5: Quotes Page — Approvals Inbox tab view', () => {
    it('Given QuotesPage, When rendered, Then displays View Switcher with All Quotes and Approvals tabs and badge', async () => {
      mockGetApprovalsInbox.mockResolvedValue([
        {
          approval_id: 'app-inbox-1',
          quote_id: 'quote-100',
          quote_number: 'Q-2026-001',
          title: 'Enterprise License',
          customer_name: 'Acme Corp',
          total_amount: 15000,
          requested_by: 'Submitter User',
          requested_at: '2026-09-01T10:00:00Z',
          approver_status: 'pending',
          all_approvers: [
            { id: '1', approver_name: 'Alice Director', status: 'pending' },
          ],
        },
      ]);

      render(<QuotesPage />);

      await waitFor(() => {
        expect(screen.getByText('All Quotes')).toBeInTheDocument();
        expect(screen.getByText('Approvals')).toBeInTheDocument();
        // Pending count badge = 1
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Switch to Approvals tab
      fireEvent.click(screen.getByText('Approvals'));

      await waitFor(() => {
        expect(screen.getByText('Enterprise License')).toBeInTheDocument();
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^approve$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
      });
    });

    it('Given Approvals tab in QuotesPage, When Quick Approve is clicked, Then approves quote and refreshes inbox', async () => {
      mockGetApprovalsInbox.mockResolvedValue([
        {
          approval_id: 'app-inbox-1',
          quote_id: 'quote-100',
          quote_number: 'Q-2026-001',
          title: 'Enterprise License',
          customer_name: 'Acme Corp',
          total_amount: 15000,
          requested_by: 'Submitter User',
          approver_status: 'pending',
          all_approvers: [],
        },
      ]);
      mockApproveQuote.mockResolvedValue({ id: 'quote-100', status: 'approved' });

      render(<QuotesPage />);

      await waitFor(() => screen.getByText('Approvals'));
      fireEvent.click(screen.getByText('Approvals'));

      await waitFor(() => screen.getByRole('button', { name: /^approve$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^approve$/i }));

      await waitFor(() => {
        expect(mockApproveQuote).toHaveBeenCalledWith('quote-100');
      });
    });
  });
});
