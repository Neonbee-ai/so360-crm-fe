import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const loaded = vi.hoisted(() => ({ importHub: false, createLead: false, detail: false }));
const flags = vi.hoisted(() => ({ on: new Set<string>(), canCreate: true, loaded: true, denied: new Set<string>() }));
const mockGetLeads = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetPartners = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getLeadStatusCounts: async () => ({}),
    getLeadsPaged: async (...a: any[]) => { const d = await mockGetLeads(...a); return { data: d, total: d.length }; },
    getLeadStats: async () => ({ total: 0 }),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getPartners: (...a: any[]) => mockGetPartners(...a),
    updateLead: vi.fn(),
    logActivity: vi.fn(),
    deleteLead: vi.fn(),
  },
  settingsApi: {
    sourceTypes: { getAll: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigationType: () => 'POP',
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/crm/leads', search: '' }),
}));

vi.mock('@so360/shell-context', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useDatasetSchema: () => ({ fields: [], isLoading: false, error: null }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: flags.loaded,
    permissionsLoaded: true,
    hasPermission: (p: string) => (p === 'leads.create' ? flags.canCreate : !flags.denied.has(p)),
    hasAnyPermission: () => true,
    isFeatureEnabled: (k: string) => (k === 'action:crm:bulk_import' ? flags.on.has(k) : true),
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
  LeadsDataGrid: ({ leads, isLoading, bulkActions }: any) => (
    <div data-testid="leads-grid">
      {(bulkActions ?? []).map((a: any) => <button key={a.label} type="button" data-testid="bulk-action">{a.label}</button>)}
      {isLoading
        ? 'Loading...'
        : leads.length === 0
        ? 'No leads found'
        : leads.map((l: any) => <div key={l.id} data-testid="lead-row">{l.company_name}</div>)}
    </div>
  ),
}));

vi.mock('../components/leads/LeadDetailPanel', () => { loaded.detail = true; return { LeadDetailPanel: () => null }; });

vi.mock('../components/leads/CreateLeadModal', () => { loaded.createLead = true; return { CreateLeadModal: ({ isOpen }: any) => (isOpen ? <div data-testid="create-lead-modal" /> : null) }; });

vi.mock('../components/import/ImportHub', () => { loaded.importHub = true; return {
  ImportHub: ({ isOpen, onClose, onImported }: { isOpen: boolean; onClose: () => void; onImported: () => void }) => (
    isOpen ? (
      <div data-testid="import-wizard">
        <button type="button" onClick={onClose}>close wizard</button>
        <button type="button" onClick={onImported}>finish import</button>
      </div>
    ) : null
  ),
}; });

import LeadsPage from './LeadsPage';

beforeEach(() => {
  vi.clearAllMocks();
  flags.on.clear();
  flags.on.add('action:crm:bulk_import');
  flags.canCreate = true;
  flags.denied.clear();
  flags.loaded = true;
  mockGetLeads.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue({ deal_stages: [], lead_stages: [{ id: 'new', name: 'New' }], lead_custom_fields: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [] });
  mockGetUsers.mockResolvedValue([]);
  mockGetPartners.mockResolvedValue([]);
});

describe('Given the Leads page with on-demand heavy modals', () => {
  describe('When the page first renders', () => {
    it('Then neither the import hub nor the create modal chunk has been requested', async () => {
      render(<LeadsPage />);
      expect(await screen.findByText('New Lead')).toBeInTheDocument();
      expect(loaded.importHub).toBe(false);
      expect(loaded.createLead).toBe(false);
      expect(loaded.detail).toBe(false);
    });
  });

  describe('When the user presses Import', () => {
    it('Then the import hub chunk loads and the wizard mounts', async () => {
      render(<LeadsPage />);
      fireEvent.click(await screen.findByRole('button', { name: /^import$/i }));
      expect(await screen.findByTestId('import-wizard')).toBeInTheDocument();
      expect(loaded.importHub).toBe(true);
    });
  });

  describe('When the user presses New Lead', () => {
    it('Then the create modal chunk loads and the modal mounts', async () => {
      render(<LeadsPage />);
      fireEvent.click(await screen.findByText('New Lead'));
      expect(await screen.findByTestId('create-lead-modal')).toBeInTheDocument();
      expect(loaded.createLead).toBe(true);
    });
  });
});
