import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadDetailPanel } from "./LeadDetailPanel";
import type { Lead } from '../../types/crm';

const mockGetDeals = vi.fn();
const mockGetTasks = vi.fn();
const mockGetActivities = vi.fn();
const mockGetUsers = vi.fn();
const mockGetPartners = vi.fn();
const mockGetSourceTypes = vi.fn();
const mockGetLeadById = vi.fn();
const mockUpdateTask = vi.fn();
const mockUseEntityTimeline = vi.fn();
// Custom-field values are stored keyed by definition id; the definitions are
// what let the panel show the configured label instead of that UUID.
const mockGetSettings = vi.fn();

vi.mock('../../pages/components/timeline/useEntityTimeline', () => ({
  useEntityTimeline: (...a: any[]) => mockUseEntityTimeline(...a),
}));

vi.mock('../../services/crmService', () => ({
  crmService: {
    getDealsByLeadId: (...a: any[]) => mockGetDeals(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasks(...a),
    getActivitiesByLeadIdPaginated: (...a: any[]) => mockGetActivities(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getPartners: (...a: any[]) => mockGetPartners(...a),
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
  },
  settingsApi: {
    sourceTypes: {
      getAll: (...a: any[]) => mockGetSourceTypes(...a),
    },
  },
}));

vi.mock('../../utils/formatters', () => ({
  useCRMFormatters: () => ({
    formatDate: (d: string, options: any = {}) =>
      options.hour
        ? `${new Date(d).toISOString().slice(0, 10)} ${new Date(d).toISOString().slice(11, 16)}`
        : new Date(d).toISOString().slice(0, 10),
    formatCurrency: (v: number) => `$${v}`,
  }),
}));

const flag = vi.hoisted(() => ({ on: true }));

vi.mock('@so360/shell-context', async (orig) => ({
  ...(await orig<any>()),
  useDatasetSchema: () => ({ fields: [], isLoading: false, error: null }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true,
    isFeatureEnabled: (k: string) => (k === 'submodule:crm:dl_custom_fields' ? flag.on : true),
    isFeatureHidden: () => false,
  }),
}));

vi.mock('../customFields/DlCustomFieldsPanel', () => ({
  DL_CUSTOM_FIELDS_FLAG: 'submodule:crm:dl_custom_fields',
  DlCustomFieldsPanel: (p: any) => <div data-testid="dl-panel">{p.entity}:{p.recordId}:{String(p.version)}</div>,
}));

const lead = {
  id: 'lead-1', company_name: 'Acme Corp', contact_name: 'Jane Doe', contact_email: 'j@a.com',
  status: 'New', owner: { id: 'u1', full_name: 'Alice', email: 'a@a.com' }, created_at: '2026-01-01T00:00:00Z',
  activities: [], notes: [], dl_custom_fields: { budget: 1 }, custom_fields_version: 2,
} as unknown as Lead;

beforeEach(() => {
  vi.clearAllMocks();
  flag.on = true;
  mockGetDeals.mockResolvedValue([]);
  mockGetTasks.mockResolvedValue([]);
  mockGetActivities.mockResolvedValue({ data: [], total: 0 });
  mockGetUsers.mockResolvedValue([]);
  mockGetPartners.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue({ lead_custom_fields: [] });
  mockGetSourceTypes.mockResolvedValue([]);
  mockUseEntityTimeline.mockReturnValue({ events: [], loading: false, error: null, hasMore: false, refetch: vi.fn() });
  mockGetLeadById.mockResolvedValue(undefined);
});

const mount = () => render(<LeadDetailPanel lead={lead} onClose={vi.fn()} onNavigate={vi.fn()} onNavigateDeal={vi.fn()} onNavigateTask={vi.fn()} />);

describe('LeadDetailPanel data-layer custom fields', () => {
  it('Given the flag is on / When overview shows / Then the crm.lead panel renders with the lead id and version', async () => {
    mount();
    expect(screen.getByTestId('lead-panel-dl-custom-fields')).toBeInTheDocument();
    expect(screen.getByTestId('dl-panel').textContent).toBe('lead:lead-1:2');
  });

  it('Given the flag is on / Then the fresh lead is fetched for version', async () => {
    mount();
    await waitFor(() => expect(mockGetLeadById).toHaveBeenCalledWith('lead-1'));
  });

  it('Given the flag is off / Then no panel and no extra lead fetch', async () => {
    flag.on = false;
    mount();
    expect(screen.queryByTestId('lead-panel-dl-custom-fields')).toBeNull();
    expect(mockGetLeadById).not.toHaveBeenCalled();
  });
});
