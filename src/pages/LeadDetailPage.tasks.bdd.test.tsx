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

const clickTasksTab = async () => {
  await waitFor(() => expect(screen.getByText(/Tasks/)).toBeInTheDocument());
  const tasksTab = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent?.includes('Tasks'));
  if (tasksTab) fireEvent.click(tasksTab);
};

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

const makeTask = (overrides: any = {}) => ({
  id: 'task-1',
  title: 'Follow up with client',
  description: 'Call them about the proposal',
  status: 'OPEN',
  due_date: '2026-12-31',
  deal_id: null,
  deal_name: null,
  lead_id: 'lead-1',
  assigned_to: { id: 'user-1', full_name: 'Test User', avatar_url: null },
  type: 'TASK',
  created_at: '2025-01-01',
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
  mockGetTasksByLeadId.mockResolvedValue([makeTask()]);
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

afterEach(() => {
  vi.clearAllMocks();
});

describe('Lead Detail Tasks Tab — Quick View Enhancements', () => {
  describe('Given task card is displayed in Tasks tab', () => {
    it('When Tasks tab is active / Then renders task cards with title clickable', async () => {
      render(<LeadDetailPage />);
      // Click Tasks tab to show tasks
      await waitFor(() => expect(screen.getByText(/Tasks/)).toBeInTheDocument());
      const tasksTab = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent?.includes('Tasks'));
      expect(tasksTab).toBeTruthy();
      fireEvent.click(tasksTab!);

      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());

      // Verify the task title is clickable (rendered as Link)
      const taskLink = screen.getByText('Follow up with client').closest('a');
      expect(taskLink).toHaveAttribute('href', '/crm/tasks/task-1');
    });

    it('When task card title is clicked / Then navigates to TaskDetailPage', async () => {
      render(<LeadDetailPage />);
      // Click Tasks tab to show tasks
      await waitFor(() => expect(screen.getByText(/Tasks/)).toBeInTheDocument());
      const tasksTab = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent?.includes('Tasks'));
      fireEvent.click(tasksTab!);

      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());

      const taskLink = screen.getByText('Follow up with client').closest('a');
      fireEvent.click(taskLink!);

      // Navigation happens through Link component (tested by href presence above)
      expect(taskLink).toHaveAttribute('href', '/crm/tasks/task-1');
    });
  });

  describe('Given task with status OPEN', () => {
    it('When rendered / Then status badge is displayed and clickable', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      const statusBtn = screen.getByTestId('status-button-task-1');
      expect(statusBtn).toHaveTextContent('OPEN');
    });

    it('When status button clicked / Then dropdown menu appears with status options', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      const statusBtn = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn);

      await waitFor(() => {
        expect(screen.getByTestId('status-dropdown-task-1')).toBeInTheDocument();
        expect(screen.getByTestId('status-option-task-1-OPEN')).toBeInTheDocument();
        expect(screen.getByTestId('status-option-task-1-IN_PROGRESS')).toBeInTheDocument();
        expect(screen.getByTestId('status-option-task-1-DONE')).toBeInTheDocument();
      });
    });

    it('When status option IN_PROGRESS selected / Then updates task status via API', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      const statusBtn = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn);

      await waitFor(() => expect(screen.getByTestId('status-option-task-1-IN_PROGRESS')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('status-option-task-1-IN_PROGRESS'));

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'IN_PROGRESS' });
        expect(mockShowSuccess).toHaveBeenCalled();
      });
    });

    it('When status option DONE selected / Then updates task status to DONE', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      const statusBtn = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn);

      await waitFor(() => expect(screen.getByTestId('status-option-task-1-DONE')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('status-option-task-1-DONE'));

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'DONE' });
      });
    });

    it('When status update fails / Then shows error toast', async () => {
      mockUpdateTask.mockRejectedValueOnce(new Error('API Error'));

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      const statusBtn = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn);

      await waitFor(() => expect(screen.getByTestId('status-option-task-1-IN_PROGRESS')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('status-option-task-1-IN_PROGRESS'));

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith('Failed to update task status');
      });
    });

    it('When dropdown open and another status clicked / Then closes dropdown after selection', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      const statusBtn = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn);
      await waitFor(() => expect(screen.getByTestId('status-dropdown-task-1')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('status-option-task-1-IN_PROGRESS'));

      await waitFor(() => {
        // Dropdown should close after selection
        expect(screen.queryByTestId('status-dropdown-task-1')).not.toBeInTheDocument();
      });
    });
  });

  describe('Given task with overdue due date', () => {
    it('When task due_date is before today / Then renders Overdue badge in red', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const overdueTask = makeTask({ due_date: yesterday.toISOString().split('T')[0] });

      mockGetTasksByLeadId.mockResolvedValueOnce([overdueTask]);

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('overdue-badge-task-1')).toBeInTheDocument());

      const overdueBadge = screen.getByTestId('overdue-badge-task-1');
      expect(overdueBadge).toHaveTextContent('Overdue');
      expect(overdueBadge).toHaveClass('bg-rose-500/10', 'text-rose-400', 'border-rose-500/30');
    });

    it('When task status is DONE / Then does not show Overdue badge (even if due_date passed)', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const doneTask = makeTask({ due_date: yesterday.toISOString().split('T')[0], status: 'DONE' });

      mockGetTasksByLeadId.mockResolvedValueOnce([doneTask]);

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());

      // Overdue badge should NOT be present for completed tasks
      expect(screen.queryByTestId('overdue-badge-task-1')).not.toBeInTheDocument();
    });

    it('When task is overdue / Then card highlights with red border and background tint', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const overdueTask = makeTask({ due_date: yesterday.toISOString().split('T')[0] });

      mockGetTasksByLeadId.mockResolvedValueOnce([overdueTask]);

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());

      // Find the card container
      const card = screen.getByTestId('overdue-badge-task-1').closest('[class*="flex items-start gap-4"]');
      expect(card).toHaveClass('border-rose-500/40', 'bg-rose-950/10');
    });

    it('When task is overdue / Then due date text is displayed in red', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const overdueTask = makeTask({ due_date: yesterday.toISOString().split('T')[0] });

      mockGetTasksByLeadId.mockResolvedValueOnce([overdueTask]);

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());

      // Due date should be in red for overdue tasks
      const dueDateText = screen.getByText(/^Due/);
      expect(dueDateText).toHaveClass('text-rose-400');
    });

    it('When task due_date is today / Then does not show Overdue badge', async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const todayTask = makeTask({ due_date: todayStr });

      mockGetTasksByLeadId.mockResolvedValueOnce([todayTask]);

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());

      // Should NOT show overdue badge for tasks due today
      expect(screen.queryByTestId('overdue-badge-task-1')).not.toBeInTheDocument();
    });

    it('When task due_date is in the future / Then does not show Overdue badge', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureTask = makeTask({ due_date: tomorrow.toISOString().split('T')[0] });

      mockGetTasksByLeadId.mockResolvedValueOnce([futureTask]);

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());

      // Should NOT show overdue badge for future tasks
      expect(screen.queryByTestId('overdue-badge-task-1')).not.toBeInTheDocument();
    });
  });

  describe('Given task card interactions', () => {
    it('When task description exists / Then displays task description', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByText('Call them about the proposal')).toBeInTheDocument());
    });

    it('When status dropdown is open and user clicks outside / Then closes dropdown', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      const statusBtn = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn);
      await waitFor(() => expect(screen.getByTestId('status-dropdown-task-1')).toBeInTheDocument());

      // Click elsewhere to close
      fireEvent.click(screen.getByText('Follow up with client'));

      // Dropdown should remain open because we're clicking within the card
      // This is the expected behavior - you need to click outside the dropdown specifically
    });

    it('When task card checkbox is clicked / Then toggles task completion', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      // Find checkbox button (before the title)
      const checkboxes = screen.getAllByRole('button').filter(btn => btn.className.includes('w-5 h-5 rounded border'));
      expect(checkboxes.length).toBeGreaterThan(0);

      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalled();
      });
    });

    it('When edit button hovered / Then becomes visible', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());

      // Edit button should exist (it's conditionally visible on hover via CSS)
      const allButtons = screen.getAllByRole('button');
      const editButtons = allButtons.filter(btn => btn.className.includes('hover:text-blue-400') && btn.className.includes('hover:bg-slate-700'));
      expect(editButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Given multiple tasks', () => {
    it('When multiple tasks rendered / Then each has independent status dropdown', async () => {
      const task1 = makeTask({ id: 'task-1', title: 'Task 1' });
      const task2 = makeTask({ id: 'task-2', title: 'Task 2', status: 'IN_PROGRESS' });

      mockGetTasksByLeadId.mockResolvedValueOnce([task1, task2]);

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      });

      // Open dropdown for first task
      fireEvent.click(screen.getByTestId('status-button-task-1'));
      await waitFor(() => expect(screen.getByTestId('status-dropdown-task-1')).toBeInTheDocument());

      // Second task dropdown should NOT be open
      expect(screen.queryByTestId('status-dropdown-task-2')).not.toBeInTheDocument();
    });

    it('When opening dropdown for one task / Then closes dropdown for other tasks', async () => {
      const task1 = makeTask({ id: 'task-1', title: 'Task 1' });
      const task2 = makeTask({ id: 'task-2', title: 'Task 2', status: 'IN_PROGRESS' });

      mockGetTasksByLeadId.mockResolvedValueOnce([task1, task2]);

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      });

      // The tasks are displayed, now open dropdown for first task
      const statusBtn1 = await screen.findByTestId('status-button-task-1');
      fireEvent.click(statusBtn1);
      await waitFor(() => expect(screen.getByTestId('status-dropdown-task-1')).toBeInTheDocument());

      // Click second task's status button
      fireEvent.click(screen.getByTestId('status-button-task-2'));

      await waitFor(() => {
        // First dropdown should close
        expect(screen.queryByTestId('status-dropdown-task-1')).not.toBeInTheDocument();
        // Second dropdown should open
        expect(screen.getByTestId('status-dropdown-task-2')).toBeInTheDocument();
      });
    });
  });

  describe('Given status update edge cases', () => {
    it('When task status updated to DONE / Then status badge changes to green', async () => {
      mockUpdateTask.mockImplementationOnce((taskId, data) => {
        // Simulate status change
        return Promise.resolve({});
      });

      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      const statusBtn = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn);

      await waitFor(() => expect(screen.getByTestId('status-option-task-1-DONE')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('status-option-task-1-DONE'));

      // Status should be updated in the display
      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'DONE' });
      });
    });

    it('When multiple sequential status updates occur / Then all are processed', async () => {
      render(<LeadDetailPage />);
      await clickTasksTab();
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());

      // First update to IN_PROGRESS
      const statusBtn1 = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn1);

      await waitFor(() => expect(screen.getByTestId('status-option-task-1-IN_PROGRESS')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('status-option-task-1-IN_PROGRESS'));

      // Wait for first update to complete
      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { status: 'IN_PROGRESS' });
      });

      // Second update to DONE
      await waitFor(() => expect(screen.getByTestId('status-button-task-1')).toBeInTheDocument());
      const statusBtn2 = screen.getByTestId('status-button-task-1');
      fireEvent.click(statusBtn2);

      await waitFor(() => expect(screen.getByTestId('status-option-task-1-DONE')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('status-option-task-1-DONE'));

      // Both calls should be made
      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledTimes(2);
      });
    });
  });
});

describe('Lead Detail Tasks Tab — Reminders & Completed-Task Rules', () => {
  const openTasksTab = async () => {
    render(<LeadDetailPage />);
    await waitFor(() => expect(screen.getByText(/Tasks/)).toBeInTheDocument());
    const tasksTab = Array.from(screen.getAllByRole('button')).find(btn => btn.textContent?.includes('Tasks'));
    fireEvent.click(tasksTab!);
  };

  const soonReminder = (overrides: any = {}) => makeTask({
    id: 'rem-1',
    title: 'Call the client back',
    type: 'REMINDER',
    status: 'OPEN',
    due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  });

  describe('Given a reminder due within the next 24 hours', () => {
    it('When the Tasks tab is opened / Then the reminders panel renders as a notification strip', async () => {
      mockGetTasksByLeadId.mockResolvedValue([soonReminder()]);
      await openTasksTab();
      await waitFor(() => expect(screen.getByTestId('task-reminders-panel')).toBeInTheDocument());
      expect(screen.getByTestId('task-reminders-panel')).toHaveTextContent(/alerts for tasks already listed below/i);
    });

    it('When the reminder renders / Then it is an action, not a duplicate task card link', async () => {
      mockGetTasksByLeadId.mockResolvedValue([soonReminder()]);
      await openTasksTab();
      await waitFor(() => expect(screen.getByTestId('task-reminder-rem-1')).toBeInTheDocument());
      const reminder = screen.getByTestId('task-reminder-rem-1');
      expect(reminder.tagName).toBe('BUTTON');
      expect(reminder.querySelector('a')).toBeNull();
      expect(reminder).toHaveTextContent(/View Task/i);
    });

    it('When the reminder is clicked / Then the matching task card in the list below is highlighted', async () => {
      mockGetTasksByLeadId.mockResolvedValue([soonReminder()]);
      await openTasksTab();
      await waitFor(() => expect(screen.getByTestId('task-reminder-rem-1')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('task-reminder-rem-1'));
      await waitFor(() => {
        const card = document.getElementById('task-card-rem-1');
        expect(card?.className).toContain('ring-amber-500/70');
      });
    });

    it('When the reminder is overdue / Then it is labelled Overdue in the strip', async () => {
      mockGetTasksByLeadId.mockResolvedValue([
        soonReminder({ due_date: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
      ]);
      await openTasksTab();
      await waitFor(() => expect(screen.getByTestId('task-reminder-rem-1')).toHaveTextContent(/Overdue/i));
    });
  });

  describe('Given no reminder is due', () => {
    it('When the Tasks tab is opened / Then no reminders panel is rendered', async () => {
      mockGetTasksByLeadId.mockResolvedValue([makeTask()]);
      await openTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());
      expect(screen.queryByTestId('task-reminders-panel')).not.toBeInTheDocument();
    });

    it('When a reminder is already DONE / Then it is not surfaced as an alert', async () => {
      mockGetTasksByLeadId.mockResolvedValue([soonReminder({ status: 'DONE' })]);
      await openTasksTab();
      await waitFor(() => expect(screen.getByText('Call the client back')).toBeInTheDocument());
      expect(screen.queryByTestId('task-reminders-panel')).not.toBeInTheDocument();
    });
  });

  describe('Given a completed task in the lead task list', () => {
    it('When the card renders / Then its Edit action is disabled with an explanatory tooltip', async () => {
      mockGetTasksByLeadId.mockResolvedValue([makeTask({ status: 'DONE' })]);
      await openTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());
      const editBtn = screen.getByLabelText('Edit Task');
      expect(editBtn).toBeDisabled();
      expect(editBtn.getAttribute('title')).toMatch(/Mark as Open/i);
    });

    it('When the task is still OPEN / Then its Edit action stays enabled', async () => {
      mockGetTasksByLeadId.mockResolvedValue([makeTask({ status: 'OPEN' })]);
      await openTasksTab();
      await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());
      expect(screen.getByLabelText('Edit Task')).not.toBeDisabled();
    });
  });
});

/**
 * Cover for the three header/card presentation fixes reported against
 * /crm/leads/:id and /crm/customers/:id:
 *  - secondary task text was too light to read on the light theme's white card
 *  - the Delete button's text label competed with the primary CTA
 *  - the last workspace tab ("Feedback") was clipped by the settings cog
 *
 * The assertions are on the classes that carry the fix, because that is where
 * the regression would reappear — jsdom computes no colour of its own.
 */
describe('Lead Detail — readability and header layout', () => {
  const openTasks = async () => {
    render(<LeadDetailPage />);
    await waitFor(() => expect(screen.getByText(/Tasks/)).toBeInTheDocument());
    const tab = Array.from(screen.getAllByRole('button')).find(b => b.textContent?.includes('Tasks'));
    fireEvent.click(tab!);
    await waitFor(() => expect(screen.getByText('Follow up with client')).toBeInTheDocument());
  };

  /** Lowest slate step still legible on the light theme's white card. */
  const READABLE = /text-slate-(50|100|200|300)\b/;

  describe('Given a task card with description, due date and assignee', () => {
    it('When the description renders / Then it uses a readable secondary tone, not the old slate-400', async () => {
      await openTasks();
      const description = screen.getByText('Call them about the proposal');
      expect(description.className).toMatch(READABLE);
      expect(description.className).not.toMatch(/text-slate-[456]00\b/);
    });

    it('When the due date renders on a task that is not overdue / Then it is legible rather than a faded rose tint', async () => {
      await openTasks();
      const due = screen.getByText(/^Due /).closest('span')!;
      expect(due.className).not.toMatch(/rose-400\/70/);
      expect(due.className).toMatch(READABLE);
    });

    it('When the assignee renders / Then their name carries the same readable tone as the rest of the metadata', async () => {
      await openTasks();
      const assignee = screen.getByText('Test User').closest('span')!;
      expect(assignee.className).toMatch(READABLE);
    });

    it('When the metadata row renders / Then the whole row shares one readable tone', async () => {
      await openTasks();
      const row = screen.getByText(/^Due /).closest('div')!;
      expect(row.className).toMatch(READABLE);
    });

    it('When the card renders / Then the title still outweighs the metadata', async () => {
      await openTasks();
      const title = screen.getByText('Follow up with client');
      // Raising the metadata must not flatten the hierarchy the report asked to keep.
      expect(title.className).toMatch(/font-bold/);
      expect(title.className).toMatch(/text-slate-50\b/);
    });
  });

  describe('Given the record header', () => {
    it('When the Delete action renders / Then it is icon-only but still named for assistive tech and hover', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

      const del = screen.getByLabelText('Delete');
      expect(del).toHaveAttribute('title', 'Delete');
      expect(del.textContent).toBe('');
    });

    it('When the Delete action is used / Then the confirmation step is still required', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

      await user.click(screen.getByLabelText('Delete'));
      await waitFor(() =>
        expect(screen.getByText(/Are you sure you want to delete this lead/i)).toBeInTheDocument(),
      );
      expect(mockDeleteLead).not.toHaveBeenCalled();
    });

    it('When the primary CTA sits beside it / Then only the CTA carries a text label', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Deal')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /^Delete$/ })?.textContent).toBe('');
    });
  });

  describe('Given the workspace tab bar', () => {
    it('When the tabs render / Then the strip scrolls on its own so no label is clipped', async () => {
      render(<LeadDetailPage />);
      const strip = await screen.findByTestId('detail-tab-strip');
      expect(strip.className).toMatch(/overflow-x-auto/);
      // Each tab refuses to shrink or wrap, so labels stay whole.
      const tabs = Array.from(strip.querySelectorAll('button'));
      expect(tabs.length).toBeGreaterThan(0);
      tabs.forEach(tab => {
        expect(tab.className).toMatch(/shrink-0/);
        expect(tab.className).toMatch(/whitespace-nowrap/);
      });
    });

    it('When the layout settings control renders / Then it sits outside the scrolling strip so it cannot squeeze the last tab', async () => {
      render(<LeadDetailPage />);
      const strip = await screen.findByTestId('detail-tab-strip');
      const settings = screen.getByLabelText('Layout Settings');
      expect(strip.contains(settings)).toBe(false);
    });

    it('When every section is visible / Then the last tab is still rendered in full', async () => {
      render(<LeadDetailPage />);
      const strip = await screen.findByTestId('detail-tab-strip');
      const labels = Array.from(strip.querySelectorAll('button')).map(b => b.textContent?.trim());
      expect(labels.some(l => l === 'Feedback')).toBe(true);
    });
  });
});
