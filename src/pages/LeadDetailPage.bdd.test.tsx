import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

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

describe('LeadDetailPage', () => {
  describe('Given a lead with contact info and deals', () => {
    it('When the page loads / Then displays the contact name and company', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows the lead journey stepper', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('journey-stepper')).toHaveTextContent('new');
      });
    });

    it('When viewed as a customer route / Then hides the lead journey stepper', async () => {
      mockPathname = '/crm/customers/lead-1';
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      expect(screen.queryByTestId('journey-stepper')).not.toBeInTheDocument();
    });

    it('When the page loads / Then shows the email and phone in profile', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('john@acme.com')).toBeInTheDocument();
        expect(screen.getByText('555-1234')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows source info', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Website')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows created date formatted in business timezone', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        // formatters.formatDate with UTC timezone and en-US locale renders 'Jan 1, 2025'
        expect(screen.getByText('Jan 1, 2025')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows associated deals with their value', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Deal')).toBeInTheDocument();
        expect(screen.getAllByText('$30000').length).toBeGreaterThan(0);
      });
    });

    it('When the page loads / Then calculates revenue with Won deals as earned', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('$30000').length).toBeGreaterThan(0);
      });
    });

    it('When the page loads / Then calculates pipeline revenue from non-Won/Lost deals', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('$20000').length).toBeGreaterThan(0);
      });
    });

    it('When Create Deal button is clicked / Then opens the create deal modal', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Create Deal'));
      expect(screen.getByTestId('create-deal-modal')).toBeInTheDocument();
    });

    it('When the page loads / Then requests the unified timeline for this lead (Task 4)', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      expect(mockUseEntityTimeline).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'lead', entityId: 'lead-1', pageSize: 7 }));
    });

    it('When the timeline hook returns events / Then renders them via TimelineEventCard', async () => {
      mockUseEntityTimeline.mockReturnValue(makeTimelineState({
        events: [sampleEvent('call:c1', { title: 'Outbound call logged', description: 'Intro call completed' })],
      }));
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Outbound call logged')).toBeInTheDocument());
      expect(screen.getByText('Intro call completed')).toBeInTheDocument();
    });

    it('When the page loads / Then shows lead score based on scoring rules', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        const scoreElements = screen.getAllByText(/\d+/);
        expect(scoreElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given notes tab interactions', () => {
    it('When switching to notes tab / Then shows existing notes', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => {
        expect(screen.getByText('Hot lead from conference')).toBeInTheDocument();
        expect(screen.getByText('Needs follow up')).toBeInTheDocument();
      });
    });

    it('When Save Note is clicked with content / Then creates a new note', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByPlaceholderText('Add a private note about this lead...')).toBeInTheDocument());
      const textarea = screen.getByPlaceholderText('Add a private note about this lead...');
      fireEvent.change(textarea, { target: { value: 'Important lead update' } });
      await user.click(screen.getByText('Save Note'));
      await waitFor(() => expect(mockCreateNote).toHaveBeenCalledWith({ lead_id: 'lead-1', content: 'Important lead update' }));
    });

    it('When no notes exist / Then shows empty notes message', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ notes: [] }));
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByText('No notes captured for this lead yet.')).toBeInTheDocument());
    });

    it('When a note\'s edit button is clicked / Then an editor pre-filled with its content replaces the display', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByTestId('edit-note-n1')).toBeInTheDocument());
      await user.click(screen.getByTestId('edit-note-n1'));
      const editors = screen.getAllByTestId('note-editor-mock');
      expect((editors[0] as HTMLTextAreaElement).value).toBe('Hot lead from conference');
    });

    it('When an edited note is saved / Then it calls updateNote and shows the updated content', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByTestId('edit-note-n1')).toBeInTheDocument());
      await user.click(screen.getByTestId('edit-note-n1'));
      const editors = screen.getAllByTestId('note-editor-mock');
      fireEvent.change(editors[0], { target: { value: 'Updated note content' } });
      await user.click(screen.getByText('Save'));
      await waitFor(() => expect(mockUpdateNote).toHaveBeenCalledWith('n1', 'Updated note content'));
      await waitFor(() => expect(screen.getByText('Updated note content')).toBeInTheDocument());
    });

    it('When edit is cancelled / Then updateNote is not called and the original content remains', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByTestId('edit-note-n1')).toBeInTheDocument());
      await user.click(screen.getByTestId('edit-note-n1'));
      await user.click(screen.getByText('Cancel'));
      expect(mockUpdateNote).not.toHaveBeenCalled();
      expect(screen.getByText('Hot lead from conference')).toBeInTheDocument();
    });

    it('When a note is deleted and confirmed / Then it calls deleteNote and removes the note', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByTestId('delete-note-n1')).toBeInTheDocument());
      await user.click(screen.getByTestId('delete-note-n1'));
      await waitFor(() => expect(mockDeleteNote).toHaveBeenCalledWith('n1'));
      await waitFor(() => expect(screen.queryByText('Hot lead from conference')).not.toBeInTheDocument());
      confirmSpy.mockRestore();
    });

    it('When a note delete is not confirmed / Then deleteNote is not called', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByTestId('delete-note-n1')).toBeInTheDocument());
      await user.click(screen.getByTestId('delete-note-n1'));
      expect(mockDeleteNote).not.toHaveBeenCalled();
      expect(screen.getByText('Hot lead from conference')).toBeInTheDocument();
      confirmSpy.mockRestore();
    });
  });

  describe('Given tasks tab interactions', () => {
    it('When switching to tasks tab / Then shows task list with count', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      const tasksTab = screen.getByText(/Tasks \(2\)/);
      await user.click(tasksTab);
      await waitFor(() => {
        expect(screen.getByText('Call back')).toBeInTheDocument();
        expect(screen.getByText('Send docs')).toBeInTheDocument();
      });
    });

    it('When task toggle is clicked / Then calls updateTask API', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Tasks \(2\)/));
      await waitFor(() => expect(screen.getByText('Call back')).toBeInTheDocument());
      const checkboxes = screen.getAllByRole('button').filter(b => b.className.includes('rounded border'));
      fireEvent.click(checkboxes[0]);
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('t1', { status: 'DONE' }));
    });

    it('When no tasks exist / Then shows no active tasks message', async () => {
      mockGetTasksByLeadId.mockResolvedValue([]);
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Tasks \(0\)/));
      await waitFor(() => expect(screen.getByText('No active tasks or follow-ups.')).toBeInTheDocument());
    });

    it('When Add Task is clicked / Then opens task creation modal', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Tasks \(2\)/));
      await waitFor(() => expect(screen.getByText('Add Task')).toBeInTheDocument());
      await user.click(screen.getByText('Add Task'));
      await waitFor(() => expect(screen.getByTestId('task-modal')).toBeInTheDocument());
    });

    it('When task has assigned_to with avatar / Then shows avatar image', async () => {
      const taskWithAvatar = [{ id: 't1', title: 'Call back', type: 'CALL', status: 'OPEN', due_date: '2025-02-01', created_at: '2025-01-20T10:00:00Z', assigned_to: { id: 'u1', full_name: 'Test Owner', avatar_url: 'https://img/av.jpg' }, description: null }];
      mockGetTasksByLeadId.mockResolvedValue(taskWithAvatar);
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Tasks \(1\)/));
      await waitFor(() => {
        const img = screen.getByAltText('Test Owner');
        expect(img).toHaveAttribute('src', 'https://img/av.jpg');
      });
    });
  });

  describe('Given documents tab interactions', () => {
    it('When switching to documents tab / Then shows existing documents', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Documents \(1\)/));
      await waitFor(() => {
        expect(screen.getByText('requirements.pdf')).toBeInTheDocument();
      });
    });

    it('When no documents exist / Then shows no documents message', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ documents: [] }));
      mockGetDocumentsByLeadId.mockResolvedValue([]);
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Documents \(0\)/));
      await waitFor(() => expect(screen.getByText('No documents attached')).toBeInTheDocument());
    });

    it('When documents tab is open / Then View link opens document URL in a new tab', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Documents \(1\)/));
      await waitFor(() => expect(screen.getByText('requirements.pdf')).toBeInTheDocument());
      const viewLink = screen.getByTitle('View');
      expect(viewLink.tagName).toBe('A');
      expect(viewLink).toHaveAttribute('href', 'https://cdn.example.com/requirements.pdf');
      expect(viewLink).toHaveAttribute('target', '_blank');
    });

    it('When documents tab is open / Then Download action is a button (blob-fetch download)', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Documents \(1\)/));
      await waitFor(() => expect(screen.getByText('requirements.pdf')).toBeInTheDocument());
      const downloadBtn = screen.getByTitle('Download');
      expect(downloadBtn.tagName).toBe('BUTTON');
    });
  });

  describe('Given lead with custom fields', () => {
    it('When custom fields exist and Additional Info tab is available / Then shows custom field data', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      const additionalTab = screen.getByText('Additional Info');
      await user.click(additionalTab);
      await waitFor(() => {
        expect(screen.getByText('Priority Level')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
      });
    });
  });

  describe('Given lead phone is not provided', () => {
    it('When phone is null / Then shows Not provided', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ phone: null }));
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Not provided')).toBeInTheDocument());
    });
  });

  describe('Given lead activity timeline empty', () => {
    it('When no activities and no notes / Then shows empty timeline', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ activities: [], notes: [], documents: [] }));
      mockGetDealsByLeadId.mockResolvedValue([]);
      mockGetTasksByLeadId.mockResolvedValue([]);
      mockGetActivitiesByLeadId.mockResolvedValue([]);
      mockGetActivitiesByLeadIdPaginated.mockResolvedValue({ data: [], total: 0 });
      mockGetDocumentsByLeadId.mockResolvedValue([]);
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('No activities logged yet.')).toBeInTheDocument());
    });
  });

  describe('Given the lead is loading', () => {
    it('When data is pending / Then shows loading text', () => {
      mockGetLeadById.mockReturnValue(new Promise(() => {}));
      render(<LeadDetailPage />);
      expect(screen.getByText('Loading lead workspace...')).toBeInTheDocument();
    });
  });

  describe('Given the lead is not found', () => {
    it('When API returns null / Then shows not found state', async () => {
      mockGetLeadById.mockResolvedValue(null);
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Lead not found.')).toBeInTheDocument();
      });
    });

    it('When API returns null / Then shows back to leads link', async () => {
      mockGetLeadById.mockResolvedValue(null);
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('Back to Leads')[0]).toBeInTheDocument();
      });
    });

    it('When Back to Leads is clicked / Then it navigates to /crm/leads, not the dashboard', async () => {
      mockGetLeadById.mockResolvedValue(null);
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getAllByText('Back to Leads')[0]).toBeInTheDocument());
      fireEvent.click(screen.getAllByText('Back to Leads')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/crm/leads');
    });
  });

  describe('Given a loaded lead / Then Back navigation resolves to the correct list route', () => {
    it('When the header Back is clicked from /crm/leads/:id / Then it navigates to /crm/leads, not the dashboard', async () => {
      mockPathname = '/crm/leads/lead-1';
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getAllByText('Back')[0]).toBeInTheDocument());
      fireEvent.click(screen.getAllByText('Back')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/crm/leads');
    });

    it('When the header Back is clicked from /crm/customers/:id / Then it navigates to /crm/customers, not the dashboard', async () => {
      mockPathname = '/crm/customers/lead-1';
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getAllByText('Back')[0]).toBeInTheDocument());
      fireEvent.click(screen.getAllByText('Back')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/crm/customers');
    });
  });

  describe('Given lead deletion', () => {
    it('When Delete button is clicked / Then shows delete confirmation area', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByLabelText('Delete'));
      await waitFor(() => {
        const deleteTexts = screen.getAllByText(/Delete/);
        expect(deleteTexts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given lead status badge colors', () => {
    it('When lead status is Converted / Then shows Converted status text', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ status: 'Converted' }));
      render(<LeadDetailPage />);
      await waitFor(() => {
        const convertedBadges = screen.getAllByText('Converted');
        expect(convertedBadges.length).toBeGreaterThan(0);
      });
    });

    it('When lead status is Lost / Then shows Lost status text', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ status: 'Lost' }));
      render(<LeadDetailPage />);
      await waitFor(() => {
        const lostBadges = screen.getAllByText('Lost');
        expect(lostBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given lead scoring', () => {
    it('When lead has auto_score / Then score widget shows the value', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ auto_score: 50, score_breakdown: [{ rule_id: 'r1', rule_name: 'Referral Source', points: 50 }] }));
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument();
      });
    });
  });

  describe('Given reminders', () => {
    it('When task has REMINDER type due soon / Then shows Due Reminders badge', async () => {
      const reminderTask = {
        id: 'tr1', title: 'Reminder: Call client', type: 'REMINDER', status: 'OPEN',
        due_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        created_at: '2025-01-20T10:00:00Z', assigned_to: owner,
      };
      mockGetTasksByLeadId.mockResolvedValue([reminderTask]);
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Tasks \(1\)/));
      await waitFor(() => expect(screen.getByText('Due Reminders')).toBeInTheDocument());
    });
  });

  describe('Given Referred By field', () => {
    it('When lead has no referred_by / Then Referred By label is always visible in profile', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      expect(screen.getByText('Referred By')).toBeInTheDocument();
    });

    it('When lead has no referred_by / Then shows dash placeholder', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Referred By')).toBeInTheDocument());
      const referredBySection = screen.getByText('Referred By').closest('div')!.parentElement!;
      expect(referredBySection.textContent).toContain('—');
    });

    it('When lead has referred_by matching a partner / Then shows the partner company name', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ referred_by: 'p1' }));
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Acme Partners')).toBeInTheDocument());
    });

    it('When lead has referred_by but partner list is empty / Then shows dash', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ referred_by: 'unknown-id' }));
      mockGetPartners.mockResolvedValue([]);
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Referred By')).toBeInTheDocument());
      const referredBySection = screen.getByText('Referred By').closest('div')!.parentElement!;
      expect(referredBySection.textContent).toContain('—');
    });

    it('When viewed as customer route / Then Referred By field is still always visible', async () => {
      mockPathname = '/crm/customers/lead-1';
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      expect(screen.getByText('Referred By')).toBeInTheDocument();
    });

    it('When edit mode is toggled / Then PartnerSearchDropdown is rendered for Referred By', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      const editBtn = document.querySelector('[title="Edit Intelligence"]') as HTMLElement;
      await user.click(editBtn);
      await waitFor(() => expect(screen.getByTestId('partner-search-dropdown')).toBeInTheDocument());
    });

    it('When source is changed / Then referred_by value is preserved', async () => {
      mockGetLeadById.mockResolvedValue(makeLead({ referred_by: 'p1', source: 'website' }));
      const mockSourceTypes = [
        { value: 'website', label: 'Website' },
        { value: 'social_media', label: 'Social Media' },
      ];
      const { settingsApi } = await import('../services/crmService');
      vi.mocked(settingsApi.sourceTypes.getAll).mockResolvedValue(mockSourceTypes as any);
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Acme Partners')).toBeInTheDocument());
      const editBtn = document.querySelector('[title="Edit Intelligence"]') as HTMLElement;
      await user.click(editBtn);
      await waitFor(() => expect(screen.getByTestId('partner-search-dropdown')).toBeInTheDocument());
      // Change source — referred_by should remain (not cleared)
      const sourceSelect = screen.getByDisplayValue('Website');
      fireEvent.change(sourceSelect, { target: { value: 'social_media' } });
      // PartnerSearchDropdown should still show the selected partner
      expect(screen.getByTestId('partner-search-dropdown')).toBeInTheDocument();
    });
  });

  describe('Given effectiveFlagsLoaded guard — flicker prevention', () => {
    it('When effectiveFlagsLoaded is explicitly false / Then Create Deal button is absent', async () => {
      mockUseShellBridge.mockReturnValue({ effectiveFlagsLoaded: false, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true } as any);
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      expect(screen.queryByText('Create Deal')).not.toBeInTheDocument();
    });

    it('When effectiveFlagsLoaded is true / Then Create Deal button is present', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      expect(screen.getByText('Create Deal')).toBeInTheDocument();
    });
  });

  describe('Given the unified customer timeline (Task 4)', () => {
    it('When page loads / Then requests the timeline with pageSize=7', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      expect(mockUseEntityTimeline).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'lead', entityId: 'lead-1', pageSize: 7 }));
    });

    it('When events are loaded / Then shows "Showing latest N"', async () => {
      mockUseEntityTimeline.mockReturnValue(makeTimelineState({ events: [sampleEvent('e1'), sampleEvent('e2')] }));
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText(/Showing latest 2/)).toBeInTheDocument());
    });

    it('When no events are loaded / Then shows the empty timeline message', async () => {
      mockUseEntityTimeline.mockReturnValue(makeTimelineState({ events: [] }));
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('No activities logged yet.')).toBeInTheDocument());
    });

    it('When the timeline is loading / Then shows a spinner instead of the empty state', async () => {
      mockUseEntityTimeline.mockReturnValue(makeTimelineState({ loading: true }));
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      expect(screen.queryByText('No activities logged yet.')).not.toBeInTheDocument();
    });

    it('When View All History is clicked / Then opens ActivityHistoryDrawer', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('View All History')).toBeInTheDocument());
      await user.click(screen.getByText('View All History'));
      await waitFor(() => expect(screen.getByTestId('activity-history-drawer')).toBeInTheDocument());
    });

    it('When drawer is open and Close Drawer is clicked / Then drawer is dismissed', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('View All History')).toBeInTheDocument());
      await user.click(screen.getByText('View All History'));
      await waitFor(() => expect(screen.getByTestId('activity-history-drawer')).toBeInTheDocument());
      await user.click(screen.getByText('Close Drawer'));
      await waitFor(() => expect(screen.queryByTestId('activity-history-drawer')).not.toBeInTheDocument());
    });

    it('When hasMore is true / Then shows a Load More button that calls loadMore', async () => {
      const mockLoadMore = vi.fn();
      mockUseEntityTimeline.mockReturnValue(makeTimelineState({ events: [sampleEvent('e1')], hasMore: true, loadMore: mockLoadMore }));
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Load More →')).toBeInTheDocument());
      await user.click(screen.getByText('Load More →'));
      expect(mockLoadMore).toHaveBeenCalled();
    });

    it('When summary is present / Then renders the TimelineSummaryBanner health badge', async () => {
      mockUseEntityTimeline.mockReturnValue(makeTimelineState({
        events: [sampleEvent('e1')],
        summary: {
          last_interaction_at: '2025-01-05T10:00:00Z',
          most_active_contact: 'Test Owner',
          counts: {},
          pending_tasks: 0,
          latest_stage: null,
          idle_days: 1,
          health_status: 'healthy',
        },
      }));
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Healthy')).toBeInTheDocument());
    });
  });

  // Regression: the detail cards must be split across a two-column grid (main
  // workspace + context sidebar). Before the fix the page rendered only the
  // `lg:col-span-2` main column, leaving the third grid track empty so every
  // card stacked into a single column. The Deal detail page never regressed.
  describe('Given the detail page layout', () => {
    // Returns the outer grid that wraps the detail cards (parent of col-span-2).
    const getDetailGrid = (container: HTMLElement): HTMLElement => {
      const mainColumn = container.querySelector('.lg\\:col-span-2');
      expect(mainColumn).not.toBeNull();
      return mainColumn!.parentElement as HTMLElement;
    };

    it('When the lead loads / Then the cards are wrapped in a 3-track responsive grid', async () => {
      const { container } = render(<LeadDetailPage />);
      await waitFor(() => expect(container.querySelector('.lg\\:col-span-2')).not.toBeNull());
      expect(getDetailGrid(container).className).toContain('lg:grid-cols-3');
    });

    it('When the lead loads / Then the grid renders TWO columns (main + sidebar), not one', async () => {
      const { container } = render(<LeadDetailPage />);
      await waitFor(() => expect(container.querySelector('.lg\\:col-span-2')).not.toBeNull());
      // Pre-fix this was 1 (single column); the fix adds the sidebar sibling.
      expect(getDetailGrid(container).children.length).toBe(2);
    });

    it('When the lead loads / Then the first column is the main col-span-2 workspace', async () => {
      const { container } = render(<LeadDetailPage />);
      await waitFor(() => expect(container.querySelector('.lg\\:col-span-2')).not.toBeNull());
      const grid = getDetailGrid(container);
      expect((grid.children[0] as HTMLElement).className).toContain('lg:col-span-2');
    });

    it('When the lead loads / Then the second column is the context sidebar (not col-span-2)', async () => {
      const { container } = render(<LeadDetailPage />);
      await waitFor(() => expect(container.querySelector('.lg\\:col-span-2')).not.toBeNull());
      const sidebar = getDetailGrid(container).children[1] as HTMLElement;
      expect(sidebar.className).toContain('space-y-8');
      expect(sidebar.className).not.toContain('lg:col-span-2');
    });

    it('When the lead loads / Then context cards (Assigned Owner) live in the sidebar, not the main column', async () => {
      const { container } = render(<LeadDetailPage />);
      await waitFor(() => expect(container.querySelector('.lg\\:col-span-2')).not.toBeNull());
      const sidebar = getDetailGrid(container).children[1] as HTMLElement;
      expect(sidebar.textContent).toContain('Assigned Owner');
    });

    it('When viewed as a customer route (same component) / Then it also renders the two-column grid', async () => {
      mockPathname = '/crm/customers/lead-1';
      const { container } = render(<LeadDetailPage />);
      await waitFor(() => expect(container.querySelector('.lg\\:col-span-2')).not.toBeNull());
      const grid = getDetailGrid(container);
      expect(grid.className).toContain('lg:grid-cols-3');
      expect(grid.children.length).toBe(2);
    });
  });

  describe('Given the global Neura AI panel needs to know what is on screen', () => {
    it('When the lead loads / Then publishes it as the shell currentEntity', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(mockSetCurrentEntity).toHaveBeenCalledWith({
        module: 'crm',
        entity: 'leads',
        id: 'lead-1',
        label: 'Acme Corp',
      }));
    });

    it('When the page unmounts / Then clears the current entity so it never outlives this page', async () => {
      const { unmount } = render(<LeadDetailPage />);
      await waitFor(() => expect(mockSetCurrentEntity).toHaveBeenCalledWith(expect.objectContaining({ id: 'lead-1' })));

      unmount();

      expect(mockSetCurrentEntity).toHaveBeenLastCalledWith(null);
    });
  });

  describe('Given the Communication Quick Action bar', () => {
    // Regression: every quick action only called setActiveTab. The workspace it
    // switches sits far below the fold, so clicking produced no visible
    // response — the buttons looked interactive but appeared to do nothing.
    it('When Add Note is clicked / Then the notes workspace opens and is scrolled into view', async () => {
      const scrollIntoView = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Add Note/i }));

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
      expect(await screen.findByText(/Save Note/i)).toBeInTheDocument();
    });

    it('When Add Document is clicked / Then the documents workspace opens and the file picker is triggered', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
      const clickSpy = vi.spyOn(window.HTMLInputElement.prototype, 'click');
      try {
        render(<LeadDetailPage />);
        await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Add Document/i }));
        await vi.advanceTimersByTimeAsync(500);

        expect(await screen.findByText(/Upload Document/i)).toBeInTheDocument();
        expect(clickSpy).toHaveBeenCalled();
      } finally {
        clickSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it('When Log Call is clicked / Then the log-call surface opens in place, without moving the page', async () => {
      const scrollIntoView = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Log Call/i }));

      expect(await screen.findByText(/upload call recording/i)).toBeInTheDocument();
      // The quick action no longer switches tabs and scrolls there — that read
      // as an unexplained page jump.
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('When Create Task is clicked from a customer record / Then the form opens in place, with no navigation', async () => {
      mockPathname = '/crm/customers/lead-1';
      const scrollIntoView = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
      mockNavigate.mockClear();

      fireEvent.click(screen.getByRole('button', { name: /Create Task/i }));

      // The creation surface itself, on this page — not a route change, not a
      // tab switch, and not a jump down the page.
      expect(await screen.findByTestId('task-modal')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(scrollIntoView).not.toHaveBeenCalled();
      mockPathname = '/crm/leads/lead-1';
    });

    it('When Create Task is clicked twice in a row / Then the form opens again the second time', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Create Task/i }));
      expect(await screen.findByTestId('task-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('task-modal').querySelector('button')!);
      await waitFor(() => expect(screen.queryByTestId('task-modal')).toBeNull());

      fireEvent.click(screen.getByRole('button', { name: /Create Task/i }));
      expect(await screen.findByTestId('task-modal')).toBeInTheDocument();
    });

    it('When Schedule Meeting is clicked twice / Then the meeting form opens both times', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Schedule Meeting/i }));
      expect(await screen.findByText(/schedule meeting/i, { selector: 'p' })).toBeInTheDocument();

      // Close, then ask again. The old flag-based wiring was already `true`,
      // so the second click silently did nothing at all.
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      await waitFor(() => expect(screen.queryByText(/schedule meeting/i, { selector: 'p' })).toBeNull());

      fireEvent.click(screen.getByRole('button', { name: /Schedule Meeting/i }));
      expect(await screen.findByText(/schedule meeting/i, { selector: 'p' })).toBeInTheDocument();
    });
  });
});
