import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LeadDetailPage from './LeadDetailPage';

/**
 * Data Layer Class B on Lead Detail (crm.lead).
 * The page hosts Shell-registered renderers in named regions (actions, main,
 * sidebar, tabs) behind submodule:data_layer:custom_fields. With the flag off,
 * or with nothing registered, the page must render exactly as before.
 */

const dl = vi.hoisted(() => ({
  flag: false,
  regs: [] as any[],
  layouts: {} as Record<string, any>,
}));

function ProbeRenderer(props: any) {
  return (
    <div
      data-testid={`probe-${props.registration.id}`}
      data-entity={props.datasetCode}
      data-record-id={props.recordId}
      data-version={String(props.version)}
      data-can-edit={String(props.canEdit)}
      data-save-mode={props.saveMode}
    >
      probe:{props.slot}
    </div>
  );
}

const mockCrmService = vi.hoisted(() => ({
  createNote: vi.fn(),
  deleteDocument: vi.fn(),
  deleteLead: vi.fn(),
  deleteNote: vi.fn(),
  getActivitiesByLeadId: vi.fn(),
  getActivitiesByLeadIdPaginated: vi.fn(),
  getDealsByLeadId: vi.fn(),
  getDocumentDownloadUrl: vi.fn(),
  getDocumentsByLeadId: vi.fn(),
  getLeadById: vi.fn(),
  getPartners: vi.fn(),
  getSettings: vi.fn(),
  getTasksByLeadId: vi.fn(),
  getUsers: vi.fn(),
  // useLeadDetailLayoutPreferences persists column layout on an 800ms timer and
  // chains .catch() on the result, so these must exist and return promises —
  // otherwise the timer fires after the test ends and throws an uncaught
  // "Cannot read properties of undefined" that fails the whole file.
  gridColumns: {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
  },
  logActivity: vi.fn(),
  updateLead: vi.fn(),
  updateNote: vi.fn(),
  updateTask: vi.fn(),
  uploadDocument: vi.fn(),
}));

const mockSettingsApi = vi.hoisted(() => ({
  sourceTypes: { getAll: vi.fn() },
  scoringRules: { recalculate: vi.fn() },
}));

const mockActivitiesApi = vi.hoisted(() => ({
  getByLeadId: vi.fn(),
  create: vi.fn(),
}));

const mockLeadsApi = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
  leadsApi: mockLeadsApi,
  dealsApi: { update: vi.fn() },
  partnersApi: { update: vi.fn() },
  settingsApi: mockSettingsApi,
  activitiesApi: mockActivitiesApi,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'lead-1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/', state: null }),
  Link: ({ children }: any) => children,
  NavLink: ({ children }: any) => children,
}));

vi.mock('@so360/shell-context', () => ({
  useCurrentEntity: () => ({ setCurrentEntity: vi.fn() }),
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    effectiveFlagsLoaded: true,
    isAdmin: false,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
    isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
  }),
  // Shell dataLayer API (shell-context) — registry is driven by `dl`.
  useDatasetSchema: () => ({ fields: [] }),
  useSlotRenderers: (code: string, slot: string, _opts: any) =>
    dl.regs
      .filter((r: any) => r.dataset_code === code && r.slot === slot)
      .map((r: any) => ({ registration: r, Renderer: ProbeRenderer, key: r.id })),
  registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
  getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
  useShell: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isModuleEnabled: () => true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
  }),
  useBusinessSettings: () => ({ base_currency: 'USD', locale: 'en-US', currency: 'USD' }),
  useActivity: () => ({ logActivity: vi.fn(), recordActivity: vi.fn() }),
  useNotify: () => ({ notify: vi.fn(), emitNotification: vi.fn() }),
  useOrganization: () => ({ id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', name: 'Test Org' }),
  useQuota: () => ({ quota: { max: 1000, used: 0 }, isExceeded: false, getQuota: vi.fn() }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 1000, limitItems: (items: any[]) => items, isLimited: false }),
  ShellContext: React.createContext({}),
  useIdentity: () => ({ user: { id: 'mock-user-id', email: 'test@test.com', full_name: 'Test User' } }),
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

// Field names matter: the page renders first_name / company_name, not `name`.
const mockLead = {
  id: 'lead-1',
  first_name: 'Alice',
  last_name: 'Kumar',
  company_name: 'Acme Corp',
  email: 'alice@acme.com',
  status: 'qualified',
  notes: [],
  documents: [],
  activities: [],
};


const reg = (over: any) => ({ id: 'r1', dataset_code: 'crm.lead', slot: 'detail.section', renderer: 'custom_fields', ...over });

beforeEach(() => {
  vi.clearAllMocks();
  dl.flag = false;
  dl.regs = [];
  dl.layouts = {};
  mockCrmService.getLeadById.mockResolvedValue({ ...mockLead, updated_at: '2026-09-30T10:00:00Z', class_b_custom_fields: { plate: 'KL-01' } });
  mockCrmService.getActivitiesByLeadIdPaginated.mockResolvedValue({ data: [], total: 0 });
  mockCrmService.getTasksByLeadId.mockResolvedValue([]);
  mockCrmService.getDealsByLeadId.mockResolvedValue([]);
  mockCrmService.getUsers.mockResolvedValue([]);
  mockCrmService.getPartners.mockResolvedValue([]);
  mockCrmService.getDocumentsByLeadId.mockResolvedValue([]);
  mockCrmService.getSettings.mockResolvedValue({});
  mockSettingsApi.sourceTypes.getAll.mockResolvedValue([]);
});

async function renderLoaded() {
  const utils = render(<LeadDetailPage />);
  await waitFor(() => expect(screen.queryAllByText(/acme corp/i).length).toBeGreaterThan(0));
  return utils;
}

describe('Given the data-layer flag is OFF', () => {
  test('When renderers are registered / Then the lead page renders no slot regions, wrapper or injected tabs', async () => {
    dl.regs = [reg({}), reg({ id: 'r2', slot: 'detail.sidebar' }), reg({ id: 'r3', slot: 'detail.tab', label: 'Vehicle' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
    expect(container.querySelector('[data-dl-tab]')).toBeNull();
    expect(screen.queryByTestId('probe-r1')).toBeNull();
  });
  test('When the page loads / Then no record layout is registered', async () => {
    await renderLoaded();
    expect(dl.layouts['crm.lead']).toBeUndefined();
  });
});

describe('Given the data-layer flag is ON', () => {
  beforeEach(() => { dl.flag = true; });

  test('When the page loads / Then the crm.lead record layout is registered with a History tab', async () => {
    await renderLoaded();
    await waitFor(() => expect(dl.layouts['crm.lead']).toBeTruthy());
    expect(dl.layouts['crm.lead'].tabOrder).toContain('history');
  });

  test('When nothing is registered / Then the page renders without any data-layer DOM', async () => {
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
  });

  test('When section, sidebar and actions renderers exist / Then each region carries crm.lead + record context', async () => {
    dl.regs = [reg({ id: 'sec' }), reg({ id: 'side', slot: 'detail.sidebar' }), reg({ id: 'act', slot: 'detail.actions' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-record-layout="crm.lead"]')?.getAttribute('data-record-id')).toBe('lead-1');
    for (const [slot, region, id] of [['detail.section', 'main', 'sec'], ['detail.sidebar', 'sidebar', 'side'], ['detail.actions', 'actions', 'act']]) {
      const el = container.querySelector(`[data-dl-slot="${slot}"]`)!;
      expect(el.getAttribute('data-region')).toBe(region);
      expect(el.getAttribute('data-dl-entity')).toBe('crm.lead');
      expect(el.getAttribute('data-dl-record-id')).toBe('lead-1');
      const probe = screen.getByTestId(`probe-${id}`);
      expect(probe.getAttribute('data-entity')).toBe('crm.lead');
      expect(probe.getAttribute('data-record-id')).toBe('lead-1');
      expect(probe.getAttribute('data-version')).toBe('2026-09-30T10:00:00Z');
      expect(probe.getAttribute('data-save-mode')).toBe('native');
      expect(probe.getAttribute('data-can-edit')).toBe('true');
    }
  });

  test('When a detail.tab renderer exists / Then an injected tab appears and renders it on click', async () => {
    dl.regs = [reg({ id: 'veh', slot: 'detail.tab', label: 'Vehicle' })];
    const { container } = await renderLoaded();
    const btn = container.querySelector('[data-dl-tab="dl:veh"]') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Vehicle');
    expect(screen.queryByTestId('probe-veh')).toBeNull();
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('probe-veh').getAttribute('data-record-id')).toBe('lead-1'));
  });

  test('When a registration is visibility_profile=hidden / Then it is not rendered', async () => {
    dl.regs = [reg({ id: 'shown' }), reg({ id: 'secret', visibility_profile: 'hidden' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-shown')).toBeTruthy();
    expect(screen.queryByTestId('probe-secret')).toBeNull();
  });

  test('When a registration is admin-only and the user is not admin / Then it is not rendered', async () => {
    dl.regs = [reg({ id: 'adm', visibility_profile: 'admin' })];
    const { container } = await renderLoaded();
    expect(screen.queryByTestId('probe-adm')).toBeNull();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
  });

  test('When renderers belong to another entity / Then the lead page ignores them', async () => {
    dl.regs = [reg({ id: 'd', dataset_code: 'crm.deal' })];
    await renderLoaded();
    expect(screen.queryByTestId('probe-d')).toBeNull();
  });
});
