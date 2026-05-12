import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    logActivity: vi.fn().mockResolvedValue({}),
    updateTask: vi.fn().mockResolvedValue({}),
    createNote: vi.fn().mockResolvedValue({}),
    updateNote: vi.fn().mockResolvedValue({}),
    deleteNote: vi.fn().mockResolvedValue({}),
    uploadDocument: vi.fn().mockResolvedValue({}),
    deleteDocument: vi.fn().mockResolvedValue({}),
    requestInvoice: vi.fn().mockResolvedValue({}),
    getProjects: vi.fn().mockResolvedValue([]),
    createProjectFromDeal: vi.fn().mockResolvedValue({ id: 'p1' }),
    linkProject: vi.fn().mockResolvedValue({}),
    unlinkProject: vi.fn().mockResolvedValue({}),
    deleteDeal: vi.fn().mockResolvedValue({}),
  },
  dealsApi: { update: vi.fn().mockResolvedValue({}) },
  tasksApi: { delete: vi.fn().mockResolvedValue({}) },
  activitiesApi: { update: vi.fn(), delete: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'deal-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('./components/TaskModal', () => ({ default: () => null }));

vi.mock('../config/features', () => ({
  FEATURES: { DEAL_INVOICE_REQUEST: true, DEAL_PROJECT_CREATION: true },
}));

vi.mock('../components/DealLifecycleStepper', () => ({
  DealLifecycleStepper: ({ currentState }: any) => <div data-testid="lifecycle-stepper">{currentState}</div>,
}));

import DealDetailPage from './DealDetailPage';

const owner = { id: 'u1', full_name: 'Test Owner', email: 'owner@test.com', avatar_url: null };
const deal = {
  id: 'deal-1',
  name: 'Big Deal',
  company_name: 'Acme Corp',
  value: 50000,
  expected_close_date: '2025-06-30',
  stage: 'Qualified',
  stage_id: 'qualified',
  current_flow_state: 'qualified',
  owner,
  owner_id: 'u1',
  lead_id: 'lead-1',
  project_id: null,
  invoice_id: null,
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
};

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
];

const settings = {
  deal_stages: [{ id: 'new', name: 'New' }, { id: 'qualified', name: 'Qualified' }, { id: 'won', name: 'Won' }],
  lead_stages: [],
  lead_custom_fields: [],
  deal_custom_fields: [],
  lead_sources: [],
  lead_scoring: [],
  default_owner_id: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDealById.mockResolvedValue(deal);
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue([owner]);
  mockGetTasksByDealId.mockResolvedValue(tasks);
  mockGetActivitiesByDealId.mockResolvedValue(activities);
  mockGetNotesByDealId.mockResolvedValue(deal.notes);
  mockGetDocumentsByDealId.mockResolvedValue(deal.documents);
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
  });
});
