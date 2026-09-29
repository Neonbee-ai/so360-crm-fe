import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

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

// The panels are covered by their own specs — here we only assert the page gates and mounts them.
vi.mock('./components/DealPaymentPlanPanel', () => ({
  default: ({ dealId }: any) => <div data-testid="payment-plan-panel" data-deal-id={dealId} />,
}));
vi.mock('./components/DealCommissionPanel', () => ({
  default: ({ dealId }: any) => <div data-testid="commission-panel" data-deal-id={dealId} />,
}));

vi.mock('./components/TaskModal', () => ({ default: ({ onClose }: any) => <div data-testid="task-modal"><button onClick={onClose}>Close</button></div> }));

const shellCtl = vi.hoisted(() => ({ signEnabled: false, canEditDeal: true, flags: new Set<string>(), flagsLoaded: true }));
vi.mock('@so360/shell-context', () => ({
  useShell: () => ({
    isModuleEnabled: (m: string) => m === 'sign' && shellCtl.signEnabled,
    permissionsLoaded: true,
    hasPermission: (perm: string) => (perm === 'deals.update' ? shellCtl.canEditDeal : true),
    hasAnyPermission: () => true,
  }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: shellCtl.flagsLoaded, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: (k: string) => shellCtl.flags.has(k) }),
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
const owner2 = { id: 'u2', full_name: 'Alice Sales', email: 'alice@test.com', avatar_url: 'https://img/a.jpg' };

const makeDeal = (overrides: any = {}) => ({
  id: 'deal-1',
  name: 'Big Deal',
  company_name: 'Acme Corp',
  value: 50000,
  expected_close_date: '2025-06-30',
  stage: 'Qualified',
  stage_id: 'qualified',
  current_flow_state: 'qualified',
  status: 'active',
  owner,
  owner_id: 'u1',
  lead_id: 'lead-1',
  project_id: null,
  invoice_id: null,
  invoice_number: null,
  notes: [
    { id: 'n1', content: 'Initial contact made', author: owner, created_at: '2025-01-10T10:00:00Z' },
  ],
  activities: [],
  documents: [
    { id: 'doc1', name: 'proposal.pdf', size: 2048000, type: 'document', url: '/files/proposal.pdf', created_at: '2025-01-15T10:00:00Z', uploaded_at: '2025-01-15T10:00:00Z', uploaded_by: owner },
  ],
  custom_fields: {},
  created_at: '2025-01-01T10:00:00Z',
  last_activity_at: '2025-01-20T10:00:00Z',
  ...overrides,
});

const associatedLead = {
  id: 'lead-1',
  contact_name: 'John Contact',
  company_name: 'Acme Corp',
  contact_email: 'john@acme.com',
  phone: '555-0000',
};

const tasks = [
  { id: 't1', title: 'Follow up call', status: 'OPEN', type: 'CALL', due_date: '2025-02-01', created_at: '2025-01-20T10:00:00Z', assigned_to: owner },
  { id: 't2', title: 'Send proposal', status: 'DONE', type: 'TODO', due_date: '2025-01-15', created_at: '2025-01-10T10:00:00Z', assigned_to: owner },
];

const activities = [
  { id: 'a1', type: 'CALL', notes: 'Discussed requirements', date: '2025-01-18T10:00:00Z', created_at: '2025-01-18T10:00:00Z', author: owner },
  { id: 'a2', type: 'MEETING', notes: 'Onsite demo', date: '2025-01-20T14:00:00Z', created_at: '2025-01-20T14:00:00Z', author: owner },
  { id: 'a3', type: 'EMAIL', notes: 'Sent follow up email', date: '2025-01-22T10:00:00Z', created_at: '2025-01-22T10:00:00Z', author: owner },
  { id: 'a4', type: 'STATUS_CHANGE', notes: 'Deal moved to Qualified', date: '2025-01-23T10:00:00Z', created_at: '2025-01-23T10:00:00Z', author: owner },
  { id: 'a5', type: 'STAGE_CHANGE', notes: 'Stage changed', date: '2025-01-24T10:00:00Z', created_at: '2025-01-24T10:00:00Z', author: owner },
];

const settings = {
  deal_stages: [{ id: 'new', name: 'New' }, { id: 'qualified', name: 'Qualified' }, { id: 'won', name: 'Won' }],
  lead_stages: [],
  lead_custom_fields: [],
  deal_custom_fields: [{ id: 'cf1', label: 'Priority', type: 'text' }],
  lead_sources: [],
  lead_scoring: [],
  default_owner_id: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  shellCtl.signEnabled = false;
  shellCtl.canEditDeal = true;
  shellCtl.flags = new Set<string>();
  shellCtl.flagsLoaded = true;
  mockGetDealById.mockResolvedValue(makeDeal());
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue([owner, owner2]);
  mockGetTasksByDealId.mockResolvedValue(tasks);
  mockGetActivitiesByDealId.mockResolvedValue(activities);
  mockGetNotesByDealId.mockResolvedValue(makeDeal().notes);
  mockGetDocumentsByDealId.mockResolvedValue(makeDeal().documents);
  mockGetLeadById.mockResolvedValue(associatedLead);
  mockGetInvoiceStatus.mockRejectedValue(new Error('no invoice'));
  mockGetFulfillmentOrderByDeal.mockRejectedValue(new Error('none'));
});

const PP = 'submodule:crm:payment_plans';
const CM = 'submodule:crm:commissions';

const tabLabels = () =>
  within(screen.getByTestId('deal-detail-tab-strip')).getAllByRole('button').map((b) => b.textContent || '');

const renderLoaded = async () => {
  render(<DealDetailPage />);
  await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
};

describe('Feature: RE Phase C deal tabs (payment plan + commission)', () => {
  describe('Given both flags are off', () => {
    it('When the deal page renders / Then neither the Payment plan nor the Commission tab is offered', async () => {
      await renderLoaded();
      const labels = tabLabels();
      expect(labels.some((l) => l.includes('Payment plan'))).toBe(false);
      expect(labels.some((l) => l.includes('Commission'))).toBe(false);
      expect(screen.queryByTestId('payment-plan-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('commission-panel')).not.toBeInTheDocument();
    });
  });

  describe('Given the flags are on but effective flags have not loaded yet', () => {
    it('When the deal page renders / Then the tabs stay hidden (never fail-open)', async () => {
      shellCtl.flags = new Set([PP, CM]);
      shellCtl.flagsLoaded = false;
      await renderLoaded();
      const labels = tabLabels();
      expect(labels.some((l) => l.includes('Payment plan'))).toBe(false);
      expect(labels.some((l) => l.includes('Commission'))).toBe(false);
    });
  });

  describe('Given only the payment plans flag is on', () => {
    it('When the user opens the Payment plan tab / Then the panel mounts for this deal and Commission is not offered', async () => {
      shellCtl.flags = new Set([PP]);
      const user = userEvent.setup();
      await renderLoaded();
      expect(tabLabels().some((l) => l.includes('Commission'))).toBe(false);
      expect(screen.queryByTestId('payment-plan-panel')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Payment plan/ }));
      expect(screen.getByTestId('payment-plan-panel')).toHaveAttribute('data-deal-id', 'deal-1');
      expect(screen.queryByTestId('commission-panel')).not.toBeInTheDocument();
    });
  });

  describe('Given only the commissions flag is on', () => {
    it('When the user opens the Commission tab / Then the panel mounts for this deal and Payment plan is not offered', async () => {
      shellCtl.flags = new Set([CM]);
      const user = userEvent.setup();
      await renderLoaded();
      expect(tabLabels().some((l) => l.includes('Payment plan'))).toBe(false);
      await user.click(screen.getByRole('button', { name: /^\s*Commission$/ }));
      expect(screen.getByTestId('commission-panel')).toHaveAttribute('data-deal-id', 'deal-1');
      expect(screen.queryByTestId('payment-plan-panel')).not.toBeInTheDocument();
    });
  });

  describe('Given both flags are on', () => {
    it('When the user switches between the two tabs / Then only the active panel is mounted', async () => {
      shellCtl.flags = new Set([PP, CM]);
      const user = userEvent.setup();
      await renderLoaded();
      const labels = tabLabels();
      expect(labels.some((l) => l.includes('Payment plan'))).toBe(true);
      expect(labels.some((l) => l.includes('Commission'))).toBe(true);

      await user.click(screen.getByRole('button', { name: /Payment plan/ }));
      expect(screen.getByTestId('payment-plan-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('commission-panel')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^\s*Commission$/ }));
      expect(screen.getByTestId('commission-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('payment-plan-panel')).not.toBeInTheDocument();
    });
  });
});
