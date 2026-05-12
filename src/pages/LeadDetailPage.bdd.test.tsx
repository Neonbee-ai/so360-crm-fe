import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetLeadById = vi.fn();
const mockGetDealsByLeadId = vi.fn();
const mockGetTasksByLeadId = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetActivitiesByLeadId = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
    getDealsByLeadId: (...a: any[]) => mockGetDealsByLeadId(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasksByLeadId(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getActivitiesByLeadId: (...a: any[]) => mockGetActivitiesByLeadId(...a),
    updateLead: vi.fn().mockResolvedValue({}),
    logActivity: vi.fn().mockResolvedValue({}),
    updateTask: vi.fn().mockResolvedValue({}),
    createNote: vi.fn().mockResolvedValue({ id: 'nn1', content: 'new note', author: { id: 'u1', full_name: 'Test' }, created_at: new Date().toISOString() }),
    updateNote: vi.fn().mockResolvedValue({}),
    deleteNote: vi.fn().mockResolvedValue({}),
    uploadDocument: vi.fn().mockResolvedValue({}),
    deleteDocument: vi.fn().mockResolvedValue({}),
    deleteLead: vi.fn().mockResolvedValue({}),
  },
  activitiesApi: { update: vi.fn(), delete: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'lead-1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/crm/leads/lead-1', search: '' }),
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@so360/shell-context', () => ({
  useShell: () => ({ isModuleEnabled: () => false }),
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: vi.fn(), showError: vi.fn(), dismissToast: vi.fn() }),
}));

vi.mock('./components/CreateDealModal', () => ({ default: ({ onClose }: any) => <div data-testid="create-deal-modal"><button onClick={onClose}>Close</button></div> }));
vi.mock('./components/TaskModal', () => ({ default: () => null }));
vi.mock('../components/CustomerDetailsPanel', () => ({ default: () => null }));
vi.mock('../components/LeadJourneyStepper', () => ({
  LeadJourneyStepper: ({ currentState }: any) => <div data-testid="journey-stepper">{currentState}</div>,
}));

import LeadDetailPage from './LeadDetailPage';

const owner = { id: 'u1', full_name: 'Test Owner', email: 'owner@test.com', avatar_url: null };
const lead = {
  id: 'lead-1',
  company_name: 'Acme Corp',
  contact_name: 'John Doe',
  contact_email: 'john@acme.com',
  phone: '555-1234',
  source: 'Website',
  status: 'Open',
  current_flow_state: 'new',
  owner,
  created_at: '2025-01-01T10:00:00Z',
  activities: [
    { id: 'a1', type: 'CALL', notes: 'Intro call completed', date: '2025-01-05T10:00:00Z', created_at: '2025-01-05T10:00:00Z', author: owner },
  ],
  notes: [
    { id: 'n1', content: 'Hot lead from conference', author: owner, created_at: '2025-01-02T10:00:00Z' },
  ],
  documents: [],
  custom_fields: {},
};

const associatedDeals = [
  { id: 'd1', name: 'Acme Deal', value: 30000, stage: 'Qualified', created_at: '2025-01-10T10:00:00Z', expected_close_date: '2025-03-01', owner },
];

const settings = {
  deal_stages: [],
  lead_stages: [{ id: 'ls1', name: 'Open' }, { id: 'ls2', name: 'Qualified' }],
  lead_custom_fields: [],
  deal_custom_fields: [],
  lead_sources: [],
  lead_scoring: [{ id: 'r1', criteria: 'Source is Website', points: 20, type: 'source' }],
  default_owner_id: 'u1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLeadById.mockResolvedValue(lead);
  mockGetDealsByLeadId.mockResolvedValue(associatedDeals);
  mockGetTasksByLeadId.mockResolvedValue([]);
  mockGetSettings.mockResolvedValue(settings);
  mockGetUsers.mockResolvedValue([owner]);
  mockGetActivitiesByLeadId.mockResolvedValue(lead.activities);
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

    it('When the page loads / Then shows the email and phone in profile', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('john@acme.com')).toBeInTheDocument();
        expect(screen.getByText('555-1234')).toBeInTheDocument();
      });
    });

    it('When the page loads / Then shows associated deals with their value', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('Acme Deal')).toBeInTheDocument();
        expect(screen.getAllByText('$30,000').length).toBeGreaterThan(0);
      });
    });

    it('When Create Deal button is clicked / Then opens the create deal modal', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('Create Deal')).toBeInTheDocument());
      await user.click(screen.getByText('Create Deal'));
      expect(screen.getByTestId('create-deal-modal')).toBeInTheDocument();
    });

    it('When the page loads / Then shows the activity timeline with a CALL entry', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => {
        expect(screen.getByText('CALL Logged')).toBeInTheDocument();
        expect(screen.getByText('Intro call completed')).toBeInTheDocument();
      });
    });

    it('When switching to notes tab / Then shows existing notes', async () => {
      const user = userEvent.setup();
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      const notesTab = screen.getByText('Notes');
      await user.click(notesTab);
      await waitFor(() => {
        expect(screen.getByText('Hot lead from conference')).toBeInTheDocument();
      });
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
  });
});
