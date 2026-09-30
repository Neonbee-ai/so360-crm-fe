import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Data Layer Class B on Deal Detail (crm.deal).
 * Shell renderers are hosted in named regions behind
 * submodule:data_layer:custom_fields. Values are saved by the module through
 * the native PATCH /deals/:id, merged over the existing custom_fields so the
 * legacy "Additional Info" keys survive.
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
      <span data-testid={`probe-${props.registration.id}-value`}>{String(props.record?.custom_fields?.plate ?? '')}</span>
      <button type="button" onClick={() => props.onSave({ plate: 'KL-07' })}>save-{props.registration.id}</button>
    </div>
  );
}

const mockGetDealById = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetTasksByDealId = vi.fn();
const mockGetActivitiesByDealId = vi.fn();
const mockGetNotesByDealId = vi.fn();
const mockGetDocumentsByDealId = vi.fn();
const mockGetLeadById = vi.fn();
const mockGetInvoiceStatus = vi.fn();
const mockGetFulfillmentOrderByDeal = vi.fn();
const mockDealsApiUpdate = vi.fn().mockResolvedValue({});
const mockTasksApiDelete = vi.fn().mockResolvedValue({});
const mockActivitiesApiUpdate = vi.fn().mockResolvedValue({});
const mockActivitiesApiDelete = vi.fn().mockResolvedValue({});
const mockLogActivity = vi.fn().mockResolvedValue({});
const mockUpdateTask = vi.fn().mockResolvedValue({});
const mockCreateNote = vi.fn().mockResolvedValue({});
const mockUpdateNote = vi.fn().mockResolvedValue({});
const mockDeleteNote = vi.fn().mockResolvedValue({});
const mockUploadDocument = vi.fn().mockResolvedValue({});
const mockDeleteDocument = vi.fn().mockResolvedValue({});
const mockRequestInvoice = vi.fn().mockResolvedValue({});
const mockGetProjects = vi.fn().mockResolvedValue([]);
const mockCreateProjectFromDeal = vi.fn().mockResolvedValue({ id: 'p1' });
const mockLinkProject = vi.fn().mockResolvedValue({});
const mockUnlinkProject = vi.fn().mockResolvedValue({});
const mockDeleteDeal = vi.fn().mockResolvedValue({});
const mockUpdateDealStage = vi.fn().mockResolvedValue({});

vi.mock('../services/crmService', () => ({
  crmService: {
    getDealById: (...a: any[]) => mockGetDealById(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getTasksByDealId: (...a: any[]) => mockGetTasksByDealId(...a),
    getActivitiesByDealId: (...a: any[]) => mockGetActivitiesByDealId(...a),
    getNotesByDealId: (...a: any[]) => mockGetNotesByDealId(...a),
    getDocumentsByDealId: (...a: any[]) => mockGetDocumentsByDealId(...a),
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
    getInvoiceStatus: (...a: any[]) => mockGetInvoiceStatus(...a),
    getFulfillmentOrderByDeal: (...a: any[]) => mockGetFulfillmentOrderByDeal(...a),
    updateDealStage: (...a: any[]) => mockUpdateDealStage(...a),
    logActivity: (...a: any[]) => mockLogActivity(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    createNote: (...a: any[]) => mockCreateNote(...a),
    updateNote: (...a: any[]) => mockUpdateNote(...a),
    deleteNote: (...a: any[]) => mockDeleteNote(...a),
    uploadDocument: (...a: any[]) => mockUploadDocument(...a),
    deleteDocument: (...a: any[]) => mockDeleteDocument(...a),
    requestInvoice: (...a: any[]) => mockRequestInvoice(...a),
    getProjects: (...a: any[]) => mockGetProjects(...a),
    createProjectFromDeal: (...a: any[]) => mockCreateProjectFromDeal(...a),
    linkProject: (...a: any[]) => mockLinkProject(...a),
    unlinkProject: (...a: any[]) => mockUnlinkProject(...a),
    deleteDeal: (...a: any[]) => mockDeleteDeal(...a),
  },
  dealsApi: { update: (...a: any[]) => mockDealsApiUpdate(...a) },
  tasksApi: { delete: (...a: any[]) => mockTasksApiDelete(...a) },
  activitiesApi: { update: (...a: any[]) => mockActivitiesApiUpdate(...a), delete: (...a: any[]) => mockActivitiesApiDelete(...a) },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'deal-1' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());
vi.mock('@so360/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@so360/design-system')>();
  return {
    ...actual,
    toast: { ...actual.toast, success: mockShowSuccess, error: mockShowError },
  };
});

// G8 Client 360: the drawer is exercised in its own spec — here we only assert the deal page wires it up.
vi.mock('./components/ActivityHistoryDrawer', () => ({
  default: ({ isOpen, onClose, entityType, entityId }: any) => (isOpen ? (
    <div data-testid="activity-history-drawer" data-entity-type={entityType} data-entity-id={entityId}>
      <button onClick={onClose}>Close history</button>
    </div>
  ) : null),
}));

vi.mock('./components/TaskModal', () => ({ default: ({ onClose }: any) => <div data-testid="task-modal"><button onClick={onClose}>Close</button></div> }));

const shellCtl = vi.hoisted(() => ({ signEnabled: false, canEditDeal: true }));
vi.mock('@so360/shell-context', () => ({
  useShell: () => ({
    isModuleEnabled: (m: string) => m === 'sign' && shellCtl.signEnabled,
    permissionsLoaded: true,
    hasPermission: (perm: string) => (perm === 'deals.update' ? shellCtl.canEditDeal : true),
    hasAnyPermission: () => true,
  }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({
    effectiveFlagsLoaded: true, isAdmin: false, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
    isFeatureEnabled: (k: string) => (k === 'submodule:data_layer:custom_fields' ? dl.flag : true),
  }),
  // Shell dataLayer API (shell-context) — registry is driven by `dl`.
  useDatasetSchema: () => ({ fields: [] }),
  useSlotRenderers: (code: string, slot: string) =>
    dl.regs
      .filter((r: any) => r.dataset_code === code && r.slot === slot)
      .map((r: any) => ({ registration: r, Renderer: ProbeRenderer, key: r.id })),
  registerRecordLayout: (def: any) => { dl.layouts[def.entity] = def; return () => {}; },
  getRecordLayout: (entity: string) => dl.layouts[entity] ?? null,
}));

vi.mock('../config/features', () => ({
  FEATURES: { DEAL_ESTIMATE_REQUEST: true, DEAL_INVOICE_REQUEST: true, DEAL_PROJECT_CREATION: true },
}));

vi.mock('../components/DealLifecycleStepper', () => ({
  DealLifecycleStepper: ({ currentState }: any) => <div data-testid="lifecycle-stepper">{currentState}</div>,
}));

// formatters mock uses real Intl so date assertions like 'Jan 20, 2025' work correctly
vi.mock('../utils/formatters', () => ({
  useCRMFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatDate: (d: string) => {
      if (!d) return d;
      try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
      catch { return d; }
    },
    formatDateTime: (d: string) => {
      if (!d) return d;
      try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
      catch { return d; }
    },
    formatPhone: (p: string) => p,
    formatNumber: (n: number) => String(n),
    formatPercent: (n: number) => `${n}%`,
  }),
  useCRMCurrencySymbol: () => '$',
}));

import DealDetailPage from './DealDetailPage';

const owner = { id: 'u1', full_name: 'Test Owner', email: 'owner@test.com', avatar_url: null };
const makeDeal = (overrides: any = {}) => ({
  id: 'deal-1',
  name: 'Big Deal',
  company_name: 'Acme Corp',
  value: 50000,
  stage: 'Qualified',
  stage_id: 'qualified',
  current_flow_state: 'qualified',
  status: 'active',
  owner,
  owner_id: 'u1',
  lead_id: null,
  project_id: null,
  invoice_id: null,
  notes: [],
  activities: [],
  documents: [],
  custom_fields: { Priority: 'High' },
  updated_at: '2026-09-30T09:00:00Z',
  created_at: '2025-01-01T10:00:00Z',
  ...overrides,
});
const settings = {
  deal_stages: [{ id: 'new', name: 'New' }, { id: 'qualified', name: 'Qualified' }],
  lead_stages: [], lead_custom_fields: [], deal_custom_fields: [], lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
};
const reg = (over: any) => ({ id: 'r1', dataset_code: 'crm.deal', slot: 'detail.section', renderer: 'custom_fields', ...over });

beforeEach(() => {
  vi.clearAllMocks();
  dl.flag = false;
  dl.regs = [];
  dl.layouts = {};
  shellCtl.signEnabled = false;
  shellCtl.canEditDeal = true;
  mockGetDealById.mockResolvedValue(makeDeal());
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue([owner]);
  mockGetTasksByDealId.mockResolvedValue([]);
  mockGetActivitiesByDealId.mockResolvedValue([]);
  mockGetNotesByDealId.mockResolvedValue([]);
  mockGetDocumentsByDealId.mockResolvedValue([]);
  mockGetInvoiceStatus.mockRejectedValue(new Error('no invoice'));
  mockGetFulfillmentOrderByDeal.mockRejectedValue(new Error('none'));
});

async function renderLoaded() {
  const utils = render(<DealDetailPage />);
  await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
  return utils;
}

describe('Given the data-layer flag is OFF', () => {
  it('When renderers are registered / Then the deal page renders no slot regions, wrapper or injected tabs', async () => {
    dl.regs = [reg({}), reg({ id: 'r2', slot: 'detail.sidebar' }), reg({ id: 'r3', slot: 'detail.tab', label: 'Vehicle' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
    expect(container.querySelector('[data-dl-tab]')).toBeNull();
    expect(dl.layouts['crm.deal']).toBeUndefined();
  });
});

describe('Given the data-layer flag is ON', () => {
  beforeEach(() => { dl.flag = true; });

  it('When the page loads / Then the crm.deal record layout is registered with a History tab', async () => {
    await renderLoaded();
    await waitFor(() => expect(dl.layouts['crm.deal']).toBeTruthy());
    expect(dl.layouts['crm.deal'].tabOrder).toContain('history');
  });

  it('When nothing is registered / Then the page renders without any data-layer DOM', async () => {
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-dl-slot]')).toBeNull();
    expect(container.querySelector('[data-record-layout]')).toBeNull();
  });

  it('When section, sidebar and actions renderers exist / Then each region carries crm.deal + record context', async () => {
    dl.regs = [reg({ id: 'sec' }), reg({ id: 'side', slot: 'detail.sidebar' }), reg({ id: 'act', slot: 'detail.actions' })];
    const { container } = await renderLoaded();
    expect(container.querySelector('[data-record-layout="crm.deal"]')?.getAttribute('data-record-id')).toBe('deal-1');
    for (const [slot, region, id] of [['detail.section', 'main', 'sec'], ['detail.sidebar', 'sidebar', 'side'], ['detail.actions', 'actions', 'act']]) {
      const el = container.querySelector(`[data-dl-slot="${slot}"]`)!;
      expect(el.getAttribute('data-region')).toBe(region);
      expect(el.getAttribute('data-dl-entity')).toBe('crm.deal');
      expect(el.getAttribute('data-dl-record-id')).toBe('deal-1');
      const probe = screen.getByTestId(`probe-${id}`);
      expect(probe.getAttribute('data-entity')).toBe('crm.deal');
      expect(probe.getAttribute('data-record-id')).toBe('deal-1');
      expect(probe.getAttribute('data-version')).toBe('2026-09-30T09:00:00Z');
      expect(probe.getAttribute('data-save-mode')).toBe('native');
    }
  });

  it('When the user lacks deals.update / Then renderers receive canEdit=false', async () => {
    shellCtl.canEditDeal = false;
    dl.regs = [reg({ id: 'sec' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-sec').getAttribute('data-can-edit')).toBe('false');
  });

  it('When a detail.tab renderer exists / Then an injected tab appears and renders it on click', async () => {
    dl.regs = [reg({ id: 'veh', slot: 'detail.tab', label: 'Vehicle' })];
    const { container } = await renderLoaded();
    const btn = container.querySelector('[data-dl-tab="dl:veh"]') as HTMLElement;
    expect(btn.textContent).toContain('Vehicle');
    expect(screen.queryByTestId('probe-veh')).toBeNull();
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('probe-veh').getAttribute('data-record-id')).toBe('deal-1'));
  });

  it('When a registration is visibility_profile=hidden / Then it is not rendered', async () => {
    dl.regs = [reg({ id: 'shown' }), reg({ id: 'secret', visibility_profile: 'hidden' })];
    await renderLoaded();
    expect(screen.getByTestId('probe-shown')).toBeTruthy();
    expect(screen.queryByTestId('probe-secret')).toBeNull();
  });

  it('When a renderer saves / Then the module PATCHes /deals/:id with only the changed custom_fields and the page reflects it', async () => {
    mockDealsApiUpdate.mockResolvedValueOnce({ id: 'deal-1', custom_fields: { Priority: 'High', plate: 'KL-07' } });
    dl.regs = [reg({ id: 'sec' })];
    await renderLoaded();
    fireEvent.click(screen.getByText('save-sec'));
    await waitFor(() => expect(mockDealsApiUpdate).toHaveBeenCalledWith('deal-1', { custom_fields: { plate: 'KL-07' } }));
    await waitFor(() => expect(screen.getByTestId('probe-sec-value').textContent).toBe('KL-07'));
  });
});
