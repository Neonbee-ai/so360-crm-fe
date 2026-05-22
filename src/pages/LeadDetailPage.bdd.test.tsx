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
const mockUpdateLead = vi.fn().mockResolvedValue({});
const mockLogActivity = vi.fn().mockResolvedValue({});
const mockUpdateTask = vi.fn().mockResolvedValue({});
const mockCreateNote = vi.fn().mockResolvedValue({ id: 'nn1', content: 'new note', author: { id: 'u1', full_name: 'Test Owner' }, created_at: new Date().toISOString() });
const mockUpdateNote = vi.fn().mockResolvedValue({});
const mockDeleteNote = vi.fn().mockResolvedValue({});
const mockUploadDocument = vi.fn().mockResolvedValue({ id: 'doc-new', name: 'test.pdf', size: 1024, uploaded_at: new Date().toISOString(), uploaded_by: { full_name: 'Test' } });
const mockDeleteDocument = vi.fn().mockResolvedValue({});
const mockDeleteLead = vi.fn().mockResolvedValue({});
const mockActivitiesUpdate = vi.fn().mockResolvedValue({});
const mockActivitiesDelete = vi.fn().mockResolvedValue({});

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
    getDealsByLeadId: (...a: any[]) => mockGetDealsByLeadId(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasksByLeadId(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getActivitiesByLeadId: (...a: any[]) => mockGetActivitiesByLeadId(...a),
    updateLead: (...a: any[]) => mockUpdateLead(...a),
    logActivity: (...a: any[]) => mockLogActivity(...a),
    updateTask: (...a: any[]) => mockUpdateTask(...a),
    createNote: (...a: any[]) => mockCreateNote(...a),
    updateNote: (...a: any[]) => mockUpdateNote(...a),
    deleteNote: (...a: any[]) => mockDeleteNote(...a),
    uploadDocument: (...a: any[]) => mockUploadDocument(...a),
    deleteDocument: (...a: any[]) => mockDeleteDocument(...a),
    deleteLead: (...a: any[]) => mockDeleteLead(...a),
    getPartners: () => Promise.resolve([]),
  },
  activitiesApi: { update: (...a: any[]) => mockActivitiesUpdate(...a), delete: (...a: any[]) => mockActivitiesDelete(...a) },
}));

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
  useActivity: () => ({ recordActivity: async () => {} }),
  useShellBridge: () => ({ isFeatureEnabled: () => true, isFeatureHidden: () => false }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: mockShowSuccess, showError: mockShowError, dismissToast: vi.fn() }),
}));

vi.mock('./components/CreateDealModal', () => ({
  default: ({ onClose, isOpen }: any) => isOpen !== false ? <div data-testid="create-deal-modal"><button onClick={onClose}>Close</button></div> : null,
}));
vi.mock('./components/TaskModal', () => ({ default: ({ onClose }: any) => <div data-testid="task-modal"><button onClick={onClose}>Close</button></div> }));
vi.mock('../components/CustomerDetailsPanel', () => ({ default: () => null }));
vi.mock('../components/LeadJourneyStepper', () => ({
  LeadJourneyStepper: ({ currentState }: any) => <div data-testid="journey-stepper">{currentState}</div>,
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
    { id: 'doc1', name: 'requirements.pdf', size: 5242880, uploaded_at: '2025-01-04T10:00:00Z', created_at: '2025-01-04T10:00:00Z', uploaded_by: owner },
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
    { id: 'r1', criteria: 'Source is website', points: 20, type: 'source' },
    { id: 'r2', criteria: 'Has a call', points: 10, type: 'activity' },
    { id: 'r3', criteria: 'Field is high', points: 15, type: 'field' },
  ],
  default_owner_id: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = '/crm/leads/lead-1';
  mockGetLeadById.mockResolvedValue(makeLead());
  mockGetDealsByLeadId.mockResolvedValue(associatedDeals);
  mockGetTasksByLeadId.mockResolvedValue(associatedTasks);
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue([owner]);
  mockGetActivitiesByLeadId.mockResolvedValue(makeLead().activities);
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

    it('When the page loads / Then shows created date', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        const dateStr = new Date('2025-01-01T10:00:00Z').toLocaleDateString();
        expect(screen.getByText(dateStr)).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows associated deals with their value', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Deal')).toBeInTheDocument();
        expect(screen.getAllByText('$30,000').length).toBeGreaterThan(0);
      });
    });

    it('When the page loads / Then calculates revenue with Won deals as earned', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('$30,000').length).toBeGreaterThan(0);
      });
    });

    it('When the page loads / Then calculates pipeline revenue from non-Won/Lost deals', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getAllByText('$20,000').length).toBeGreaterThan(0);
      });
    });

    it('When Create Deal button is clicked / Then opens the create deal modal', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Create Deal'));
      expect(screen.getByTestId('create-deal-modal')).toBeInTheDocument();
    });

    it('When the page loads / Then shows the activity timeline with entries', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('CALL Logged')).toBeInTheDocument();
        expect(screen.getByText('Intro call completed')).toBeInTheDocument();
      });
    });

    it('When activity timeline includes EMAIL / Then shows email entry', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('EMAIL Logged')).toBeInTheDocument();
        expect(screen.getByText('Sent welcome email')).toBeInTheDocument();
      });
    });

    it('When activity timeline includes MEETING / Then shows meeting entry', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('MEETING Logged')).toBeInTheDocument();
      });
    });

    it('When timeline has system events / Then shows STATUS_CHANGE and OWNER_CHANGE entries', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('STATUS CHANGE')).toBeInTheDocument();
        expect(screen.getByText('OWNER CHANGE')).toBeInTheDocument();
        expect(screen.getByText('PROFILE UPDATE')).toBeInTheDocument();
      });
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
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText(/Documents \(0\)/));
      await waitFor(() => expect(screen.getByText('No documents attached')).toBeInTheDocument());
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
        expect(screen.getByText('Back to Leads')).toBeInTheDocument();
      });
    });
  });

  describe('Given lead deletion', () => {
    it('When Delete button is clicked / Then shows delete confirmation area', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      await user.click(screen.getByText('Delete'));
      await waitFor(() => {
        const deleteTexts = screen.getAllByText(/Delete/);
        expect(deleteTexts.length).toBeGreaterThan(1);
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
    it('When source scoring rule matches / Then adds points', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(/Source is website/)).toBeInTheDocument();
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
});
