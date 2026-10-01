import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LeadDetailPage from './LeadDetailPage';

/**
 * Edge cases for the Class B onSaved state merge on this page.
 * Data Layer Class B on Lead Detail (crm.lead).
 * The page hosts Shell-registered renderers in named regions (actions, main,
 * sidebar, tabs) behind submodule:data_layer:custom_fields. With the flag off,
 * or with nothing registered, the page must render exactly as before.
 */

const dl = vi.hoisted(() => ({
  flag: false,
  regs: [] as any[],
  layouts: {} as Record<string, any>,
  noHasPermission: false,
}));

// Capture the page's Class B onSaved callback and the record it hands the
// data layer on every render, while keeping the real hook behaviour.
const cap = vi.hoisted(() => ({ onSaved: null as any, record: undefined as any, canEdit: undefined as any }));
vi.mock('../dataLayer/useCrmRecordContext', async (orig) => {
  const real = await orig<typeof import('../dataLayer/useCrmRecordContext')>();
  return {
    ...real,
    useCrmRecordContext: (...a: any[]) => {
      cap.record = a[2];
      cap.onSaved = a[3]?.onSaved;
      cap.canEdit = a[3]?.canEdit;
      return (real.useCrmRecordContext as any)(...a);
    },
  };
});
import { act as __act } from '@testing-library/react';

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
    permissionsLoaded: true, hasAnyPermission: () => true,
    ...(dl.noHasPermission ? {} : { hasPermission: () => true }),
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
  dl.noHasPermission = false;
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


describe('Feature: Lead detail Class B save merges into page state', () => {
  beforeEach(() => { dl.flag = true; cap.onSaved = null; cap.record = undefined; });

  describe('Scenario: a save completes before the lead has loaded', () => {
    it('then the state stays empty and the page keeps showing its loading state', async () => {
      // Given the lead fetch never resolves (record state is still null)
      mockCrmService.getLeadById.mockReturnValue(new Promise(() => {}));
      const { container } = render(<LeadDetailPage />);
      await waitFor(() => expect(typeof cap.onSaved).toBe('function'));
      expect(cap.record == null).toBe(true);
      // When the Class B onSaved callback fires anyway
      await __act(async () => { cap.onSaved({ plate: 'KL-07' }, { version: 4 }); });
      // Then no record is conjured out of the partial values
      expect(cap.record == null).toBe(true);
      expect(container.querySelector('[data-record-layout]')).toBeNull();
    });
  });

  describe('Scenario: a save completes on a loaded lead', () => {
    it('then class_b_custom_fields is replaced by the saved values and the refresh fields are merged', async () => {
      // Given a loaded lead with existing Class B values
      await renderLoaded();
      await waitFor(() => expect(cap.record?.id).toBe('lead-1'));
      expect(cap.record.class_b_custom_fields).toEqual({ plate: 'KL-01' });
      // When the renderer save reports the full new value set and a refreshed row version
      await __act(async () => { cap.onSaved({ plate: 'KL-07', vin: 'V1' }, { version: 5, updated_at: '2026-09-30T11:00:00Z' }); });
      // Then the page state carries exactly the saved values plus the refresh
      await waitFor(() => expect(cap.record.class_b_custom_fields).toEqual({ plate: 'KL-07', vin: 'V1' }));
      expect(cap.record.version).toBe(5);
      expect(cap.record.updated_at).toBe('2026-09-30T11:00:00Z');
      expect(cap.record.first_name).toBe('Alice');
    });
  });
});

describe('Feature: Lead detail Class B edit permission', () => {
  beforeEach(() => { dl.flag = true; cap.canEdit = undefined; });

  describe('Scenario: permissions are loaded but the Shell exposes no hasPermission', () => {
    it('then the Class B renderers are read-only', async () => {
      // Given an older Shell bridge without hasPermission
      dl.noHasPermission = true;
      // When the lead page loads
      await renderLoaded();
      // Then the record context is not editable
      await waitFor(() => expect(cap.canEdit).toBe(false));
    });
  });

  describe('Scenario: permissions are loaded and leads.update is granted', () => {
    it('then the Class B renderers are editable', async () => {
      await renderLoaded();
      await waitFor(() => expect(cap.canEdit).toBe(true));
    });
  });
});
