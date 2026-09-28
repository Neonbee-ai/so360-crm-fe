import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>(), canCreate: true }));
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
    permissionsLoaded: true,
    hasPermission: (p: string) => p !== 'leads.create' || flags.canCreate,
    hasAnyPermission: () => true,
    isFeatureEnabled: (k: string) => k !== 'action:crm:bulk_import' || flags.on.has(k),
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

vi.mock('../components/leads/ImportLeadsWizard', () => ({
  ImportLeadsWizard: ({ isOpen }: any) => (isOpen ? <div data-testid="import-wizard" /> : null),
}));

import LeadsPage from './LeadsPage';

beforeEach(() => {
  vi.clearAllMocks();
  flags.on.clear();
  flags.canCreate = true;
  mockGetLeads.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue({ deal_stages: [], lead_stages: [{ id: 'new', name: 'New' }], lead_custom_fields: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [] });
  mockGetUsers.mockResolvedValue([]);
  mockGetPartners.mockResolvedValue([]);
});

describe('Given the Leads page header', () => {
  describe('When the bulk import flag is off (non-RE tenant)', () => {
    it('Then there is no Import button', async () => {
      render(<LeadsPage />);
      expect(await screen.findByText('New Lead')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument();
    });
  });

  describe('When the flag is on but the user cannot create leads', () => {
    it('Then there is no Import button', async () => {
      flags.on.add('action:crm:bulk_import');
      flags.canCreate = false;
      render(<LeadsPage />);
      await screen.findByText('Leads & Accounts');
      expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument();
    });
  });

  describe('When the flag is on and the user can create leads', () => {
    it('Then Import opens the import wizard in one tap', async () => {
      flags.on.add('action:crm:bulk_import');
      render(<LeadsPage />);
      fireEvent.click(await screen.findByRole('button', { name: /^import$/i }));
      expect(screen.getByTestId('import-wizard')).toBeInTheDocument();
    });
  });
});
