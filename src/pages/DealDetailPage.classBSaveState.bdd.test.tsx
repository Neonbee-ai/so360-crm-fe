import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Edge cases for the Class B onSaved state merge on this page.
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

// Capture the page's Class B onSaved callback and the record it hands the
// data layer on every render, while keeping the real hook behaviour.
const cap = vi.hoisted(() => ({ onSaved: null as any, record: undefined as any }));
vi.mock('../dataLayer/useCrmRecordContext', async (orig) => {
  const real = await orig<typeof import('../dataLayer/useCrmRecordContext')>();
  return {
    ...real,
    useCrmRecordContext: (...a: any[]) => {
      cap.record = a[2];
      cap.onSaved = a[3]?.onSaved;
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


describe('Feature: Deal detail Class B save merges into page state', () => {
  beforeEach(() => { dl.flag = true; cap.onSaved = null; cap.record = undefined; });

  describe('Scenario: a save completes before the deal has loaded', () => {
    it('then the state stays empty and the page keeps showing its loading state', async () => {
      // Given the deal fetch never resolves (record state is still null)
      mockGetDealById.mockReturnValue(new Promise(() => {}));
      const { container } = render(<DealDetailPage />);
      await waitFor(() => expect(typeof cap.onSaved).toBe('function'));
      expect(cap.record == null).toBe(true);
      // When the Class B onSaved callback fires anyway
      await __act(async () => { cap.onSaved({ plate: 'KL-07' }, { version: 4 }); });
      // Then no record is conjured out of the partial values
      expect(cap.record == null).toBe(true);
      expect(container.querySelector('[data-record-layout]')).toBeNull();
    });
  });

  describe('Scenario: a save completes on a loaded record that has no custom_fields yet', () => {
    it('then custom_fields is created from the saved values and the refresh fields are merged', async () => {
      // Given a loaded deal whose custom_fields is missing
      mockGetDealById.mockResolvedValue(makeDeal({ custom_fields: undefined }));
      await renderLoaded();
      await waitFor(() => expect(cap.record?.id).toBeTruthy());
      expect(cap.record.custom_fields == null).toBe(true);
      // When the renderer save reports the new values and a refreshed row version
      await __act(async () => { cap.onSaved({ plate: 'KL-07' }, { version: 9 }); });
      // Then custom_fields holds only the saved values and the version is refreshed
      await waitFor(() => expect(cap.record.custom_fields).toEqual({ plate: 'KL-07' }));
      expect(cap.record.version).toBe(9);
    });
  });
});
