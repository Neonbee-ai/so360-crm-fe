import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';
import userEvent from '@testing-library/user-event';

const mockGetLeadById = vi.fn();
const mockGetDealsByLeadId = vi.fn();
const mockGetTasksByLeadId = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetActivitiesByLeadId = vi.fn();
const mockGetActivitiesByLeadIdPaginated = vi.fn();
const mockGetDocumentsByLeadId = vi.fn();
const mockUpdateLead = vi.fn().mockResolvedValue({});
const mockLogActivity = vi.fn().mockResolvedValue({});
const mockGetPartners = vi.fn();
const mockUpdateTask = vi.fn().mockResolvedValue({});
const mockCreateNote = vi.fn().mockResolvedValue({ id: 'nn1', content: 'new note', author: { id: 'u1', full_name: 'Test Owner' }, created_at: new Date().toISOString() });
const mockUpdateNote = vi.fn().mockResolvedValue({});
const mockDeleteNote = vi.fn().mockResolvedValue({});
const mockUploadDocument = vi.fn().mockResolvedValue({ id: 'doc-new', name: 'test.pdf', size: 1024, uploaded_at: new Date().toISOString(), uploaded_by: { full_name: 'Test' } });
const mockDeleteDocument = vi.fn().mockResolvedValue({});
const mockDeleteLead = vi.fn().mockResolvedValue({});
const mockActivitiesUpdate = vi.fn().mockResolvedValue({});
const mockActivitiesDelete = vi.fn().mockResolvedValue({});
const mockSetCurrentEntity = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
    getDealsByLeadId: (...a: any[]) => mockGetDealsByLeadId(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasksByLeadId(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getActivitiesByLeadId: (...a: any[]) => mockGetActivitiesByLeadId(...a),
    getActivitiesByLeadIdPaginated: (...a: any[]) => mockGetActivitiesByLeadIdPaginated(...a),
    updateLead: (...a: any[]) => mockUpdateLead(...a),
    logActivity: (...a: any[]) => mockLogActivity(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    createNote: (...a: any[]) => mockCreateNote(...a),
    updateNote: (...a: any[]) => mockUpdateNote(...a),
    deleteNote: (...a: any[]) => mockDeleteNote(...a),
    uploadDocument: (...a: any[]) => mockUploadDocument(...a),
    deleteDocument: (...a: any[]) => mockDeleteDocument(...a),
    deleteLead: (...a: any[]) => mockDeleteLead(...a),
    getPartners: (...a: any[]) => mockGetPartners(...a),
    getDocumentsByLeadId: (...a: any[]) => mockGetDocumentsByLeadId(...a),
    gridColumns: {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue({}),
      reset: vi.fn().mockResolvedValue({}),
    },
  },
  activitiesApi: { update: (...a: any[]) => mockActivitiesUpdate(...a), delete: (...a: any[]) => mockActivitiesDelete(...a) },
  settingsApi: {
    sourceTypes: { getAll: vi.fn().mockResolvedValue([]) },
    partnerTypes: { getAll: vi.fn().mockResolvedValue([]) },
  },
  // Tasks 3/4/6/7 API surfaces — the components that call these directly
  // (StakeholdersTab, EmailsTab, MeetingsTab, AuditHistoryTab) are mocked
  // away below; the inline Activity tab's useEntityTimeline is mocked
  // separately so these stay unused stubs, just present so nothing is
  // `undefined` if anything imports them transitively.
  timelineApi: { getTimeline: vi.fn().mockResolvedValue({ data: [], nextCursor: null, summary: null }) },
  auditTrailApi: { getAuditTrail: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, limit: 50, offset: 0 } }), exportAuditTrail: vi.fn() },
  stakeholderApi: {
    listByLead: vi.fn().mockResolvedValue([]),
    getHierarchy: vi.fn().mockResolvedValue([]),
    create: vi.fn(), getById: vi.fn(), update: vi.fn(), delete: vi.fn(),
    assignRoles: vi.fn(), setHierarchy: vi.fn(), linkDeal: vi.fn(), unlinkDeal: vi.fn(),
    getActivitySummary: vi.fn(), search: vi.fn().mockResolvedValue([]),
  },
  meetingsApi: {
    getByLead: vi.fn().mockResolvedValue([]), getByDeal: vi.fn().mockResolvedValue([]),
    create: vi.fn(), update: vi.fn(), cancel: vi.fn(), complete: vi.fn(), remove: vi.fn(),
  },
  inboxIntegrationApi: {
    getConversationsForLead: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getMessages: vi.fn().mockResolvedValue([]),
  },
}));

// Task 4: the inline Activity tab now reads from useEntityTimeline() instead
// of client-side aggregation — mock the hook directly (same pattern as
// useShellBridge below) so each test controls exactly what it returns.
const mockUseEntityTimeline = vi.fn();
vi.mock('./components/timeline/useEntityTimeline', () => ({
  useEntityTimeline: (...args: any[]) => mockUseEntityTimeline(...args),
}));

// Tasks 3/6/7 — new Lead Detail tabs are stubbed out; their own behavior is
// covered by their dedicated component tests, not this page-integration suite.
vi.mock('./components/AuditHistoryTab', () => ({ default: () => <div data-testid="audit-history-tab" /> }));
vi.mock('../components/stakeholders/StakeholdersTab', () => ({ default: () => <div data-testid="stakeholders-tab" /> }));
vi.mock('./components/EmailsTab', () => ({ default: () => <div data-testid="emails-tab" /> }));
vi.mock('./components/MeetingsTab', () => ({ default: () => <div data-testid="meetings-tab" /> }));
// Kept as a thin stand-in, but it must still surface the real handlers: the
// value under test is what LeadDetailPage does when a quick action fires.
vi.mock('./components/QuickActionBar', () => ({
  default: (props: any) => (
    <div data-testid="quick-action-bar">
      <button onClick={props.onAddNote}>Add Note</button>
      <button onClick={props.onSendEmail}>Send Email</button>
      <button onClick={props.onLogCall}>Log Call</button>
      <button onClick={props.onScheduleMeeting}>Schedule Meeting</button>
      <button onClick={props.onCreateTask}>Create Task</button>
      <button onClick={props.onUploadDocument}>Add Document</button>
    </div>
  ),
}));
vi.mock('./components/LeadLayoutSettingsPanel', () => ({ default: () => null }));

const mockNavigate = vi.fn();
let mockPathname = '/crm/leads/lead-1';
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'lead-1' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname, search: '' }),
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@so360/shell-context', () => ({
  // DlCustomFieldsPanel (custom fields tab) reads dataset fields.
  useDatasetSchema: () => ({ fields: [], isLoading: false, error: null }),
  useShell: () => ({ isModuleEnabled: () => false }),
  useCurrentEntity: () => ({ setCurrentEntity: mockSetCurrentEntity }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());
vi.mock('@so360/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@so360/design-system')>();
  return {
    ...actual,
    toast: { ...actual.toast, success: mockShowSuccess, error: mockShowError },
  };
});

vi.mock('./components/ActivityHistoryDrawer', () => ({
  default: ({ isOpen, onClose }: any) => isOpen
    ? <div data-testid="activity-history-drawer"><button onClick={onClose}>Close Drawer</button></div>
    : null,
}));
vi.mock('./components/CreateDealModal', () => ({
  default: ({ onClose, isOpen }: any) => isOpen !== false ? <div data-testid="create-deal-modal"><button onClick={onClose}>Close</button></div> : null,
}));
vi.mock('./components/TaskModal', () => ({ default: ({ onClose }: any) => <div data-testid="task-modal"><button onClick={onClose}>Close</button></div> }));
vi.mock('../components/CustomerDetailsPanel', () => ({ default: () => null }));
vi.mock('../components/LeadJourneyStepper', () => ({
  LeadJourneyStepper: ({ currentState }: any) => <div data-testid="journey-stepper">{currentState}</div>,
}));
// Real Tiptap rendering is covered in NoteEditor.bdd.test.tsx — here we only
// need to verify LeadDetailPage wires value/onChange/create/edit/delete correctly.
vi.mock('../components/notes/NoteEditor', () => ({
  default: ({ value, onChange, placeholder, autoFocus }: any) => (
    <textarea
      data-testid="note-editor-mock"
      placeholder={placeholder}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock('../components/notes/NoteContent', () => ({
  default: ({ html }: any) => <div data-testid="note-content">{html}</div>,
}));

// formatters mock uses real Intl so date assertions like 'Jan 1, 2025' work correctly
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

import LeadDetailPage from './LeadDetailPage';

const owner = { id: 'u1', full_name: 'Test Owner', email: 'owner@test.com', avatar_url: null };

const makeLead = (overrides: any = {}) => ({
  id: 'lead-1',
  company_name: 'Acme Corp',
  contact_name: 'John Doe',
  contact_email: 'john@acme.com',
  phone: '555-1234',
  source: 'Website',
  status: 'New',
  current_flow_state: 'new',
  owner,
  created_at: '2025-01-01T10:00:00Z',
  activities: [
    { id: 'a1', type: 'CALL', notes: 'Intro call completed', date: '2025-01-05T10:00:00Z', created_at: '2025-01-05T10:00:00Z', author: owner },
    { id: 'a2', type: 'EMAIL', notes: 'Sent welcome email', date: '2025-01-06T10:00:00Z', created_at: '2025-01-06T10:00:00Z', author: owner },
    { id: 'a3', type: 'MEETING', notes: 'Demo meeting', date: '2025-01-07T10:00:00Z', created_at: '2025-01-07T10:00:00Z', author: owner },
    { id: 'a4', type: 'STATUS_CHANGE', notes: 'Status changed to Qualified', date: '2025-01-08T10:00:00Z', created_at: '2025-01-08T10:00:00Z', author: owner },
    { id: 'a5', type: 'OWNER_CHANGE', notes: 'Owner changed', date: '2025-01-09T10:00:00Z', created_at: '2025-01-09T10:00:00Z', author: owner },
    { id: 'a6', type: 'PROFILE_UPDATE', notes: 'Profile updated', date: '2025-01-10T10:00:00Z', created_at: '2025-01-10T10:00:00Z', author: owner },
  ],
  notes: [
    { id: 'n1', content: 'Hot lead from conference', author: owner, created_at: '2025-01-02T10:00:00Z' },
    { id: 'n2', content: 'Needs follow up', author: owner, created_at: '2025-01-03T10:00:00Z' },
  ],
  documents: [
    { id: 'doc1', name: 'requirements.pdf', size: 5242880, url: 'https://cdn.example.com/requirements.pdf', uploaded_at: '2025-01-04T10:00:00Z', created_at: '2025-01-04T10:00:00Z', uploaded_by: owner },
  ],
  custom_fields: { cf1: 'High' },
  ...overrides,
});

const associatedDeals = [
  { id: 'd1', name: 'Acme Deal', value: 30000, stage: 'Won', created_at: '2025-01-10T10:00:00Z', expected_close_date: '2025-03-01', owner },
  { id: 'd2', name: 'Beta Deal', value: 20000, stage: 'Qualified', created_at: '2025-02-01T10:00:00Z', expected_close_date: '2025-04-01', owner },
];

const associatedTasks = [
  { id: 't1', title: 'Call back', type: 'CALL', status: 'OPEN', due_date: '2025-02-01', created_at: '2025-01-20T10:00:00Z', assigned_to: owner, description: 'Follow up call' },
  { id: 't2', title: 'Send docs', type: 'TODO', status: 'DONE', due_date: '2025-01-15', created_at: '2025-01-10T10:00:00Z', assigned_to: owner, deal_name: 'Acme Deal' },
];

const settings = {
  deal_stages: [],
  lead_stages: [{ id: 'new', name: 'New' }, { id: 'qualified', name: 'Qualified' }, { id: 'converted', name: 'Converted' }],
  lead_custom_fields: [{ id: 'cf1', label: 'Priority Level', type: 'text' }],
  deal_custom_fields: [],
  lead_sources: [],
  lead_scoring: [
    { id: 'r1', name: 'Referral Source', rule_type: 'source', target_field: 'referral', condition: 'equals', value: 'referral', score_points: 20, is_active: true, priority: 0 },
  ],
  score_categories: [
    { id: 'cat-1', label: 'Cold',      min_score: 0,   max_score: 30,  color: '#6b7280', sort_order: 1 },
    { id: 'cat-2', label: 'Warm',      min_score: 31,  max_score: 60,  color: '#f59e0b', sort_order: 2 },
    { id: 'cat-3', label: 'Hot',       min_score: 61,  max_score: 100, color: '#f97316', sort_order: 3 },
    { id: 'cat-4', label: 'Qualified', min_score: 101, max_score: null, color: '#22c55e', sort_order: 4 },
  ],
  default_owner_id: 'u1',
};

const mockPartners = [
  { id: 'p1', company_name: 'Acme Partners', contact_name: 'Partner Bob' },
  { id: 'p2', company_name: 'Beta Partners', contact_name: undefined },
];

// Task 4: default useEntityTimeline() return shape + a small factory for
// individual timeline events, used by the "unified customer timeline" tests.
const makeTimelineState = (overrides: any = {}) => ({
  events: [],
  summary: null,
  loading: false,
  loadingMore: false,
  error: null,
  hasMore: false,
  loadMore: vi.fn(),
  refetch: vi.fn(),
  search: '', setSearch: vi.fn(),
  moduleFilter: '', setModuleFilter: vi.fn(),
  categoryFilter: '', setCategoryFilter: vi.fn(),
  range: '', setRange: vi.fn(),
  pinnedIds: new Set(), togglePin: vi.fn(),
  removeEvent: vi.fn(),
  updateEventDescription: vi.fn(),
  ...overrides,
});

const sampleEvent = (id: string, overrides: any = {}) => ({
  id,
  icon: 'activity',
  title: `Event ${id}`,
  description: `Description for ${id}`,
  actor_id: null,
  actor_name: null,
  created_at: new Date().toISOString(),
  module: 'crm',
  related_type: null,
  related_id: null,
  status_badge: null,
  group_key: id,
  ...overrides,
});

let mockUseShellBridge: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  // Re-apply the default useShellBridge implementation so tests that call mockReturnValue don't bleed through
  const shell = await import('@so360/shell-context');
  mockUseShellBridge = vi.mocked(shell.useShellBridge);
  mockUseShellBridge.mockImplementation(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false }));
  mockPathname = '/crm/leads/lead-1';
  mockGetLeadById.mockResolvedValue(makeLead());
  mockGetDealsByLeadId.mockResolvedValue(associatedDeals);
  mockGetTasksByLeadId.mockResolvedValue(associatedTasks);
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue([owner]);
  mockGetActivitiesByLeadId.mockResolvedValue(makeLead().activities);
  mockGetActivitiesByLeadIdPaginated.mockResolvedValue({ data: makeLead().activities, total: makeLead().activities.length });
  mockGetPartners.mockResolvedValue(mockPartners);
  mockGetDocumentsByLeadId.mockResolvedValue(makeLead().documents);
  mockUseEntityTimeline.mockReturnValue(makeTimelineState());
});

/**
 * Feature: Comb adoption (95ffb66) — the owner picker options are Comb Buttons,
 * still exposed as listbox options with the selection state announced.
 */
const bob = { id: 'u2', full_name: 'Bob Builder', email: 'bob@test.com', avatar_url: null };

const openOwnerPicker = async () => {
  render(<LeadDetailPage />);
  await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
  fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0]);
  return screen.findByRole('listbox', { name: 'Assign owner' });
};

describe('Feature: LeadDetailPage owner picker (Comb Button)', () => {
  beforeEach(() => {
    mockGetUsers.mockResolvedValue([owner, bob]);
  });

  describe('Scenario: picker lists users as Comb ghost buttons', () => {
    it('Given the lead has an owner / When Change is clicked / Then every user is a Comb Button option and the Change control becomes Cancel', async () => {
      const list = await openOwnerPicker();
      const options = within(list).getAllByRole('option');
      expect(options).toHaveLength(2);
      options.forEach((o) => {
        expect(o).toHaveAttribute('data-comb', 'button');
        expect(o).toHaveAttribute('data-variant', 'ghost');
        expect(o).toHaveAttribute('type', 'button');
      });
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('data-comb', 'button');
    });
  });

  describe('Scenario: selected owner is announced', () => {
    it('Given Test Owner owns the lead / When the picker is open / Then only that option has aria-selected=true', async () => {
      const list = await openOwnerPicker();
      expect(within(list).getByRole('option', { name: /Test Owner/ })).toHaveAttribute('aria-selected', 'true');
      expect(within(list).getByRole('option', { name: /Bob Builder/ })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Scenario: choosing a new owner', () => {
    it('Given the picker is open / When Bob is clicked / Then the lead is updated with Bob and the picker closes', async () => {
      const list = await openOwnerPicker();
      fireEvent.click(within(list).getByRole('option', { name: /Bob Builder/ }));
      await waitFor(() => expect(mockUpdateLead).toHaveBeenCalledWith('lead-1', { owner: bob }));
      await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Assign owner' })).not.toBeInTheDocument());
    });
  });

  describe('Scenario: owner update fails', () => {
    it('Given updateLead rejects / When Bob is clicked / Then an error toast shows and the picker stays open', async () => {
      mockUpdateLead.mockRejectedValueOnce(new Error('nope'));
      const list = await openOwnerPicker();
      fireEvent.click(within(list).getByRole('option', { name: /Bob Builder/ }));
      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Failed to update owner.'));
      expect(screen.getByRole('listbox', { name: 'Assign owner' })).toBeInTheDocument();
    });
  });

  describe('Scenario: cancelling the picker', () => {
    it('Given the picker is open / When Cancel is clicked / Then the listbox closes without updating the lead', async () => {
      await openOwnerPicker();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('listbox', { name: 'Assign owner' })).not.toBeInTheDocument();
      expect(mockUpdateLead).not.toHaveBeenCalled();
    });
  });
  describe('Scenario: keyboard, closed state and re-open', () => {
    it('Given the page loaded / When nothing was clicked / Then no owner listbox is shown', async () => {
      render(<LeadDetailPage />);
      await screen.findAllByRole('button', { name: 'Change' });
      expect(screen.queryByRole('listbox', { name: 'Assign owner' })).not.toBeInTheDocument();
    });
    it('Given the picker is open / When Bob is focused and Enter pressed / Then the lead owner is updated', async () => {
      const list = await openOwnerPicker();
      const user = userEvent.setup();
      within(list).getByRole('option', { name: /Bob/ }).focus();
      await user.keyboard('{Enter}');
      await waitFor(() => expect(mockUpdateLead).toHaveBeenCalledWith('lead-1', { owner: bob }));
    });
    it('Given the picker is open / When Bob is focused and Space pressed / Then the lead owner is updated', async () => {
      const list = await openOwnerPicker();
      const user = userEvent.setup();
      within(list).getByRole('option', { name: /Bob/ }).focus();
      await user.keyboard(' ');
      await waitFor(() => expect(mockUpdateLead).toHaveBeenCalledWith('lead-1', { owner: bob }));
    });
    it('Given the picker was cancelled / When Change is clicked again / Then the listbox re-opens', async () => {
      await openOwnerPicker();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0]);
      expect(await screen.findByRole('listbox', { name: 'Assign owner' })).toBeInTheDocument();
    });
    it('Given the picker is open / When the options render / Then each option is a focusable button in the tab order', async () => {
      const list = await openOwnerPicker();
      within(list).getAllByRole('option').forEach((o) => { expect(o.tagName).toBe('BUTTON'); expect(o).not.toHaveAttribute('tabindex', '-1'); });
    });
  });
});
