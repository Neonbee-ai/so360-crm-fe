import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetLeadById = vi.fn();
const mockGetDealsByLeadId = vi.fn();
const mockGetTasksByLeadId = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
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
const mockNavigate = vi.fn();
const mockRecordActivity = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
    getDealsByLeadId: (...a: any[]) => mockGetDealsByLeadId(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasksByLeadId(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
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

const mockUseEntityTimeline = vi.fn();
vi.mock('./components/timeline/useEntityTimeline', () => ({
  useEntityTimeline: (...args: any[]) => mockUseEntityTimeline(...args),
}));

vi.mock('./components/AuditHistoryTab', () => ({ default: () => <div data-testid="audit-history-tab" /> }));
vi.mock('../components/stakeholders/StakeholdersTab', () => ({ default: () => <div data-testid="stakeholders-tab" /> }));
vi.mock('./components/EmailsTab', () => ({ default: () => <div data-testid="emails-tab" /> }));
vi.mock('./components/MeetingsTab', () => ({ default: () => <div data-testid="meetings-tab" /> }));
vi.mock('./components/QuickActionBar', () => ({ default: () => <div data-testid="quick-action-bar" /> }));
vi.mock('./components/LeadLayoutSettingsPanel', () => ({ default: () => null }));

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
  useActivity: () => ({ recordActivity: (...a: any[]) => mockRecordActivity(...a) }),
  useShellBridge: vi.fn(() => ({ effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true, isFeatureHidden: () => false })),
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
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
vi.mock('../components/notes/NoteReplyComposer', () => ({
  default: () => null,
}));
vi.mock('./components/LeadProductsTab', () => ({
  default: ({ onStatsChange }: any) => (
    <div data-testid="products-tab">
      <button onClick={() => onStatsChange(0, 0)}>Mock Products Tab</button>
    </div>
  ),
}));
vi.mock('./components/CustomerFeedbackTab', () => ({
  default: () => <div data-testid="feedback-tab">Mock Feedback</div>,
}));
vi.mock('./components/CallsTab', () => ({
  default: () => <div data-testid="calls-tab">Mock Calls</div>,
}));

import LeadDetailPage from './LeadDetailPage';
const makeLead = (overrides: any = {}) => ({
  id: 'lead-1',
  first_name: 'John',
  last_name: 'Doe',
  contact_name: 'John Doe',
  company_name: 'Acme Corp',
  status: 'Qualified',
  source: 'Website',
  contact_email: 'john@acme.com',
  phone: '555-1234',
  created_at: '2025-01-01',
  score_breakdown: [],
  auto_score: 50,
  notes: [],
  documents: [],
  type: 'lead',
  custom_fields: {},
  ...overrides,
});

beforeEach(async () => {
  vi.clearAllMocks();
  mockSetCurrentEntity.mockClear();
  mockNavigate.mockClear();
  mockShowSuccess.mockClear();
  mockShowError.mockClear();

  mockGetLeadById.mockResolvedValue(makeLead());
  mockGetDealsByLeadId.mockResolvedValue([]);
  mockGetTasksByLeadId.mockResolvedValue([]);
  mockPathname = '/crm/leads/lead-1';
  mockGetSettings.mockResolvedValue({
    lead_custom_fields: [],
    lead_scoring: [],
    score_categories: [],
    lead_stages: [{ id: 's1', name: 'Qualified' }],
  });
  mockGetUsers.mockResolvedValue([]);
  mockGetActivitiesByLeadIdPaginated.mockResolvedValue({ data: [], total: 0 });
  mockGetDocumentsByLeadId.mockResolvedValue([]);
  mockGetPartners.mockResolvedValue([]);
  mockUseEntityTimeline.mockReturnValue({
    events: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    pinnedIds: new Set(),
    togglePin: vi.fn(),
    loadMore: vi.fn(),
    updateEventDescription: vi.fn(),
    removeEvent: vi.fn(),
    summary: null,
  });
  mockUpdateTask.mockResolvedValue({});
  mockCreateNote.mockResolvedValue({ id: 'nn1', content: 'new note', author: { id: 'u1', full_name: 'Test Owner' }, created_at: new Date().toISOString() });
});

afterEach(() => { vi.clearAllMocks(); });

const ICP_META = { icp_score: 72, icp_name: 'Enterprise CTOs', icp_criteria: { industry: 30 }, synced_at: '2026-10-01T10:00:00Z' };

describe('Feature: ICP fit card on LeadDetailPage', () => {
  it('Given a lead with icp_score in custom_fields When opened on the leads route Then the ICP fit card shows', async () => {
    mockGetLeadById.mockResolvedValue(makeLead({ custom_fields: ICP_META }));
    render(<LeadDetailPage />);
    expect(await screen.findByTestId('icp-fit-card')).toBeInTheDocument();
    expect(screen.getByTestId('icp-fit-score').textContent).toBe('72 / 100');
    expect(screen.getByTestId('icp-fit-name').textContent).toBe('Enterprise CTOs');
  });

  it('Given the card is shown When laid out Then it directly follows the score card section', async () => {
    mockGetLeadById.mockResolvedValue(makeLead({ custom_fields: ICP_META }));
    render(<LeadDetailPage />);
    const icp = await screen.findByTestId('icp-fit-card');
    const prev = icp.previousElementSibling;
    expect(prev?.getAttribute('data-testid')).not.toBe('icp-fit-card');
    expect(prev?.textContent).toMatch(/lead potential/i);
  });

  it('Given the same lead When opened on the customers route Then the ICP fit card is hidden', async () => {
    mockPathname = '/crm/customers/lead-1';
    mockGetLeadById.mockResolvedValue(makeLead({ custom_fields: ICP_META }));
    render(<LeadDetailPage />);
    await screen.findAllByText(/Acme Corp/);
    expect(screen.queryByTestId('icp-fit-card')).toBeNull();
  });

  it('Given a lead without icp_score When opened Then the ICP fit card is hidden', async () => {
    mockGetLeadById.mockResolvedValue(makeLead({ custom_fields: { other: 1 } }));
    render(<LeadDetailPage />);
    await screen.findAllByText(/Acme Corp/);
    expect(screen.queryByTestId('icp-fit-card')).toBeNull();
  });

  it('Given a lead with no custom_fields at all When opened Then the page renders without the card', async () => {
    mockGetLeadById.mockResolvedValue(makeLead({ custom_fields: undefined }));
    render(<LeadDetailPage />);
    await screen.findAllByText(/Acme Corp/);
    expect(screen.queryByTestId('icp-fit-card')).toBeNull();
  });

  it('Given the ICP flag is off for the tenant When opened Then the ICP fit card is hidden', async () => {
    const shell = await import('@so360/shell-context');
    (shell.useShellBridge as any).mockImplementation(() => ({
      effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
      isFeatureEnabled: (k: string) => k !== 'submodule:crm:icp_manager', isFeatureHidden: () => false,
    }));
    mockGetLeadById.mockResolvedValue(makeLead({ custom_fields: ICP_META }));
    render(<LeadDetailPage />);
    await screen.findAllByText(/Acme Corp/);
    expect(screen.queryByTestId('icp-fit-card')).toBeNull();
    (shell.useShellBridge as any).mockImplementation(() => ({
      effectiveFlagsLoaded: true, permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true,
      isFeatureEnabled: () => true, isFeatureHidden: () => false,
    }));
  });
});
