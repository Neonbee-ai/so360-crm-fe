import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: mockShowSuccess, showError: mockShowError, dismissToast: vi.fn() }),
}));

vi.mock('./components/TaskModal', () => ({ default: ({ onClose }: any) => <div data-testid="task-modal"><button onClick={onClose}>Close</button></div> }));

vi.mock('../config/features', () => ({
  FEATURES: { DEAL_INVOICE_REQUEST: true, DEAL_PROJECT_CREATION: true },
}));

vi.mock('../components/DealLifecycleStepper', () => ({
  DealLifecycleStepper: ({ currentState }: any) => <div data-testid="lifecycle-stepper">{currentState}</div>,
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
  { id: 't1', title: 'Follow up call', status: 'Open', type: 'CALL', due_date: '2025-02-01', created_at: '2025-01-20T10:00:00Z', assigned_to: owner },
  { id: 't2', title: 'Send proposal', status: 'Done', type: 'TODO', due_date: '2025-01-15', created_at: '2025-01-10T10:00:00Z', assigned_to: owner },
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
        expect(screen.getByText('50,000')).toBeInTheDocument();
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

    it('When the page loads / Then shows last activity date', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        const dateStr = new Date('2025-01-20T10:00:00Z').toLocaleDateString();
        expect(screen.getByText(dateStr)).toBeInTheDocument();
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
      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith('t1', { status: 'Done' }));
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
        expect(screen.getByText('Back to Pipeline')).toBeInTheDocument();
      });
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
      await user.click(screen.getByText('Delete'));
      await waitFor(() => {
        const confirmTexts = screen.getAllByText(/Delete/);
        expect(confirmTexts.length).toBeGreaterThan(1);
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

    it('When Request Invoice is clicked / Then calls requestInvoice API', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Request Invoice')).toBeInTheDocument());
      await user.click(screen.getByText('Request Invoice'));
      await waitFor(() => expect(mockRequestInvoice).toHaveBeenCalledWith('deal-1'));
    });
  });

  describe('Given deal project linking', () => {
    it('When Link Project is clicked / Then opens the project modal', async () => {
      const user = userEvent.setup();
      render(<DealDetailPage />);
      await waitFor(() => expect(screen.getByText('Link Project')).toBeInTheDocument());
      await user.click(screen.getByText('Link Project'));
      await waitFor(() => expect(mockGetProjects).toHaveBeenCalled());
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
    it('When deal has expected_close_date / Then shows Closing date', async () => {
      render(<DealDetailPage />);
      await waitFor(() => {
        const dateText = new Date('2025-06-30').toLocaleDateString();
        expect(screen.getByText(new RegExp(`Closing: ${dateText}`))).toBeInTheDocument();
      });
    });
  });
});
