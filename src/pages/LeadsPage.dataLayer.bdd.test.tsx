import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

/**
 * Data Layer Class B list columns on the Leads list (crm.lead). The page turns
 * the crm.lead dataset schema into grid column descriptors and hands them to
 * LeadsDataGrid; with submodule:data_layer:custom_fields off it hands over none.
 */
const dl = vi.hoisted(() => ({ fields: [] as any[], layouts: {} as Record<string, any> }));

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

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeads: (...a: any[]) => mockGetLeads(...a),
    getLeadsPaged: (...a: any[]) => mockGetLeadsPaged(...a),
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
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/crm/leads', search: '' }),
}));

vi.mock('@so360/shell-context', () => ({
  useDatasetSchema: (code: string | null) => ({ fields: code === 'crm.lead' ? dl.fields : [] }),
  useSlotRenderers: () => [],
  registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
  getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useNotify: () => ({ emitNotification: vi.fn().mockResolvedValue(undefined) }),
  useActivity: () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }),
  useShellBridge: vi.fn(() => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true,
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
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true,
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
  mockGetPartners.mockResolvedValue([]);
  mockGetSourceTypes.mockResolvedValue([]);
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


const FIELDS = [
  { field_key: 'plate', label: 'Vehicle Plate', field_type: 'text', indexed: true, sort_order: 2 },
  { field_key: 'notes_private', label: 'Private Notes', field_type: 'text', indexed: false, sort_order: 1 },
  { field_key: 'secret', label: 'Secret', field_type: 'text', visibility_profile: 'hidden', sort_order: 3 },
];

async function withFlag(on: boolean) {
  const shell = await import('@so360/shell-context');
  vi.mocked(shell.useShellBridge).mockImplementation(() => ({
    effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
    isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? on : true),
    isFeatureHidden: () => false,
    currentOrg: { id: 'org-1' },
  }) as any);
}

describe('Feature: Data Layer columns handed to the Leads grid', () => {
  beforeEach(() => { dl.fields = FIELDS; dl.layouts = {}; });

  describe('Scenario: the data-layer flag is off', () => {
    it('then the grid receives an empty dataLayerColumns list', async () => {
      // Given the flag is off and the crm.lead schema has fields
      await withFlag(false);
      // When the Leads page renders
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      // Then no Class B column reaches the grid
      expect(capturedGridProps.dataLayerColumns).toEqual([]);
    });
  });

  describe('Scenario: the data-layer flag is on', () => {
    it('then the grid receives the visible fields ordered by sort_order, sortable/filterable only when indexed', async () => {
      // Given the flag is on
      await withFlag(true);
      // When the Leads page renders
      render(<LeadsPage />);
      await waitFor(() => expect(screen.getByTestId('lead-row-l1')).toBeInTheDocument());
      // Then the column descriptors mirror the schema, hidden fields excluded
      await waitFor(() => expect(capturedGridProps.dataLayerColumns).toEqual([
        { key: 'notes_private', label: 'Private Notes', fieldType: 'text', filterable: false, sortable: false },
        { key: 'plate', label: 'Vehicle Plate', fieldType: 'text', filterable: true, sortable: true },
      ]));
    });
  });
});
