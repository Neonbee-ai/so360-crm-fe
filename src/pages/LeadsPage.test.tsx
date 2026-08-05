import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetLeads = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetPartners = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getPartners: (...a: any[]) => mockGetPartners(...a),
    getCustomerSegmentLeads: vi.fn().mockResolvedValue({ leads: [] }),
    updateLead: vi.fn(),
    logActivity: vi.fn(),
    deleteLead: vi.fn(),
  },
  settingsApi: {
    sourceTypes: { getAll: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/crm/leads', search: '' }),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    currentOrg: { id: 'org-1' },
  }),
  useQuota: () => ({
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

// Stub the new grid with a testable proxy
vi.mock('../components/leads/LeadsDataGrid', () => ({
  LeadsDataGrid: ({ leads, isLoading }: any) => (
    <div data-testid="leads-grid">
      {isLoading
        ? 'Loading...'
        : leads.length === 0
        ? 'No leads found'
        : leads.map((l: any) => <div key={l.id} data-testid="lead-row">{l.company_name}</div>)}
    </div>
  ),
}));

vi.mock('../components/leads/LeadDetailPanel', () => ({
  LeadDetailPanel: () => null,
}));

vi.mock('../components/leads/CreateLeadModal', () => ({
  CreateLeadModal: () => null,
}));

import LeadsPage from './LeadsPage';

const settings = {
  deal_stages: [],
  lead_stages: [{ id: 'new', name: 'New' }],
  lead_custom_fields: [],
  deal_custom_fields: [],
  lead_sources: [],
  lead_scoring: [],
  default_owner_id: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLeads.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Test', email: 't@t.com' }]);
  mockGetPartners.mockResolvedValue([]);
});

describe('Given LeadsPage', () => {
  it('When loaded / Then renders header', async () => {
    render(<LeadsPage />);
    expect(screen.getByText('Leads & Accounts')).toBeInTheDocument();
  });

  it('When loaded / Then shows New Lead button', async () => {
    render(<LeadsPage />);
    expect(screen.getByText('New Lead')).toBeInTheDocument();
  });

  it('When no leads / Then shows empty state', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('leads-grid')).toHaveTextContent('No leads found');
    });
  });

  it('When leads loaded / Then shows company names in grid', async () => {
    mockGetLeads.mockResolvedValue([
      {
        id: 'l1',
        company_name: 'Acme Corp',
        contact_name: 'John',
        status: 'New',
        owner: { id: 'u1', full_name: 'Test' },
        creator: { id: 'u1', full_name: 'Test' },
        created_at: '2024-01-01T00:00:00Z',
        activities: [],
        notes: [],
      },
    ]);
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });
});
