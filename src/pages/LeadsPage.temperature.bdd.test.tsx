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
import { listViewStorageKey } from '../hooks/useListViewState';

/**
 * Feature: Hot / Warm / Cold filter on the leads list (RE plan E §20).
 * The filter and the grid badge exist only when
 * `submodule:crm:re_lead_temperature` is on. Filtering is over the bands
 * crm-be stored on each lead (tenant/org scoping is done by the BE read).
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
});

const loaded = async () => {
  render(<LeadsPage />);
  await waitFor(() => expect(screen.getByTestId('lead-row-h1')).toBeInTheDocument());
};

describe('Given the leads list with lead temperature', () => {
  describe('When the flag is on', () => {
    it('Then the temperature filter shows All, Hot, Warm and Cold and the grid is told to show badges', async () => {
      await loaded();
      const select = screen.getByTestId('lead-temperature-filter') as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['All Temperatures', 'Hot', 'Warm', 'Cold']);
      expect(select.value).toBe('All');
      expect(capturedGridProps.context.showTemperature).toBe(true);
    });

    it('Then choosing Hot keeps only hot leads', async () => {
      await loaded();
      fireEvent.change(screen.getByTestId('lead-temperature-filter'), { target: { value: 'hot' } });
      await waitFor(() => expect(screen.queryByTestId('lead-row-w1')).not.toBeInTheDocument());
      expect(screen.getByTestId('lead-row-h1')).toBeInTheDocument();
      expect(screen.queryByTestId('lead-row-c1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lead-row-n1')).not.toBeInTheDocument();
    });

    it('Then going back to All restores every lead, including unbanded ones', async () => {
      await loaded();
      const select = screen.getByTestId('lead-temperature-filter');
      fireEvent.change(select, { target: { value: 'cold' } });
      await waitFor(() => expect(screen.queryByTestId('lead-row-h1')).not.toBeInTheDocument());
      expect(screen.getByTestId('lead-row-c1')).toBeInTheDocument();
      fireEvent.change(select, { target: { value: 'All' } });
      await waitFor(() => expect(screen.getByTestId('lead-row-n1')).toBeInTheDocument());
      expect(screen.getByTestId('lead-row-h1')).toBeInTheDocument();
    });
  });

  describe('When the session restores filters saved before the temperature filter existed', () => {
    it('Then the temperature filter falls back to All and every lead is listed', async () => {
      sessionStorage.setItem(
        listViewStorageKey('leads.filters'),
        JSON.stringify({ search: '', status: 'All', owner: 'All', creator: 'All', dateRange: 'All', customDateStart: '', customDateEnd: '' }),
      );
      await loaded();
      expect((screen.getByTestId('lead-temperature-filter') as HTMLSelectElement).value).toBe('All');
      for (const id of ['h1', 'w1', 'c1', 'n1']) expect(screen.getByTestId(`lead-row-${id}`)).toBeInTheDocument();
    });
  });

  describe('When the flag is off', () => {
    it('Then there is no temperature filter, no badges and every lead is listed', async () => {
      flagState.temperatureOn = false;
      await loaded();
      expect(screen.queryByTestId('lead-temperature-filter')).not.toBeInTheDocument();
      expect(capturedGridProps.context.showTemperature).toBe(false);
      for (const id of ['h1', 'w1', 'c1', 'n1']) expect(screen.getByTestId(`lead-row-${id}`)).toBeInTheDocument();
    });
  });
});
