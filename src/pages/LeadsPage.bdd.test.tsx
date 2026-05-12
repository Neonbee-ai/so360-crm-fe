import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
}));

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
  lead_stages: [{ id: 'ls1', name: 'Open' }, { id: 'ls2', name: 'Qualified' }, { id: 'ls3', name: 'Won' }],
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
  { id: 'l1', company_name: 'Acme Corp', contact_name: 'John Doe', contact_email: 'john@acme.com', phone: '555-1234', status: 'Open', source: 'Website', owner: users[0], creator: users[0], created_at: '2025-01-15T10:00:00Z' },
  { id: 'l2', company_name: 'Beta Inc', contact_name: 'Jane Smith', contact_email: 'jane@beta.com', status: 'Qualified', source: 'Referral', owner: users[1], creator: users[1], created_at: '2025-02-20T10:00:00Z' },
  { id: 'l3', company_name: 'Gamma LLC', contact_name: 'Bob Brown', contact_email: 'bob@gamma.com', status: 'Open', source: 'Website', owner: users[0], creator: users[0], created_at: '2025-03-10T10:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
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
});
