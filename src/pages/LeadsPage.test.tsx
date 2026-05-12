import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetLeads = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getCustomerSegmentLeads: vi.fn().mockResolvedValue({ leads: [] }),
    updateLead: vi.fn(),
    logActivity: vi.fn(),
    deleteLead: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/crm/leads', search: '' }),
}));

vi.mock('@so360/shell-context', () => ({
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../components/common/Table', () => ({
  Table: ({ data, isLoading, emptyMessage }: any) => (
    <div data-testid="table">{isLoading ? 'Loading...' : data.length === 0 ? emptyMessage : `${data.length} rows`}</div>
  ),
}));

vi.mock('../components/leads/CreateLeadModal', () => ({
  CreateLeadModal: () => null,
}));

import LeadsPage from './LeadsPage';

const settings = {
  deal_stages: [], lead_stages: [{ id: 'ls1', name: 'Open' }],
  lead_custom_fields: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLeads.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Test', email: 't@t.com' }]);
});

describe('LeadsPage', () => {
  it('renders header', async () => {
    render(<LeadsPage />);
    expect(screen.getByText('Leads & Accounts')).toBeInTheDocument();
  });

  it('shows Create Lead button', async () => {
    render(<LeadsPage />);
    expect(screen.getByText('Create Lead')).toBeInTheDocument();
  });

  it('shows empty state when no leads', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table')).toHaveTextContent('No leads found');
    });
  });

  it('shows rows when leads loaded', async () => {
    mockGetLeads.mockResolvedValue([
      { id: 'l1', company_name: 'Acme', contact_name: 'John', status: 'Open', owner: { id: 'u1', full_name: 'Test' }, creator: { id: 'u1', full_name: 'Test' }, created_at: '2024-01-01' },
    ]);
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('table')).toHaveTextContent('1 rows');
    });
  });
});
