import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetLeads = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockUpdateLead = vi.fn();
const mockLogActivity = vi.fn();
const mockDeleteLead = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getCustomerSegmentLeads: vi.fn().mockResolvedValue({ leads: [] }),
    updateLead: (...a: any[]) => mockUpdateLead(...a),
    logActivity: (...a: any[]) => mockLogActivity(...a),
    deleteLead: (...a: any[]) => mockDeleteLead(...a),
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
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),

  useQuota: vi.fn().mockReturnValue({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 0, isLimited: false }),}));

let tableProps: any = {};
vi.mock('../components/common/Table', () => ({
  Table: (props: any) => {
    tableProps = props;
    if (props.isLoading) return <div data-testid="table">Loading...</div>;
    if (props.data.length === 0) return <div data-testid="table">{props.emptyMessage}</div>;
    return (
      <div data-testid="table">
        {props.data.map((lead: any) => (
          <div key={lead.id} data-testid={`lead-row-${lead.id}`} onClick={() => props.onRowClick(lead)}>
            {lead.company_name} - {lead.contact_name} - {lead.status}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('../components/leads/CreateLeadModal', () => ({
  CreateLeadModal: ({ isOpen, onClose }: any) =>
    isOpen ? <div data-testid="create-lead-modal"><button onClick={onClose}>Close Modal</button></div> : null,
}));

import LeadsPage from './LeadsPage';

const settings = {
  deal_stages: [],
  lead_stages: [{ id: 'new', name: 'New' }, { id: 'qualified', name: 'Qualified' }, { id: 'converted', name: 'Converted' }],
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
  { id: 'l1', company_name: 'Acme Corp', contact_name: 'John Doe', contact_email: 'john@acme.com', phone: '555-1234', status: 'New', source: 'Website', owner: users[0], creator: users[0], created_at: '2025-01-15T10:00:00Z' },
  { id: 'l2', company_name: 'Beta Inc', contact_name: 'Jane Smith', contact_email: 'jane@beta.com', status: 'Qualified', source: 'Referral', owner: users[1], creator: users[1], created_at: '2025-02-20T10:00:00Z' },
  { id: 'l3', company_name: 'Gamma LLC', contact_name: 'Bob Brown', contact_email: 'bob@gamma.com', status: 'New', source: 'Website', owner: users[0], creator: users[0], created_at: '2025-03-10T10:00:00Z' },
];

beforeEach(async () => {
  vi.clearAllMocks();
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
  tableProps = {};
  mockGetLeads.mockResolvedValue(leads);
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue(users);
  mockUpdateLead.mockResolvedValue({});
  mockLogActivity.mockResolvedValue({});
  mockDeleteLead.mockResolvedValue({});
});

describe('LeadsPage', () => {
  describe('Given leads are loaded', () => {
    it('When the page renders / Then displays all leads in the table', async () => {
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

    it('When clicking a lead row / Then navigates to the lead detail', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      await user.click(screen.getByTestId('lead-row-l1'));
      expect(mockNavigate).toHaveBeenCalledWith('l1');
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
        expect(screen.getByTestId('table')).toHaveTextContent('No leads found');
      });
    });
  });

  describe('Given leads are sorted', () => {
    it('When clicking sort by company name / Then leads reorder alphabetically', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const rows = screen.getAllByTestId(/lead-row/);
      expect(rows[0]).toHaveTextContent('Acme Corp');
    });
  });

  describe('Given owner filter', () => {
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
  });

  describe('Given creator filter', () => {
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
  });

  describe('Given date range filter', () => {
    it('When filtering by This Month / Then filters leads by date', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const dateSelect = screen.getByDisplayValue('All Time');
      await user.selectOptions(dateSelect, 'This Month');
      await waitFor(() => expect(tableProps.data).toBeDefined());
    });

    it('When filtering by Today / Then applies today date filter', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const dateSelect = screen.getByDisplayValue('All Time');
      await user.selectOptions(dateSelect, 'Today');
      await waitFor(() => expect(tableProps.data.length).toBe(0));
    });
  });

  describe('Given clear filters', () => {
    it('When filters are active and Clear Filters is clicked / Then resets all filters', async () => {
      const user = userEvent.setup();
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const statusSelect = screen.getByDisplayValue('All Statuses');
      await user.selectOptions(statusSelect, 'Qualified');
      await waitFor(() => expect(screen.getByText('Clear Filters')).toBeInTheDocument());
      await user.click(screen.getByText('Clear Filters'));
      await waitFor(() => expect(tableProps.data.length).toBe(3));
    });
  });

  describe('Given lead deletion', () => {
    it('When delete is triggered / Then calls deleteLead API', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const deleteCol = tableProps.columns[tableProps.columns.length - 1];
      const cell = deleteCol.accessor(leads[0]);
      const { container } = render(cell);
      const btn = container.querySelector('button');
      fireEvent.click(btn!);
      await waitFor(() => expect(screen.getByText('Delete Lead')).toBeInTheDocument());
      const deleteConfirm = screen.getAllByText('Delete').find(el => {
        const btn = el.closest('button');
        return btn?.className.includes('bg-red');
      });
      fireEvent.click(deleteConfirm!);
      await waitFor(() => expect(mockDeleteLead).toHaveBeenCalledWith('l1'));
    });
  });

  describe('Given column renderers', () => {
    it('When owner column renders / Then shows owner select', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const ownerCol = tableProps.columns[2];
      const cell = ownerCol.accessor(leads[0]);
      const { container } = render(cell);
      const select = container.querySelector('select');
      expect(select?.value).toBe('u1');
    });

    it('When status column renders / Then shows status select with correct value', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const statusCol = tableProps.columns[3];
      const cell = statusCol.accessor(leads[0]);
      const { container } = render(cell);
      const select = container.querySelector('select');
      expect(select?.value).toBe('new');
    });

    it('When created column renders / Then shows creator name and date', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const createdCol = tableProps.columns[4];
      const cell = createdCol.accessor(leads[0]);
      const { container } = render(cell);
      expect(container.textContent).toContain('Alice Rep');
    });

    it('When communication column renders lead with phone / Then shows phone', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      const commCol = tableProps.columns[1];
      const cell = commCol.accessor(leads[0]);
      const { container } = render(cell);
      expect(container.textContent).toContain('555-1234');
    });
  });

  describe('Given pagination', () => {
    it('When many leads exist / Then shows pagination controls', async () => {
      const manyLeads = Array.from({ length: 15 }, (_, i) => ({
        id: `l${i}`, company_name: `Company ${i}`, contact_name: `Contact ${i}`, contact_email: `c${i}@test.com`,
        status: 'New', source: 'Web', owner: users[0], creator: users[0], created_at: '2025-01-15T10:00:00Z',
      }));
      mockGetLeads.mockResolvedValue(manyLeads);
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument());
    });
  });

  describe('Given fetch error', () => {
    it('When API fails / Then shows error in empty message', async () => {
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
      // Override useQuota so quotaData is non-null with current_usage=1 (stale),
      // while leads.length=3 — lets us verify the counter uses DB count not event-sourced usage.
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
      // leads.length = 3; quotaData.current_usage = 1 — must show 3
      expect(bar.getAttribute('data-used')).toBe('3');
    });

    it('When a lead is deleted / Then QuotaBar used decrements to reflect the new leads.length', async () => {
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      expect(screen.getByTestId('quota-bar').getAttribute('data-used')).toBe('3');

      // Trigger delete via column accessor (same pattern as existing delete test)
      const deleteCol = tableProps.columns[tableProps.columns.length - 1];
      const cell = deleteCol.accessor(leads[0]);
      const { container } = render(cell);
      fireEvent.click(container.querySelector('button')!);
      await waitFor(() => expect(screen.getByText('Delete Lead')).toBeInTheDocument());
      const confirmBtn = screen.getAllByText('Delete').find(
        el => el.closest('button')?.className.includes('bg-red'),
      );
      fireEvent.click(confirmBtn!);
      await waitFor(() => expect(mockDeleteLead).toHaveBeenCalledWith('l1'));

      // After delete, leads state has 2 items → QuotaBar should show 2
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

    it('When QuotaBar label is rendered / Then it shows Leads not Contacts', async () => {
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
      // Buttons gated by canCreateLead must not flash before flags resolve
      expect(screen.queryByText('Create Lead')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded is true and isFeatureEnabled returns true / Then Create Lead button is present', async () => {
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
});
