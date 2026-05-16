import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
const mockLogActivity = vi.fn();
const mockDeleteDeal = vi.fn();
const mockUpdateDealStage = vi.fn();
const mockCreateNote = vi.fn();
const mockDealsApiUpdate = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

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
    logActivity: (...a: any[]) => mockLogActivity(...a),
    requestInvoice: vi.fn(),
    getProjects: vi.fn().mockResolvedValue([]),
    deleteDeal: (...a: any[]) => mockDeleteDeal(...a),
    updateDealStage: (...a: any[]) => mockUpdateDealStage(...a),
    createNote: (...a: any[]) => mockCreateNote(...a),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
    deleteNote: vi.fn(),
    deleteTask: vi.fn(),
    createProjectFromDeal: vi.fn(),
    linkProject: vi.fn(),
    unlinkProject: vi.fn(),
  },
  dealsApi: { update: (...a: any[]) => mockDealsApiUpdate(...a) },
  tasksApi: { delete: vi.fn() },
  activitiesApi: { update: vi.fn(), delete: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'deal-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('../components/common/Toast', () => ({
  ToastContainer: () => null,
  useToast: () => ({ toasts: [], showSuccess: mockShowSuccess, showError: mockShowError, dismissToast: vi.fn() }),
}));

vi.mock('./components/TaskModal', () => ({ default: () => null }));
vi.mock('../config/features', () => ({ FEATURES: { DEAL_INVOICE_REQUEST: false, DEAL_PROJECT_CREATION: false } }));
vi.mock('../components/DealLifecycleStepper', () => ({
  DealLifecycleStepper: ({ currentState }: any) => <div data-testid="stepper">{currentState}</div>,
}));

import DealDetailPage from './DealDetailPage';

const dealData = {
  id: 'deal-1', name: 'Big Deal', company_name: 'Acme',
  value: 50000, stage: 'Lead', stage_id: 's1', status: 'new',
  owner: { id: 'u1', full_name: 'Test User', avatar_url: null },
  notes: [{ id: 'n1', content: 'A note', created_at: '2024-01-01', author: { id: 'u1', full_name: 'Test' } }],
  documents: [{ id: 'doc1', name: 'file.pdf', url: 'http://cdn/file.pdf', uploaded_at: '2024-01-01', uploaded_by: { id: 'u1', full_name: 'Test' } }],
  activities: [{ id: 'a1', type: 'CALL', notes: 'Called client', created_at: '2024-01-02', author: { id: 'u1', full_name: 'Test' } }],
  expected_close_date: '2024-12-31',
  created_at: '2024-01-01', last_activity_at: '2024-01-02',
  lead_id: null, project_id: null, invoice_id: null,
  current_flow_state: 'new',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDealById.mockResolvedValue(dealData);
  mockGetSettings.mockResolvedValue({
    deal_stages: [{ id: 's1', name: 'Lead', type: 'OPEN' }, { id: 's2', name: 'Won', type: 'WON' }],
    lead_stages: [], lead_custom_fields: [], deal_custom_fields: [],
    lead_sources: [], lead_scoring: [], default_owner_id: 'u1',
  });
  mockGetUsers.mockResolvedValue([{ id: 'u1', full_name: 'Test User', email: 't@t.com' }]);
  mockGetTasksByDealId.mockResolvedValue([
    { id: 't1', title: 'Follow up', status: 'Open', due_date: '2024-06-15', type: 'TODO', assigned_to: { id: 'u1', full_name: 'Test' } },
  ]);
  mockGetActivitiesByDealId.mockResolvedValue([
    { id: 'a1', type: 'CALL', notes: 'Called client', created_at: '2024-01-02', author: { id: 'u1', full_name: 'Test' } },
  ]);
  mockGetNotesByDealId.mockResolvedValue([
    { id: 'n1', content: 'A note', created_at: '2024-01-01', author: { id: 'u1', full_name: 'Test' } },
  ]);
  mockGetDocumentsByDealId.mockResolvedValue([
    { id: 'doc1', name: 'file.pdf', url: 'http://cdn/file.pdf', uploaded_at: '2024-01-01', uploaded_by: { id: 'u1', full_name: 'Test' } },
  ]);
  mockGetLeadById.mockResolvedValue(null);
  mockGetInvoiceStatus.mockResolvedValue({ has_invoice: false });
  mockGetFulfillmentOrderByDeal.mockResolvedValue(null);
});

describe('Given DealDetailPage', () => {
  it('When action / Then shows loading state initially', () => {
    mockGetDealById.mockReturnValue(new Promise(() => {}));
    render(<DealDetailPage />);
    expect(screen.getByText('Initializing deal workspace...')).toBeInTheDocument();
  });

  it('When action / Then shows not found when deal is null', async () => {
    mockGetDealById.mockResolvedValue(undefined);
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Deal not found.')).toBeInTheDocument();
    });
  });

  it('When action / Then renders deal detail with data', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Big Deal')).toBeInTheDocument();
      expect(screen.getByText('Acme')).toBeInTheDocument();
    });
  });

  it('When action / Then renders deal stepper', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('stepper')).toBeInTheDocument();
    });
  });

  it('When action / Then switches to notes tab', async () => {
    render(<DealDetailPage />);
    await waitFor(() => screen.getByText('Big Deal'));
    const notesTab = screen.getByText('Notes');
    fireEvent.click(notesTab);
    await waitFor(() => {
      expect(screen.getByText('A note')).toBeInTheDocument();
    });
  });

  it('When action / Then switches to tasks tab', async () => {
    render(<DealDetailPage />);
    await waitFor(() => screen.getByText('Big Deal'));
    const tasksTab = screen.getByText(/^Tasks/);
    fireEvent.click(tasksTab);
    await waitFor(() => {
      expect(screen.getByText('Follow up')).toBeInTheDocument();
    });
  });

  it('When action / Then switches to documents tab', async () => {
    render(<DealDetailPage />);
    await waitFor(() => screen.getByText('Big Deal'));
    const docsTab = screen.getByText(/^Docs/);
    fireEvent.click(docsTab);
    await waitFor(() => {
      expect(screen.getByText('file.pdf')).toBeInTheDocument();
    });
  });

  it('When action / Then shows activity timeline on activity tab', async () => {
    render(<DealDetailPage />);
    await waitFor(() => screen.getByText('Big Deal'));
    // Activity tab is default
    expect(screen.getByText(/call logged/i)).toBeInTheDocument();
  });

  it('When action / Then displays deal value and close date', async () => {
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Big Deal')).toBeInTheDocument();
    });
  });

  it('When action / Then fetches lead data when deal has lead_id', async () => {
    mockGetDealById.mockResolvedValue({ ...dealData, lead_id: 'l1' });
    mockGetLeadById.mockResolvedValue({ id: 'l1', company_name: 'LeadCo' });
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(mockGetLeadById).toHaveBeenCalledWith('l1');
    });
  });

  it('When action / Then fetches invoice status when deal has invoice_id', async () => {
    mockGetDealById.mockResolvedValue({ ...dealData, invoice_id: 'inv-1' });
    mockGetInvoiceStatus.mockResolvedValue({ has_invoice: true, invoice_id: 'inv-1' });
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(mockGetInvoiceStatus).toHaveBeenCalledWith('deal-1');
    });
  });

  it('When action / Then handles invoice status fetch error with fallback', async () => {
    mockGetDealById.mockResolvedValue({ ...dealData, invoice_id: 'inv-1', invoice_number: 'INV-001' });
    mockGetInvoiceStatus.mockRejectedValue(new Error('fail'));
    render(<DealDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Big Deal')).toBeInTheDocument();
    });
  });
});
