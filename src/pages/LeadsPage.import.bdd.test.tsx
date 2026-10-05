import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>(), canCreate: true, loaded: true, denied: new Set<string>() }));
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

vi.mock('../components/leads/LeadDetailPanel', () => ({
  LeadDetailPanel: () => null,
}));

vi.mock('../components/leads/CreateLeadModal', () => ({
  CreateLeadModal: () => null,
}));

vi.mock('../components/import/ImportHub', () => ({
  ImportHub: ({ isOpen, onClose, onImported }: { isOpen: boolean; onClose: () => void; onImported: () => void }) => (
    isOpen ? (
      <div data-testid="import-wizard">
        <button type="button" onClick={onClose}>close wizard</button>
        <button type="button" onClick={onImported}>finish import</button>
      </div>
    ) : null
  ),
}));

import LeadsPage from './LeadsPage';

beforeEach(() => {
  vi.clearAllMocks();
  flags.on.clear();
  flags.canCreate = true;
  flags.denied.clear();
  flags.loaded = true;
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

  describe('When the flag is on but the user lacks leads.import', () => {
    it('Then there is no Import button', async () => {
      flags.on.add('action:crm:bulk_import');
      flags.denied.add('leads.import');
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

  describe('When the wizard is closed', () => {
    it('Then it unmounts and Import can reopen it', async () => {
      flags.on.add('action:crm:bulk_import');
      render(<LeadsPage />);
      fireEvent.click(await screen.findByRole('button', { name: /^import$/i }));
      fireEvent.click(screen.getByRole('button', { name: 'close wizard' }));
      expect(screen.queryByTestId('import-wizard')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
      expect(screen.getByTestId('import-wizard')).toBeInTheDocument();
    });
  });

  describe('When the wizard reports an import', () => {
    it('Then the leads list is fetched again', async () => {
      flags.on.add('action:crm:bulk_import');
      render(<LeadsPage />);
      fireEvent.click(await screen.findByRole('button', { name: /^import$/i }));
      await waitFor(() => expect(mockGetLeads).toHaveBeenCalled());
      const before = mockGetLeads.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'finish import' }));
      await waitFor(() => expect(mockGetLeads.mock.calls.length).toBeGreaterThan(before));
    });
  });

  describe('When the flag is on but effective flags have not loaded', () => {
    it('Then there is no Import button (fail closed)', async () => {
      flags.on.add('action:crm:bulk_import');
      flags.loaded = false;
      render(<LeadsPage />);
      await screen.findByText('Leads & Accounts');
      expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument();
    });
  });
});

describe('Given the Leads page export / import RBAC (a25bf315)', () => {
  const exportGroup = () => screen.queryByRole('group', { name: 'Export leads' });
  const importBtn = () => screen.queryByRole('button', { name: /^import$/i });
  const bulkLabels = () => screen.queryAllByTestId('bulk-action').map((b) => b.textContent);

  describe('When the user has neither leads.export nor leads.import', () => {
    it('Then the header shows only New Lead, with no export or import controls', async () => {
      flags.on.add('action:crm:bulk_import');
      flags.denied.add('leads.export').add('leads.import');
      render(<LeadsPage />);
      const newLead = await screen.findByText('New Lead');
      expect(exportGroup()).toBeNull();
      expect(importBtn()).toBeNull();
      // No empty wrapper left behind: New Lead is the only control in the header actions.
      expect(newLead.closest('div.flex.items-center.gap-2')?.querySelectorAll('button')).toHaveLength(1);
    });
  });

  describe('When the user has only leads.export', () => {
    it('Then export is visible and import is hidden', async () => {
      flags.on.add('action:crm:bulk_import');
      flags.denied.add('leads.import');
      render(<LeadsPage />);
      await screen.findByText('New Lead');
      expect(exportGroup()).toBeInTheDocument();
      expect(importBtn()).toBeNull();
    });
  });

  describe('When the user has only leads.import', () => {
    it('Then import is visible and export is hidden', async () => {
      flags.on.add('action:crm:bulk_import');
      flags.denied.add('leads.export');
      render(<LeadsPage />);
      await screen.findByText('New Lead');
      expect(importBtn()).toBeInTheDocument();
      expect(exportGroup()).toBeNull();
    });
  });

  describe('When the user selects rows without leads.export', () => {
    it('Then the bulk Export action is not offered', async () => {
      flags.denied.add('leads.export');
      render(<LeadsPage />);
      await screen.findByText('New Lead');
      expect(bulkLabels()).toContain('Status');
      expect(bulkLabels()).not.toContain('Export');
    });
  });

  describe('When the user selects rows with leads.export', () => {
    it('Then the bulk Export action is offered', async () => {
      render(<LeadsPage />);
      await screen.findByText('New Lead');
      expect(bulkLabels()).toContain('Export');
    });
  });
});
