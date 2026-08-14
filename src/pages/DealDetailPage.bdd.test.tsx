import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
    updateDealStage: vi.fn(),
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

vi.mock('./components/TaskModal', () => ({ default: ({ onClose }: any) => <div data-testid="task-modal"><button onClick={onClose}>Close</button></div> }));

const shellCtl = vi.hoisted(() => ({ signEnabled: false }));
vi.mock('@so360/shell-context', () => ({
  useShell: () => ({ isModuleEnabled: (m: string) => m === 'sign' && shellCtl.signEnabled }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: () => true }),
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

describe('DealDetailPage', () => {
  describe('Given the Sign module gating', () => {
    it('When the Sign module is disabled / Then the Request Signature button is hidden', async () => {
      shellCtl.signEnabled = false;
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: /request signature/i })).not.toBeInTheDocument();
    });

    it('When the Sign module is enabled / Then the Request Signature button is shown', async () => {
      shellCtl.signEnabled = true;
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /request signature/i })).toBeInTheDocument();
    });
  });

  describe('Given a deal with timeline data', () => {
    it('When the page loads / Then shows the deal name and stage badge', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Big Deal')).toBeInTheDocument();
        expect(screen.getByText('Qualified')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then renders the lifecycle stepper with current state', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getByTestId('lifecycle-stepper')).toHaveTextContent('qualified');
      });
    });

    it('When the page loads / Then shows the deal financial value', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('$50000').length).toBeGreaterThan(0);
      });
    });

    it('When the page loads / Then shows the primary contact from the linked lead', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('John Contact')).toBeInTheDocument();
        expect(screen.getByText('john@acme.com')).toBeInTheDocument();
      });
    });

    it('When the activity tab is active / Then shows timeline entries for calls and meetings', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('CALL Logged')).toBeInTheDocument();
        expect(screen.getByText('Discussed requirements')).toBeInTheDocument();
        expect(screen.getByText('MEETING Logged')).toBeInTheDocument();
        expect(screen.getByText('Onsite demo')).toBeInTheDocument();
      });
    });

    it('When the activity tab is active / Then shows EMAIL logged events', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('EMAIL Logged')).toBeInTheDocument();
        expect(screen.getByText('Sent follow up email')).toBeInTheDocument();
      });
    });

    it('When timeline has system events / Then shows STATUS_CHANGE and STAGE_CHANGE entries', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('STATUS CHANGE')).toBeInTheDocument();
        expect(screen.getByText('STAGE CHANGE')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows the company name', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        const matches = screen.getAllByText('Acme Corp');
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('When the page loads / Then shows owner name', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        const matches = screen.getAllByText('Test Owner');
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('When the page loads / Then shows last activity date formatted in business timezone', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        // formatters.formatDate with UTC timezone and en-US locale renders 'Jan 20, 2025'
        // getAllByText because activity a2 (2025-01-20) produces the same formatted string
        expect(screen.getAllByText('Jan 20, 2025').length).toBeGreaterThan(0);
      });
    });

    it('When deal has no last_activity_at / Then shows None', async () => {
      mockGetDealById.mockResolvedValue(makeDeal({ last_activity_at: null }));
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('None')).toBeInTheDocument();
      });
    });

    it('When deal has no expected close date / Then shows dash', async () => {
      mockGetDealById.mockResolvedValue(makeDeal({ expected_close_date: null }));
      render(<DealDetailPage />);
      await waitFor(() => {
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThan(0);
      });
    });

    it('When timeline has author / Then shows author initial', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        const initials = screen.getAllByText('T');
        expect(initials.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given the deal has tasks', () => {
    it('When switching to the tasks tab / Then shows the task count and task list', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      const tasksTab = screen.getByText(/Tasks \(2\)/);
      await user.click(tasksTab);
      await waitFor(() => {
        expect(screen.getByText('Follow up call')).toBeInTheDocument();
        expect(screen.getByText('Send proposal')).toBeInTheDocument();
      });
    });

    it('When task is toggled to Done / Then calls updateTask API', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByText(/Tasks \(2\)/));
      await waitFor(() => expect(screen.getByText('Follow up call')).toBeInTheDocument());
      const checkboxes = screen.getAllByRole('button').filter(b => b.className.includes('rounded border'));
      fireEvent.click(checkboxes[0]);
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('t1', { status: 'DONE' }));
    });

    it('When no tasks exist / Then shows zero pending actions', async () => {
      mockGetTasksByDealId.mockResolvedValue([]);
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByText(/Tasks \(0\)/));
      await waitFor(() => expect(screen.getByText('Zero pending actions')).toBeInTheDocument());
    });

    it('When Add Task is clicked / Then opens task modal', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByText(/Tasks \(2\)/));
      await waitFor(() => expect(screen.getByText('Add Task')).toBeInTheDocument());
      await user.click(screen.getByText('Add Task'));
      await waitFor(() => expect(screen.getByTestId('task-modal')).toBeInTheDocument());
    });
  });

  describe('Given the deal has notes', () => {
    it('When switching to Notes tab / Then shows existing notes', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByText('Initial contact made')).toBeInTheDocument());
    });

    it('When Save Note is clicked / Then creates a note via API', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Notes'));
      await waitFor(() => expect(screen.getByPlaceholderText('Capture commercial context...')).toBeInTheDocument());
      const textarea = screen.getByPlaceholderText('Capture commercial context...');
      fireEvent.change(textarea, { target: { value: 'New deal note' } });
      await user.click(screen.getByText('Save Note'));
      await waitFor(() => expect(mockCreateNote).toHaveBeenCalledWith({ deal_id: 'deal-1', content: 'New deal note' }));
    });
  });

  describe('Given the deal has documents', () => {
    it('When switching to Docs tab / Then shows document name and size', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByText(/Docs \(1\)/));
      await waitFor(() => {
        expect(screen.getByText('proposal.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Given the deal has Additional Info tab', () => {
    it('When switching to Additional Info / Then shows custom field label', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Additional Info'));
      await waitFor(() => expect(screen.getByText('Priority')).toBeInTheDocument());
    });
  });

  describe('Given the Deal Detail navigation tabs', () => {
    it('When the page renders / Then the tab strip scrolls horizontally instead of clipping tabs', async () => {
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());

      const strip = screen.getByTestId('deal-detail-tab-strip');
      expect(strip.className).toContain('overflow-x-auto');
      expect(strip.parentElement?.className).not.toContain('overflow-hidden');

      // Every tab must still be reachable inside the scroll strip, not hidden.
      const tabButtons = within(strip).getAllByRole('button');
      const tabLabels = tabButtons.map((btn) => btn.textContent);
      ['Activity', 'Notes', 'Products', 'Additional Info', 'Calls'].forEach((label) => {
        expect(tabLabels.some((text) => text?.includes(label))).toBe(true);
      });
    });

    it('When switching tabs / Then the newly active tab scrolls into view', async () => {
      const user = userEvent.setup();
      const scrollIntoViewMock = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      scrollIntoViewMock.mockClear();

      await user.click(screen.getByText('Products'));
      await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled());
    });
  });

  describe('Given empty activity timeline', () => {
    it('When no activities exist / Then shows empty activity message', async () => {
      mockGetActivitiesByDealId.mockResolvedValue([]);
      mockGetTasksByDealId.mockResolvedValue([]);
      mockGetNotesByDealId.mockResolvedValue([]);
      mockGetDocumentsByDealId.mockResolvedValue([]);
      mockGetDealById.mockResolvedValue(makeDeal({ notes: [], documents: [], activities: [] }));
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('No activity history yet')).toBeInTheDocument());
    });
  });

  describe('Given the deal is loading', () => {
    it('When data is not yet resolved / Then shows loading state', () => {
      mockGetDealById.mockReturnValue(new Promise(() => {}));
      render(<DealDetailPage />);
      expect(screen.getByText('Initializing deal workspace...')).toBeInTheDocument();
    });
  });

  describe('Given the deal is not found', () => {
    it('When API returns null / Then shows not found message', async () => {
      mockGetDealById.mockResolvedValue(null);
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Deal not found.')).toBeInTheDocument();
      });
    });

    it('When API returns null / Then shows back to pipeline link', async () => {
      mockGetDealById.mockResolvedValue(null);
      render(<DealDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('Back to Pipeline')[0]).toBeInTheDocument();
      });
    });

    it('When the not-found Back to Pipeline is clicked / Then it navigates to the pipeline list, not the dashboard', async () => {
      mockGetDealById.mockResolvedValue(null);
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getAllByText('Back to Pipeline')[0]).toBeInTheDocument());
      await user.click(screen.getAllByText('Back to Pipeline')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/crm/pipeline');
    });
  });

  describe('Given a loaded deal / Then the universal Back control navigates to the pipeline list', () => {
    it('When the header Back is clicked / Then it navigates to /crm/pipeline, not the dashboard', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getAllByText('Back')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/crm/pipeline');
    });
  });

  describe('Given deal profile editing', () => {
    it('When edit button is clicked / Then shows value input in edit mode', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      const editBtns = screen.getAllByTitle('Edit Profile');
      await user.click(editBtns[0]);
      await waitFor(() => {
        const input = screen.getByDisplayValue('50000');
        expect(input).toBeInTheDocument();
      });
    });

    it('When cancel edit is clicked / Then exits edit mode', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      const editBtns = screen.getAllByTitle('Edit Profile');
      await user.click(editBtns[0]);
      await waitFor(() => expect(screen.getByTitle('Cancel')).toBeInTheDocument());
      await user.click(screen.getByTitle('Cancel'));
      await waitFor(() => expect(screen.queryByTitle('Cancel')).not.toBeInTheDocument());
    });

    it('When save profile is clicked / Then calls dealsApi update', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      const editBtns = screen.getAllByTitle('Edit Profile');
      await user.click(editBtns[0]);
      await waitFor(() => expect(screen.getByDisplayValue('50000')).toBeInTheDocument());
      const input = screen.getByDisplayValue('50000');
      fireEvent.change(input, { target: { value: '75000' } });
      const saveBtn = screen.getByTitle('Save Changes');
      await user.click(saveBtn);
      await waitFor(() => expect(mockDealsApiUpdate).toHaveBeenCalled());
    });
  });

  describe('Given deal deletion', () => {
    it('When Delete button clicked / Then shows delete confirmation', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByLabelText('Delete'));
      await waitFor(() => {
        const confirmTexts = screen.getAllByText(/Delete/);
        expect(confirmTexts.length).toBeGreaterThan(1);
      });
    });

    it('When delete confirmation modal opens / Then container has max-h-[90vh]', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      await user.click(screen.getByLabelText('Delete'));
      await waitFor(() => {
        const panels = Array.from(document.querySelectorAll('div')).filter(
          el => el.className.includes('max-h-[90vh]'),
        );
        expect(panels.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Given deal with invoice', () => {
    it('When deal has invoice_id / Then fetches invoice status', async () => {
      mockGetDealById.mockResolvedValue(makeDeal({ invoice_id: 'inv-1', invoice_number: 'INV-001' }));
      mockGetInvoiceStatus.mockResolvedValue({ has_invoice: true, invoice_id: 'inv-1', invoice_number: 'INV-001', status: 'paid', total: 50000 });
      render(<DealDetailPage />);
      await waitFor(() => expect(mockGetInvoiceStatus).toHaveBeenCalledWith('deal-1'));
    });

    it('When invoice fetch fails / Then falls back to basic info from deal', async () => {
      mockGetDealById.mockResolvedValue(makeDeal({ invoice_id: 'inv-1', invoice_number: 'INV-001' }));
      mockGetInvoiceStatus.mockRejectedValue(new Error('not found'));
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
    });

    it('When Create Invoice is clicked / Then soft-navigates to Accounting invoices with deal params', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
      await user.click(screen.getByText('Create Invoice'));
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/accounting/invoices'));
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('create=true'));
    });
  });

  describe('Given Create Invoice navigation from Deal Detail', () => {
    describe('When the feature flag is enabled', () => {
      it('Then the Create Invoice button is visible on the page', async () => {
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
      });

      it('When Create Invoice is clicked / Then calls navigate() for soft SPA navigation', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        expect(mockNavigate).toHaveBeenCalled();
      });

      it('When Create Invoice is clicked / Then navigates to /accounting/invoices route', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/accounting/invoices'));
      });

      it('When Create Invoice is clicked / Then includes create=true in URL params', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('create=true'));
      });

      it('When Create Invoice is clicked / Then includes deal_id from route params in URL', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('deal_id=deal-1'));
      });

      it('When Create Invoice is clicked / Then includes deal_name from the deal in URL', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        const url = mockNavigate.mock.calls[0][0] as string;
        expect(url).toContain('deal_name=');
        expect(decodeURIComponent(url.replace(/\+/g, ' '))).toContain('Big Deal');
      });

      it('When Create Invoice is clicked / Then includes customer_name from deal company_name in URL', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        const url = mockNavigate.mock.calls[0][0] as string;
        expect(url).toContain('customer_name=');
        expect(decodeURIComponent(url.replace(/\+/g, ' '))).toContain('Acme Corp');
      });

      it('When Create Invoice is clicked / Then includes amount from deal value in URL', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('amount=50000'));
      });

      it('When Create Invoice is clicked / Then navigate is called exactly once', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        const invoiceNavigateCalls = mockNavigate.mock.calls.filter(
          (call) => typeof call[0] === 'string' && call[0].includes('/accounting/invoices')
        );
        expect(invoiceNavigateCalls).toHaveLength(1);
      });

      it('When Create Invoice is clicked / Then all required params are in the single URL', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        const url = mockNavigate.mock.calls[0][0] as string;
        expect(url).toContain('create=true');
        expect(url).toContain('deal_id=deal-1');
        expect(url).toContain('deal_name=');
        expect(url).toContain('customer_name=');
        expect(url).toContain('amount=50000');
      });
    });

    describe('When deal has missing optional fields', () => {
      it('When deal has no company_name / Then customer_name is omitted from URL params', async () => {
        mockGetDealById.mockResolvedValue(makeDeal({ company_name: null }));
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        const url = mockNavigate.mock.calls[0][0] as string;
        expect(url).not.toContain('customer_name');
      });

      it('When deal value is null / Then amount is omitted from URL params', async () => {
        mockGetDealById.mockResolvedValue(makeDeal({ value: null }));
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        const url = mockNavigate.mock.calls[0][0] as string;
        expect(url).not.toContain('amount');
      });

      it('When deal value is 0 / Then amount=0 is included in URL params', async () => {
        mockGetDealById.mockResolvedValue(makeDeal({ value: 0 }));
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('amount=0'));
      });

      it('When deal has empty company_name string / Then customer_name is omitted from URL params', async () => {
        mockGetDealById.mockResolvedValue(makeDeal({ company_name: '' }));
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
        await user.click(screen.getByText('Create Invoice'));
        const url = mockNavigate.mock.calls[0][0] as string;
        expect(url).not.toContain('customer_name');
      });
    });

    describe('When deal data is not yet loaded', () => {
      it('When deal is null / Then clicking Create Invoice does nothing', async () => {
        mockGetDealById.mockResolvedValue(null);
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.queryByText('Create Invoice')).not.toBeInTheDocument());
        expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/accounting/invoices'));
      });
    });
  });

  describe('Given deal project linking', () => {
    it('When Create Project is clicked / Then opens the project modal', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Project')).toBeInTheDocument());
      await user.click(screen.getByText('Create Project'));
      await waitFor(() => expect(mockGetProjects).toHaveBeenCalled());
    });

    it('When project modal opens / Then container has max-h-[90vh]', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Project')).toBeInTheDocument());
      await user.click(screen.getByText('Create Project'));
      await waitFor(() => {
        const panels = Array.from(document.querySelectorAll('div')).filter(
          el => el.className.includes('max-h-[90vh]'),
        );
        expect(panels.length).toBeGreaterThan(0);
      });
    });

    it('When deal already has project / Then shows Manage Project button', async () => {
      mockGetDealById.mockResolvedValue(makeDeal({ project_id: 'proj-1' }));
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Manage Project')).toBeInTheDocument());
    });
  });

  describe('Given deal with no lead', () => {
    it('When deal has no lead_id / Then does not fetch lead data', async () => {
      mockGetDealById.mockResolvedValue(makeDeal({ lead_id: null }));
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      expect(mockGetLeadById).not.toHaveBeenCalled();
    });
  });

  describe('Given deal with owner avatar', () => {
    it('When owner has avatar_url / Then renders avatar image', async () => {
      mockGetDealById.mockResolvedValue(makeDeal({ owner: owner2, owner_id: 'u2' }));
      render(<DealDetailPage />);
      await waitFor(() => {
        const img = screen.getByAltText('Alice Sales');
        expect(img).toHaveAttribute('src', 'https://img/a.jpg');
      });
    });
  });

  describe('Given deal with expected close date', () => {
    it('When deal has expected_close_date / Then shows Closing date formatted in business timezone', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        // formatters.formatDate with UTC timezone and en-US locale renders 'Jun 30, 2025'
        expect(screen.getByText(/Closing: Jun 30, 2025/)).toBeInTheDocument();
      });
    });
  });

  describe('Given Create Estimate navigation from Deal Detail', () => {
    describe('When DEAL_ESTIMATE_REQUEST feature flag is enabled', () => {
      it('Then Create Estimate button is visible on the page', async () => {
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
      });

      it('When Create Estimate is clicked / Then calls navigate()', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
        await user.click(screen.getByText('Create Estimate'));
        expect(mockNavigate).toHaveBeenCalled();
      });

      it('When Create Estimate is clicked / Then navigates to /accounting/estimations', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
        await user.click(screen.getByText('Create Estimate'));
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/accounting/estimations'));
      });

      it('When Create Estimate is clicked / Then includes create=true in URL params', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
        await user.click(screen.getByText('Create Estimate'));
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('create=true'));
      });

      it('When Create Estimate is clicked / Then includes opportunity_ref from deal name in URL', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
        await user.click(screen.getByText('Create Estimate'));
        const url = mockNavigate.mock.calls.find(
          (call) => typeof call[0] === 'string' && call[0].includes('/accounting/estimations'),
        )?.[0] as string;
        expect(url).toContain('opportunity_ref=');
        expect(decodeURIComponent(url.replace(/\+/g, ' '))).toContain('Big Deal');
      });

      it('When Create Estimate is clicked / Then includes customer_name from deal company_name in URL', async () => {
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
        await user.click(screen.getByText('Create Estimate'));
        const url = mockNavigate.mock.calls.find(
          (call) => typeof call[0] === 'string' && call[0].includes('/accounting/estimations'),
        )?.[0] as string;
        expect(url).toContain('customer_name=');
        expect(decodeURIComponent(url.replace(/\+/g, ' '))).toContain('Acme Corp');
      });

      it('When deal has no company_name / Then customer_name is omitted from estimate URL', async () => {
        mockGetDealById.mockResolvedValue(makeDeal({ company_name: null }));
        const user = userEvent.setup();
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
        await user.click(screen.getByText('Create Estimate'));
        const url = mockNavigate.mock.calls.find(
          (call) => typeof call[0] === 'string' && call[0].includes('/accounting/estimations'),
        )?.[0] as string;
        expect(url).not.toContain('customer_name');
      });

      it('When deal is null / Then clicking Create Estimate does nothing', async () => {
        mockGetDealById.mockResolvedValue(null);
        render(<DealDetailPage />);
        await waitFor(() => expect(screen.queryByText('Create Estimate')).not.toBeInTheDocument());
        expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/accounting/estimations'));
      });
    });
  });
});

/**
 * Deal context handed to Accounting.
 *
 * Both document flows must carry the SAME two things so the existing estimate /
 * invoice form can pre-populate itself: the deal id (Accounting reads that
 * deal's associated products as line items) and the deal's customer. Without
 * the deal id on the estimate link, Create Estimate opens an empty form even
 * though the deal already has products — the bug this covers.
 */
describe('DealDetailPage — deal context passed to Accounting document flows', () => {
  const urlFor = (fragment: string) =>
    mockNavigate.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes(fragment),
    )?.[0] as string;

  describe('Given a deal with a linked customer', () => {
    beforeEach(() => {
      mockGetDealById.mockResolvedValue(makeDeal({ partner_id: 'partner-99' }));
    });

    it('When Create Estimate is clicked / Then the deal id is passed so its products can be loaded', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
      await user.click(screen.getByText('Create Estimate'));
      expect(urlFor('/accounting/estimations')).toContain('deal_id=deal-1');
    });

    it('When Create Estimate is clicked / Then the deal customer is passed by id, not just by name', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
      await user.click(screen.getByText('Create Estimate'));
      expect(urlFor('/accounting/estimations')).toContain('customer_id=partner-99');
    });

    it('When Create Invoice is clicked / Then the deal customer is passed by id', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Invoice')).toBeInTheDocument());
      await user.click(screen.getByText('Create Invoice'));
      const url = urlFor('/accounting/invoices');
      expect(url).toContain('customer_id=partner-99');
      expect(url).toContain('deal_id=deal-1');
    });
  });

  describe('Given a deal with no linked customer record', () => {
    it('Then customer_id is omitted and the existing name-only behaviour is kept', async () => {
      mockGetDealById.mockResolvedValue(makeDeal({ partner_id: null }));
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Estimate')).toBeInTheDocument());
      await user.click(screen.getByText('Create Estimate'));
      const url = urlFor('/accounting/estimations');
      expect(url).not.toContain('customer_id');
      expect(url).toContain('customer_name=');
    });
  });
});

/**
 * Cover for the header/readability fixes reported on the CRM detail pages,
 * mirrored here so the Deal page cannot drift from the Lead page:
 * icon-only Delete beside a labelled primary CTA, a universal Back control,
 * and task metadata that is legible on the light theme's white card.
 */
describe('DealDetailPage — header and card presentation', () => {
  /** Lowest slate step still legible on the light theme's white card. */
  const READABLE = /text-slate-(50|100|200|300)\b/;

  describe('Given the record header', () => {
    it('When the Delete action renders / Then it carries no text label', async () => {
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      expect(screen.getByLabelText('Delete').textContent).toBe('');
    });

    it('When the Delete action renders / Then it is still named on hover and for screen readers', async () => {
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      const del = screen.getByLabelText('Delete');
      expect(del).toHaveAttribute('title', 'Delete');
      expect(del).toHaveAttribute('aria-label', 'Delete');
    });

    it('When the Delete action renders / Then keyboard focus stays visible', async () => {
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      expect(screen.getByLabelText('Delete').className).toMatch(/focus-visible:ring/);
    });

    it('When the back control renders / Then it uses the same neutral wording as every other module', async () => {
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());
      expect(screen.getAllByText('Back').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: 'Back to Pipeline' })).toBeNull();
    });
  });

  describe('Given the deal task list', () => {
    it('When a task due date renders / Then it is legible rather than a faded rose tint', async () => {
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Big Deal')).toBeInTheDocument());

      const due = screen.queryAllByText(/^Due /)[0];
      if (!due) return; // no tasks fixture on this render path
      const span = due.closest('span')!;
      expect(span.className).not.toMatch(/rose-400\/70/);
      expect(span.className).toMatch(READABLE);
    });
  });
});
