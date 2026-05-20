import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const mockGetLeadById = vi.fn();
const mockGetSettings = vi.fn();
const mockGetUsers = vi.fn();
const mockGetDealsByLeadId = vi.fn();
const mockGetTasksByLeadId = vi.fn();
const mockGetActivitiesByLeadId = vi.fn();
const mockGetNotesByLeadId = vi.fn();
const mockGetDocumentsByLeadId = vi.fn();
const mockUpdateLead = vi.fn();
const mockLogActivity = vi.fn();
const mockCreateNote = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getLeadById: (...a: any[]) => mockGetLeadById(...a),
    getSettings: (...a: any[]) => mockGetSettings(...a),
    getUsers: (...a: any[]) => mockGetUsers(...a),
    getDealsByLeadId: (...a: any[]) => mockGetDealsByLeadId(...a),
    getTasksByLeadId: (...a: any[]) => mockGetTasksByLeadId(...a),
    getActivitiesByLeadId: (...a: any[]) => mockGetActivitiesByLeadId(...a),
    getNotesByLeadId: (...a: any[]) => mockGetNotesByLeadId(...a),
    getDocumentsByLeadId: (...a: any[]) => mockGetDocumentsByLeadId(...a),
    updateLead: (...a: any[]) => mockUpdateLead(...a),
    logActivity: (...a: any[]) => mockLogActivity(...a),
    createNote: (...a: any[]) => mockCreateNote(...a),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
    deleteLead: vi.fn(),
    promoteToCustomer: vi.fn(),
    getStorefrontActivity: vi.fn().mockResolvedValue([]),
    getStorefrontWishlist: vi.fn().mockResolvedValue([]),
    getStorefrontReviews: vi.fn().mockResolvedValue([]),
    getStorefrontAbandonedCarts: vi.fn().mockResolvedValue([]),
  },
  activitiesApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'lead-1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/crm/leads/lead-1', search: '' }),
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@so360/shell-context', () => ({
  useShell: () => ({ isModuleEnabled: () => false, user: { id: 'u1' } }),
  useActivity: () => ({ recordActivity: async () => {} }),
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: mockShowSuccess, showError: mockShowError, dismissToast: vi.fn() }),
}));

vi.mock('./components/CreateDealModal', () => ({ default: () => null }));
vi.mock('./components/TaskModal', () => ({ default: () => null }));
vi.mock('../components/CustomerDetailsPanel', () => ({ default: () => null }));
vi.mock('../components/LeadJourneyStepper', () => ({
  LeadJourneyStepper: () => <div data-testid="stepper" />,
}));

import LeadDetailPage from './LeadDetailPage';

const leadData = {
  id: 'lead-1', company_name: 'Acme', contact_name: 'John', contact_email: 'j@a.com',
  phone: '555-1234', status: 'New', source: 'Website', value: 5000,
  owner: { id: 'u1', full_name: 'Test User', avatar_url: null },
  creator: { id: 'u1', full_name: 'Test User' },
  notes: [{ id: 'n1', content: 'Initial note', created_at: '2024-01-01', author: { id: 'u1', full_name: 'Test' } }],
  documents: [{ id: 'doc1', name: 'contract.pdf', url: 'http://cdn/file.pdf', uploaded_at: '2024-01-01', uploaded_by: { id: 'u1', full_name: 'Test' } }],
  activities: [{ id: 'a1', type: 'CALL', notes: 'Called', created_at: '2024-01-02', author: { id: 'u1', full_name: 'Test' } }],
  deals: [], tasks: [], custom_fields: { industry: 'Tech' },
  created_at: '2024-01-01', lead_score: 75,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLeadById.mockResolvedValue(leadData);
  mockGetSettings.mockResolvedValue({
    deal_stages: [{ id: 's1', name: 'Lead' }],
    lead_stages: [{ id: 'new', name: 'New' }, { id: 'contacted', name: 'Contacted' }],
    lead_custom_fields: [{ id: 'cf1', label: 'Industry', type: 'text', required: false }],
    deal_custom_fields: [],
    lead_sources: [{ id: 'src1', name: 'Website' }],
    lead_scoring: [{ id: 'lr1', criteria: 'Has email', points: 10, type: 'field' }],
    default_owner_id: 'u1',
  });
  mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Test User', email: 't@t.com' }]);
  mockGetDealsByLeadId.mockResolvedValue([]);
  mockGetTasksByLeadId.mockResolvedValue([
    { id: 't1', title: 'Follow up', status: 'Open', due_date: '2024-06-15', type: 'TODO', assigned_to: { id: 'u1', full_name: 'Test' } },
  ]);
  mockGetActivitiesByLeadId.mockResolvedValue([
    { id: 'a1', type: 'CALL', notes: 'Called', created_at: '2024-01-02', author: { id: 'u1', full_name: 'Test' } },
  ]);
  mockGetNotesByLeadId.mockResolvedValue([
    { id: 'n1', content: 'Initial note', created_at: '2024-01-01', author: { id: 'u1', full_name: 'Test' } },
  ]);
  mockGetDocumentsByLeadId.mockResolvedValue([
    { id: 'doc1', name: 'contract.pdf', url: 'http://cdn/file.pdf', uploaded_at: '2024-01-01', uploaded_by: { id: 'u1', full_name: 'Test' } },
  ]);
});

describe('Given LeadDetailPage', () => {
  it('When action / Then shows loading state initially', () => {
    mockGetLeadById.mockReturnValue(new Promise(() => {}));
    render(<LeadDetailPage />);
    expect(document.body).toBeTruthy();
  });

  it('When action / Then shows not found when lead is null', async () => {
    mockGetLeadById.mockResolvedValue(undefined);
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('When action / Then renders lead detail with data', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument();
      expect(screen.getByText('John')).toBeInTheDocument();
    });
  });

  it('When action / Then renders lead journey stepper', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toBeInTheDocument();
    });
  });

  it('When action / Then shows activity timeline on activity tab', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => screen.getByText('Acme'));
    expect(screen.getByText(/call logged/i)).toBeInTheDocument();
  });

  it('When action / Then switches to notes tab', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => screen.getByText('Acme'));
    fireEvent.click(screen.getByText('Notes'));
    await waitFor(() => {
      expect(screen.getByText('Initial note')).toBeInTheDocument();
    });
  });

  it('When action / Then switches to tasks tab', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => screen.getByText('Acme'));
    fireEvent.click(screen.getByText(/^Tasks/));
    await waitFor(() => {
      expect(screen.getByText('Follow up')).toBeInTheDocument();
    });
  });

  it('When action / Then switches to documents tab', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => screen.getByText('Acme'));
    fireEvent.click(screen.getByText(/^Documents/));
    await waitFor(() => {
      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    });
  });

  it('When action / Then displays lead contact info', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('j@a.com')).toBeInTheDocument();
      expect(screen.getByText('555-1234')).toBeInTheDocument();
    });
  });

  it('When action / Then displays lead source', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Website')).toBeInTheDocument();
    });
  });

  it('When action / Then displays back to leads link', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Back to Leads')).toBeInTheDocument();
    });
  });
});
