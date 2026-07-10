import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetLeads = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockUpdateLead = vi.fn();
const mockLogActivity = vi.fn();
const mockDeleteLead = vi.fn();
const mockBulkDeleteLeads = vi.fn();
const mockBulkUpdateLeads = vi.fn();
const mockBulkTagLeads = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getCustomerSegmentLeads: vi.fn().mockResolvedValue({ leads: [] }),
    updateLead: (...a: any[]) => mockUpdateLead(...a),
    logActivity: (...a: any[]) => mockLogActivity(...a),
    deleteLead: (...a: any[]) => mockDeleteLead(...a),
    bulkDeleteLeads: (...a: any[]) => mockBulkDeleteLeads(...a),
    bulkUpdateLeads: (...a: any[]) => mockBulkUpdateLeads(...a),
    bulkTagLeads: (...a: any[]) => mockBulkTagLeads(...a),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/crm/leads', search: '' }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: vi.fn(() => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    currentOrg: { id: 'org-1' },
  })),
  useQuota: vi.fn().mockReturnValue({
    quotas: [],
    isLoading: false,
    error: null,
    isExceeded: () => false,
    getQuota: () => null,
    getPercentage: () => 0,
    refresh: async () => {},
  }),
  useSandboxLimit: () => ({
    isSandboxMode: false,
    sandboxEntryLimit: 100,
    limitItems: (items: any[]) => items,
    isLimited: (_count: number) => false,
  }),
}));

// Grid stub: renders each lead as a testable row, exposes onDelete via data-attribute button
let capturedGridProps: any = null;
vi.mock('../components/leads/LeadsDataGrid', () => ({
  LeadsDataGrid: (props: any) => {
    capturedGridProps = props;
    if (props.isLoading) return <div data-testid="leads-grid">Loading...</div>;
    if (props.leads.length === 0) {
      return <div data-testid="leads-grid">No leads found</div>;
    }
    return (
      <div data-testid="leads-grid">
        {props.leads.map((lead: any) => (
          <div
            key={lead.id}
            data-testid={`lead-row-${lead.id}`}
            onClick={() => props.onRowClick(lead)}
          >
            {lead.company_name} — {lead.status} — {lead.owner?.id}
            <button
              data-testid={`delete-btn-${lead.id}`}
              onClick={(e) => { e.stopPropagation(); props.context.onDelete(lead); }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('../components/leads/LeadDetailPanel', () => ({
  LeadDetailPanel: ({ lead, onClose }: any) =>
    lead ? (
      <div data-testid="detail-panel">
        {lead.company_name}
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../components/leads/CreateLeadModal', () => ({
  CreateLeadModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="create-lead-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null,
}));

import LeadsPage from './LeadsPage';

const settings = {
  deal_stages: [],
  lead_stages: [
    { id: 'new', name: 'New' },
    { id: 'qualified', name: 'Qualified' },
    { id: 'converted', name: 'Converted' },
  ],
  lead_custom_fields: [],
  deal_custom_fields: [],
  lead_sources: [],
  lead_scoring: [],
  default_owner_id: 'u1',
};

const users = [
  { id: 'u1', full_name: 'Alice Rep', email: 'alice@test.com' },
  { id: 'u2', full_name: 'Bob Manager', email: 'bob@test.com' },
];

const leads = [
  {
    id: 'l1', company_name: 'Acme Corp', contact_name: 'John Doe', first_name: 'John', last_name: 'Doe',
    contact_email: 'john@acme.com', phone: '555-1234', status: 'New', source: 'Website',
    owner: users[0], creator: users[0], created_at: '2025-01-15T10:00:00Z', activities: [], notes: [],
  },
  {
    id: 'l2', company_name: 'Beta Inc', contact_name: 'Jane Smith', first_name: 'Jane', last_name: 'Smith',
    contact_email: 'jane@beta.com', status: 'Qualified', source: 'Referral',
    owner: users[1], creator: users[1], created_at: '2025-02-20T10:00:00Z', activities: [], notes: [],
  },
  {
    id: 'l3', company_name: 'Gamma LLC', contact_name: 'Bob Brown', first_name: 'Bob', last_name: 'Brown',
    contact_email: 'bob@gamma.com', status: 'New', source: 'Website',
    owner: users[0], creator: users[0], created_at: '2025-03-10T10:00:00Z', activities: [], notes: [],
  },
];

beforeEach(async () => {
  vi.clearAllMocks();
  capturedGridProps = null;
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    currentOrg: { id: 'org-1' },
  }));
  vi.mocked(shell.useQuota).mockReturnValue({
    quotas: [],
    isLoading: false,
    error: null,
    isExceeded: () => false,
    getQuota: () => null,
    getPercentage: () => 0,
    refresh: async () => {},
  });
  mockGetLeads.mockResolvedValue(leads);
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue(users);
  mockUpdateLead.mockResolvedValue({});
  mockLogActivity.mockResolvedValue({});
  mockDeleteLead.mockResolvedValue({});
  mockBulkDeleteLeads.mockResolvedValue({ requested: 1, deleted: ['l1'], failed: [] });
  mockBulkUpdateLeads.mockResolvedValue({ requested: 1, updated: ['l1'], failed: [] });
  mockBulkTagLeads.mockResolvedValue({ requested: 1, updated: ['l1'], failed: [] });
});

describe('LeadsPage', () => {
  describe('Given leads are loaded', () => {
    it('When the page renders / Then displays all leads in the grid', async () => {
      render(<LeadsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l2')).toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l3')).toBeInTheDocument();
      });
    });

    it('When searching by contact name / Then filters leads matching the search term', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const searchInput = screen.getByPlaceholderText('Search leads...');
      await user.type(searchInput, 'Jane');
      await waitFor(() => {
        expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l2')).toBeInTheDocument();
      });
    });

    it('When searching by company name / Then filters leads matching the company', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const searchInput = screen.getByPlaceholderText('Search leads...');
      await user.type(searchInput, 'Gamma');
      await waitFor(() => {
        expect(screen.getByTestId('lead-row-l3')).toBeInTheDocument();
        expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('lead-row-l2')).not.toBeInTheDocument();
      });
    });

    it('When filtering by status / Then only leads with that status appear', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const statusSelect = screen.getByDisplayValue('All Statuses');
      await user.selectOptions(statusSelect, 'Qualified');
      await waitFor(() => {
        expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l2')).toBeInTheDocument();
        expect(screen.queryByTestId('lead-row-l3')).not.toBeInTheDocument();
      });
    });

    it('When filtering by owner / Then only leads with that owner appear', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const ownerSelect = screen.getByDisplayValue('All Owners');
      await user.selectOptions(ownerSelect, 'u2');
      await waitFor(() => {
        expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l2')).toBeInTheDocument();
      });
    });

    it('When filtering by creator / Then only leads by that creator appear', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const creatorSelect = screen.getByDisplayValue('Created By: All');
      await user.selectOptions(creatorSelect, 'u2');
      await waitFor(() => {
        expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l2')).toBeInTheDocument();
      });
    });

    it('When filters are active / Then Clear filters link appears and resets all filters on click', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const statusSelect = screen.getByDisplayValue('All Statuses');
      await user.selectOptions(statusSelect, 'Qualified');
      await waitFor(() => expect(screen.getByText('Clear filters')).toBeInTheDocument());
      await user.click(screen.getByText('Clear filters'));
      await waitFor(() => {
        expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l3')).toBeInTheDocument();
      });
    });

    it('When clicking a lead row / Then opens the detail panel', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      await user.click(screen.getByTestId('lead-row-l1'));
      await waitFor(() => expect(screen.getByTestId('detail-panel')).toBeInTheDocument());
      expect(screen.getByTestId('detail-panel')).toHaveTextContent('Acme Corp');
    });

    it('When clicking Create Lead / Then opens the create lead modal', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await user.click(screen.getByText('Create Lead'));
      expect(screen.getByTestId('create-lead-modal')).toBeInTheDocument();
    });
  });

  describe('Given no leads exist', () => {
    it('When the page renders / Then shows the empty state message', async () => {
      mockGetLeads.mockResolvedValue([]);
      render(<LeadsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('leads-grid')).toHaveTextContent('No leads found');
      });
    });
  });

  describe('Given lead deletion', () => {
    it('When delete is triggered / Then shows confirmation dialog', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('delete-btn-l1'));
      await waitFor(() => expect(screen.getByText('Delete Lead')).toBeInTheDocument());
    });

    it('When delete confirmed / Then calls deleteLead API and removes row', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('delete-btn-l1'));
      await waitFor(() => expect(screen.getByText('Delete Lead')).toBeInTheDocument());
      const confirmBtn = screen.getAllByText('Delete').find(
        (el) => el.closest('button')?.className.includes('bg-red'),
      );
      fireEvent.click(confirmBtn!);
      await waitFor(() => expect(mockDeleteLead).toHaveBeenCalledWith('l1'));
      await waitFor(() => expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument());
    });

    it('When delete cancelled / Then lead remains in grid', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('delete-btn-l1'));
      await waitFor(() => expect(screen.getByText('Delete Lead')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Cancel'));
      await waitFor(() => expect(screen.queryByText('Delete Lead')).not.toBeInTheDocument());
      expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument();
    });
  });

  describe('Given pagination', () => {
    it('When many leads exist / Then shows pagination controls', async () => {
      const manyLeads = Array.from({ length: 60 }, (_, i) => ({
        id: `l${i}`,
        company_name: `Company ${i}`,
        contact_name: `Contact ${i}`,
        contact_email: `c${i}@test.com`,
        status: 'New',
        source: 'Web',
        owner: users[0],
        creator: users[0],
        created_at: '2025-01-15T10:00:00Z',
        activities: [],
        notes: [],
      }));
      mockGetLeads.mockResolvedValue(manyLeads);
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByText(/Page 1 of/)).toBeInTheDocument());
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  describe('Given fetch error', () => {
    it('When API fails / Then shows error message', async () => {
      mockGetLeads.mockRejectedValue(new Error('Network error'));
      mockGetSettings.mockRejectedValue(new Error('Network error'));
      mockGetUsers.mockRejectedValue(new Error('Network error'));
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
    });
  });

  describe('Given the leads quota counter', () => {
    const staleQuotaData = { current_usage: 1, limit: -1, is_unlimited: true };

    beforeEach(async () => {
      const shellContext = await import('@so360/shell-context');
      vi.mocked(shellContext.useQuota).mockReturnValue({
        quotas: [],
        isLoading: false,
        error: null,
        isExceeded: () => false,
        getQuota: () => staleQuotaData,
        getPercentage: () => 0,
        refresh: async () => {},
      });
    });

    it('When 3 leads are loaded / Then QuotaBar used equals leads.length not quotaData.current_usage', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const bar = screen.getByTestId('quota-bar');
      expect(bar.getAttribute('data-used')).toBe('3');
    });

    it('When a lead is deleted / Then QuotaBar used decrements to reflect new leads.length', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      expect(screen.getByTestId('quota-bar').getAttribute('data-used')).toBe('3');
      fireEvent.click(screen.getByTestId('delete-btn-l1'));
      await waitFor(() => expect(screen.getByText('Delete Lead')).toBeInTheDocument());
      const confirmBtn = screen.getAllByText('Delete').find(
        (el) => el.closest('button')?.className.includes('bg-red'),
      );
      fireEvent.click(confirmBtn!);
      await waitFor(() => expect(mockDeleteLead).toHaveBeenCalledWith('l1'));
      await waitFor(() =>
        expect(screen.getByTestId('quota-bar').getAttribute('data-used')).toBe('2'),
      );
    });

    it('When no leads exist / Then QuotaBar used is 0', async () => {
      mockGetLeads.mockResolvedValue([]);
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('quota-bar')).toBeInTheDocument());
      expect(screen.getByTestId('quota-bar').getAttribute('data-used')).toBe('0');
    });

    it('When QuotaBar label is rendered / Then it shows "Leads"', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('quota-bar')).toBeInTheDocument());
      expect(screen.getByTestId('quota-bar').textContent).toContain('Leads');
    });
  });

  describe('Given effectiveFlagsLoaded guard — flicker prevention', () => {
    it('When effectiveFlagsLoaded is false / Then Create Lead button is absent', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: false,
        isFeatureEnabled: () => false,
      } as any);
      render(<LeadsPage />);
      expect(screen.queryByText('Create Lead')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded is true / Then Create Lead button is present', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1' },
      } as any);
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByText('Leads & Accounts')).toBeInTheDocument());
      expect(screen.getByText('Create Lead')).toBeInTheDocument();
    });
  });

  describe('Given saved views', () => {
    it('When Views button is clicked / Then shows saved views dropdown', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await user.click(screen.getByText('Views'));
      expect(screen.getByText('Save current view')).toBeInTheDocument();
    });
  });
});

describe('LeadsPage — bulk actions', () => {
  const getBulkAction = (label: string) =>
    capturedGridProps.bulkActions.find((a: { label: string }) => a.label === label);

  it('When the bulk Delete action fires / Then it calls the bulk delete endpoint once and removes confirmed rows', async () => {
    render(<LeadsPage />);
    await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());

    await act(async () => { getBulkAction('Delete').onClick(['l1']); });

    expect(mockBulkDeleteLeads).toHaveBeenCalledWith(['l1']);
    expect(mockBulkDeleteLeads).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument());
  });

  it('When the bulk Assign action fires / Then it sends owner_id via the bulk update endpoint', async () => {
    render(<LeadsPage />);
    await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());

    await act(async () => { getBulkAction('Assign').onClick(['l1']); });

    expect(mockBulkUpdateLeads).toHaveBeenCalledWith(['l1'], { owner_id: 'u1' });
  });

  it('When the bulk delete endpoint fails / Then rows are still optimistically removed', async () => {
    mockBulkDeleteLeads.mockRejectedValueOnce(new Error('offline'));
    render(<LeadsPage />);
    await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());

    await act(async () => { getBulkAction('Delete').onClick(['l1']); });

    await waitFor(() => expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument());
  });
});
