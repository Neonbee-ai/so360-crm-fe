import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const flagState = vi.hoisted(() => ({ temperatureOn: true, enabled(k: string) { return k === 'submodule:crm:re_lead_temperature' ? this.temperatureOn : true; } }));
const mockGetLeads = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetPartners = vi.fn();
const mockGetSourceTypes = vi.fn();
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
const mockGetLeadStats = vi.fn();
const mockGetLeadStatusCounts = vi.fn();
const mockExportLeads = vi.fn();
vi.mock('../services/exportService', async (importActual) => ({
  ...(await importActual<any>()),
  exportService: { leads: (...a: any[]) => mockExportLeads(...a) },
}));

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getLeadsPaged: (...a: any[]) => mockGetLeadsPaged(...a),
    getLeadStats: (...a: any[]) => mockGetLeadStats(...a),
    getLeadStatusCounts: (...a: any[]) => mockGetLeadStatusCounts(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getPartners: (...a: any[]) => mockGetPartners(...a),
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
  settingsApi: {
    sourceTypes: {
      getAll: (...a: any[]) => mockGetSourceTypes(...a),
    },
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigationType: () => 'POP',
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/crm/leads', search: '' }),
}));

vi.mock('@so360/shell-context', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useDatasetSchema: () => ({ fields: [], isLoading: false, error: null }),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: vi.fn(() => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: (k: string) => flagState.enabled(k),
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

/**
 * Feature: Hot / Warm / Cold badge on the leads list (RE plan E §20).
 * The grid badge exists only when
 * `submodule:crm:re_lead_temperature` is on. Bands are the ones
 * crm-be stored on each lead.
 */

const lead = (id: string, company: string, temperature: string | null) => ({
  id, company_name: company, contact_name: `${company} Contact`, contact_email: `${id}@x.com`,
  status: 'New', source: 'Website', owner: { id: 'u1', full_name: 'Alice Rep', email: 'a@x.com' },
  created_at: '2025-01-15T10:00:00Z', activities: [], notes: [], temperature,
});

const LEADS = [lead('h1', 'Hot Co', 'hot'), lead('w1', 'Warm Co', 'warm'), lead('c1', 'Cold Co', 'cold'), lead('n1', 'New Co', null)];

beforeEach(() => {
  vi.clearAllMocks();
  flagState.temperatureOn = true;
  mockGetLeads.mockResolvedValue(LEADS);
  mockGetLeadsPaged.mockResolvedValue({ data: LEADS, total: LEADS.length });
  mockGetSettings.mockResolvedValue({
    deal_stages: [], lead_stages: [{ id: 'new', name: 'New' }], lead_custom_fields: [], deal_custom_fields: [],
    lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
  });
  mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Alice Rep', email: 'a@x.com' }]);
  mockGetPartners.mockResolvedValue([]);
  mockGetSourceTypes.mockResolvedValue([]);
  mockViewsList.mockResolvedValue([]);
  mockExportLeads.mockResolvedValue(undefined);
  mockGetLeadStats.mockResolvedValue({ total: 4 });
  mockGetLeadStatusCounts.mockResolvedValue({});
});

const loaded = async () => {
  render(<LeadsPage />);
  await waitFor(() => expect(screen.getByTestId('lead-row-h1')).toBeInTheDocument());
};

describe('Given the leads list with lead temperature', () => {
  describe('When the flag is on', () => {
    it('Then the grid is told to show temperature badges', async () => {
      await loaded();
      expect(capturedGridProps.context.showTemperature).toBe(true);
    });

    it('Then there is no page-local temperature filter', async () => {
      await loaded();
      expect(screen.queryByTestId('lead-temperature-filter')).not.toBeInTheDocument();
      for (const id of ['h1', 'w1', 'c1', 'n1']) expect(screen.getByTestId(`lead-row-${id}`)).toBeInTheDocument();
    });
  });

  describe('When the flag is off', () => {
    it('Then no badges are shown and every lead is listed', async () => {
      flagState.temperatureOn = false;
      await loaded();
      expect(capturedGridProps.context.showTemperature).toBe(false);
      for (const id of ['h1', 'w1', 'c1', 'n1']) expect(screen.getByTestId(`lead-row-${id}`)).toBeInTheDocument();
    });
  });
});
