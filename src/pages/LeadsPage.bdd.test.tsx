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
const mockViewsList = vi.fn();
const mockViewsCreate = vi.fn();
const mockViewsRemove = vi.fn();
const mockViewsUpdate = vi.fn();
const mockViewsDuplicate = vi.fn();
const mockViewsSetDefault = vi.fn();
const mockGetLeadsPaged = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getLeadsPaged: (...a: any[]) => mockGetLeadsPaged(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getCustomerSegmentLeads: vi.fn().mockResolvedValue({ leads: [] }),
    updateLead: (...a: any[]) => mockUpdateLead(...a),
    logActivity: (...a: any[]) => mockLogActivity(...a),
    deleteLead: (...a: any[]) => mockDeleteLead(...a),
    bulkDeleteLeads: (...a: any[]) => mockBulkDeleteLeads(...a),
    bulkUpdateLeads: (...a: any[]) => mockBulkUpdateLeads(...a),
    bulkTagLeads: (...a: any[]) => mockBulkTagLeads(...a),
    gridViews: {
      list: (...a: any[]) => mockViewsList(...a),
      create: (...a: any[]) => mockViewsCreate(...a),
      remove: (...a: any[]) => mockViewsRemove(...a),
      update: (...a: any[]) => mockViewsUpdate(...a),
      duplicate: (...a: any[]) => mockViewsDuplicate(...a),
      setDefault: (...a: any[]) => mockViewsSetDefault(...a),
    },
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
  lead_sources: [
    { id: 's1', name: 'Website', archived: false },
    { id: 's2', name: 'Referral', archived: false },
    { id: 's3', name: 'Legacy', archived: true },
  ],
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
  mockGetLeadsPaged.mockResolvedValue({ data: [leads[1]], total: 1 });
  mockViewsList.mockResolvedValue([]);
  mockViewsCreate.mockResolvedValue({ id: 'srv-1', name: 'Server View', config: { filters: {} } });
  mockViewsRemove.mockResolvedValue({ deleted: true });
  mockViewsUpdate.mockResolvedValue({ id: 'srv-1', name: 'Renamed', config: { filters: {} } });
  mockViewsDuplicate.mockResolvedValue({ id: 'srv-dup', name: 'Server View (copy)', config: { filters: {} } });
  mockViewsSetDefault.mockResolvedValue({ id: 'srv-1', is_default: true });
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
      await user.click(screen.getByText('More Filters'));
      const creatorSelect = screen.getByDisplayValue('All');
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

    it('When clicking New Lead / Then opens the create lead modal', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await user.click(screen.getByText('New Lead'));
      expect(screen.getByTestId('create-lead-modal')).toBeInTheDocument();
    });
  });

  describe('Given the compact KPI status chips', () => {
    it('When the page renders / Then each chip shows the count for its stage', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      expect(screen.getByText('3 Total')).toBeInTheDocument();
      expect(screen.getByText('2 New')).toBeInTheDocument();
      expect(screen.getByText('1 Qualified')).toBeInTheDocument();
      expect(screen.getByText('0 Converted')).toBeInTheDocument();
    });

    it('When a stage chip is clicked / Then it applies the same status filter as the Status select', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      await user.click(screen.getByText('1 Qualified'));
      await waitFor(() => {
        expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l2')).toBeInTheDocument();
      });
    });

    it('When an active stage chip is clicked again / Then it resets the status filter to All', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      await user.click(screen.getByText('1 Qualified'));
      await waitFor(() => expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument());
      await user.click(screen.getByText('1 Qualified'));
      await waitFor(() => {
        expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument();
        expect(screen.getByTestId('lead-row-l2')).toBeInTheDocument();
      });
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

  describe('Given the leads KPI total chip (replaces the removed quota progress bar)', () => {
    it('When 3 leads are loaded / Then the Total chip shows leads.length', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      expect(screen.getByText('3 Total')).toBeInTheDocument();
    });

    it('When a lead is deleted / Then the Total chip decrements to reflect the new leads.length', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      expect(screen.getByText('3 Total')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('delete-btn-l1'));
      await waitFor(() => expect(screen.getByText('Delete Lead')).toBeInTheDocument());
      const confirmBtn = screen.getAllByText('Delete').find(
        (el) => el.closest('button')?.className.includes('bg-red'),
      );
      fireEvent.click(confirmBtn!);
      await waitFor(() => expect(mockDeleteLead).toHaveBeenCalledWith('l1'));
      await waitFor(() => expect(screen.getByText('2 Total')).toBeInTheDocument());
    });

    it('When no leads exist / Then the Total chip shows 0', async () => {
      mockGetLeads.mockResolvedValue([]);
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByText('0 Total')).toBeInTheDocument());
    });

    it('When the page loads / Then no quota progress bar is rendered', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      expect(screen.queryByTestId('quota-bar')).not.toBeInTheDocument();
    });
  });

  describe('Given effectiveFlagsLoaded guard — flicker prevention', () => {
    it('When effectiveFlagsLoaded is false / Then New Lead button is absent', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: false,
        isFeatureEnabled: () => false,
      } as any);
      render(<LeadsPage />);
      expect(screen.queryByText('New Lead')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded is true / Then New Lead button is present', async () => {
      const { useShellBridge } = await import('@so360/shell-context');
      vi.mocked(useShellBridge).mockReturnValueOnce({
        effectiveFlagsLoaded: true,
        isFeatureEnabled: () => true,
        currentOrg: { id: 'org-1' },
      } as any);
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByText('Leads & Accounts')).toBeInTheDocument());
      expect(screen.getByText('New Lead')).toBeInTheDocument();
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

    await act(async () => { getBulkAction('Assign').onSelect(['l1'], 'u1'); });

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

describe('LeadsPage — saved views (backend)', () => {
  it('hydrates saved views from the backend on mount', async () => {
    mockViewsList.mockResolvedValueOnce([
      { id: 'srv-9', name: 'Server View', config: { filters: {} }, is_default: false },
    ]);
    const user = userEvent.setup();
    render(<LeadsPage />);
    await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
    await user.click(screen.getByText('Views'));
    await waitFor(() => expect(screen.getByText('Server View')).toBeInTheDocument());
  });

  it('creates a view on the backend when saving', async () => {
    const user = userEvent.setup();
    render(<LeadsPage />);
    await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
    await user.click(screen.getByText('Views'));
    await user.click(screen.getByText('Save current view'));
    await user.type(screen.getByPlaceholderText('View name...'), 'My Hot Leads');
    await user.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(mockViewsCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Hot Leads' })),
    );
  });

  it('deletes a view on the backend', async () => {
    mockViewsList.mockResolvedValueOnce([
      { id: 'srv-9', name: 'Doomed View', config: { filters: {} } },
    ]);
    const user = userEvent.setup();
    render(<LeadsPage />);
    await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
    await user.click(screen.getByText('Views'));
    await waitFor(() => expect(screen.getByText('Doomed View')).toBeInTheDocument());
    // The delete (X) button sits next to the view name in the dropdown row.
    const row = screen.getByText('Doomed View').closest('div')!;
    const delBtn = row.querySelector('button:last-child')!;
    await user.click(delBtn);
    await waitFor(() => expect(mockViewsRemove).toHaveBeenCalledWith('srv-9'));
  });

  describe('Advanced (server-side) filtering', () => {
    it('applies a nested filter tree via the paged endpoint and swaps the list', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());

      await user.click(screen.getByText('Advanced'));
      await user.click(screen.getByText(/add condition/i));
      const rule = screen.getByTestId('filter-rule');
      fireEvent.change(rule.querySelector('input[aria-label="Value"]')!, { target: { value: 'Beta' } });
      await user.click(screen.getByText(/^apply/i));

      await waitFor(() =>
        expect(mockGetLeadsPaged).toHaveBeenCalledWith(
          expect.objectContaining({ filter: expect.stringContaining('company_name') }),
        ),
      );
      // Server returned only Beta Inc (l2) — the grid reflects the filtered set.
      await waitFor(() => {
        expect(screen.getByTestId('lead-row-l2')).toBeInTheDocument();
        expect(screen.queryByTestId('lead-row-l1')).not.toBeInTheDocument();
      });
    });

    it('does not call the paged endpoint when no advanced filter is set', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      expect(mockGetLeadsPaged).not.toHaveBeenCalled();
    });
  });

  describe('Bulk actions wiring', () => {
    const bulkAction = (label: string) =>
      capturedGridProps.bulkActions.find((a: any) => a.label === label);

    const readyGrid = async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
    };

    it('exposes owner/status/source/export/delete bulk actions', async () => {
      await readyGrid();
      const labels = capturedGridProps.bulkActions.map((a: any) => a.label);
      expect(labels).toEqual(expect.arrayContaining(['Assign', 'Status', 'Source', 'Export', 'Delete']));
    });

    it('offers only non-archived sources as options', async () => {
      await readyGrid();
      const values = bulkAction('Source').options.map((o: any) => o.value);
      expect(values).toEqual(['Website', 'Referral']);
    });

    it('bulk status change calls the paged bulk-update with a status patch', async () => {
      await readyGrid();
      bulkAction('Status').onSelect(['l1', 'l3'], 'Qualified');
      await waitFor(() =>
        expect(mockBulkUpdateLeads).toHaveBeenCalledWith(['l1', 'l3'], { status: 'Qualified' }),
      );
    });

    it('bulk source change calls bulk-update with a source patch', async () => {
      await readyGrid();
      bulkAction('Source').onSelect(['l1'], 'Website');
      await waitFor(() =>
        expect(mockBulkUpdateLeads).toHaveBeenCalledWith(['l1'], { source: 'Website' }),
      );
    });

    it('bulk assign calls bulk-update with owner_id', async () => {
      await readyGrid();
      bulkAction('Assign').onSelect(['l1'], 'u2');
      await waitFor(() =>
        expect(mockBulkUpdateLeads).toHaveBeenCalledWith(['l1'], { owner_id: 'u2' }),
      );
    });

    it('export downloads a CSV of the selected rows', async () => {
      await readyGrid();
      const createUrl = vi.fn(() => 'blob:mock');
      const revokeUrl = vi.fn();
      vi.stubGlobal('URL', { ...URL, createObjectURL: createUrl, revokeObjectURL: revokeUrl });
      bulkAction('Export').onClick(['l1']);
      expect(createUrl).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe('Saved view operations (rename/duplicate/set-default/share)', () => {
    const withView = (over: Record<string, any> = {}) => {
      mockViewsList.mockResolvedValue([
        { id: 'srv-1', name: 'Alpha', config: { filters: {} }, is_default: false, is_shared: false, ...over },
      ]);
    };
    const openViews = async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Views'));
      await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    };

    it('renames a view via the backend update', async () => {
      withView();
      await openViews();
      fireEvent.click(screen.getByLabelText('Rename view')); // pencil
      const input = screen.getByLabelText('Rename view'); // now the input
      fireEvent.change(input, { target: { value: 'Beta' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(mockViewsUpdate).toHaveBeenCalledWith('srv-1', { name: 'Beta' }));
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('duplicates a view and appends the server copy', async () => {
      withView();
      await openViews();
      fireEvent.click(screen.getByLabelText('Duplicate view'));
      await waitFor(() => expect(mockViewsDuplicate).toHaveBeenCalledWith('srv-1'));
      await waitFor(() => expect(screen.getByText('Server View (copy)')).toBeInTheDocument());
    });

    it('sets a view as the default', async () => {
      withView();
      await openViews();
      fireEvent.click(screen.getByLabelText('Set as default'));
      await waitFor(() => expect(mockViewsSetDefault).toHaveBeenCalledWith('srv-1'));
    });

    it('shares a view with the team', async () => {
      withView();
      await openViews();
      fireEvent.click(screen.getByLabelText('Share view'));
      await waitFor(() => expect(mockViewsUpdate).toHaveBeenCalledWith('srv-1', { is_shared: true }));
    });

    it('marks the default view once it is hydrated from the backend', async () => {
      withView({ is_default: true });
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument()); // active-view chip
      fireEvent.click(screen.getByText('Alpha'));
      await waitFor(() => expect(screen.getByLabelText('Default view')).toBeInTheDocument());
    });
  });

  describe('Inline cell editing wiring', () => {
    it('persists an inline edit via updateLead and reflects it optimistically', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const lead = capturedGridProps.leads.find((l: any) => l.id === 'l1');
      capturedGridProps.context.onInlineEdit(lead, 'company_name', 'Acme Global');
      await waitFor(() =>
        expect(mockUpdateLead).toHaveBeenCalledWith('l1', { company_name: 'Acme Global' }),
      );
      await waitFor(() =>
        expect(screen.getByTestId('lead-row-l1').textContent).toContain('Acme Global'),
      );
    });

    it('reverts the optimistic change when the update fails', async () => {
      mockUpdateLead.mockRejectedValueOnce(new Error('boom'));
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const lead = capturedGridProps.leads.find((l: any) => l.id === 'l1');
      capturedGridProps.context.onInlineEdit(lead, 'company_name', 'Broken');
      await waitFor(() => expect(mockUpdateLead).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByTestId('lead-row-l1').textContent).toContain('Acme Corp'),
      );
    });
  });
});
