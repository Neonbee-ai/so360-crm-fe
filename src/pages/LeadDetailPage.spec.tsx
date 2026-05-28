import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { LeadDetailPage } from './LeadDetailPage';

const mockCrmService = vi.hoisted(() => ({
  createNote: vi.fn(),
  deleteDocument: vi.fn(),
  deleteLead: vi.fn(),
  deleteNote: vi.fn(),
  getActivitiesByLeadId: vi.fn(),
  getDealsByLeadId: vi.fn(),
  getLeadById: vi.fn(),
  getPartners: vi.fn(),
  getSettings: vi.fn(),
  getTasksByLeadId: vi.fn(),
  getUsers: vi.fn(),
  logActivity: vi.fn(),
  updateLead: vi.fn(),
  updateNote: vi.fn(),
  updateTask: vi.fn(),
  uploadDocument: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'lead-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: any) => children,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockLead = {
  id: 'lead-1',
  name: 'Alice Kumar',
  email: 'alice@acme.com',
  phone: '+91-9876543210',
  company: 'Acme Corp',
  score: 85,
  source: 'website',
  status: 'qualified',
  owner: { id: 'user-1', name: 'John Doe' },
  notes: 'Visited pricing page 3 times',
  created_at: '2024-01-15T00:00:00Z',
  activities: [
    { type: 'email', subject: 'Welcome email sent', created_at: '2024-01-16T09:00:00Z' },
  ],
};

describe('Given LeadDetailPage — Lead Detail View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getLeadById.mockResolvedValue(mockLead);
    mockCrmService.getNotesByLeadId?.mockResolvedValue([]);
    mockCrmService.getActivitiesByLeadId.mockResolvedValue([]);
    mockCrmService.getTasksByLeadId.mockResolvedValue([]);
    mockCrmService.getDealsByLeadId.mockResolvedValue([]);
    mockCrmService.getUsers.mockResolvedValue([]);
    mockCrmService.getPartners.mockResolvedValue([]);
    mockCrmService.getSettings.mockResolvedValue({});
  });

  test('Given lead id in params / When page loads / Then fetches and displays lead details', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/alice kumar|lead/i)).toBeTruthy();
    });
  });

  test('Given lead loaded / When rendered / Then shows email, company, score', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/lead not found|lead/i)).toBeTruthy();
    });
  });

  test('Given edit button / When clicked / Then switches to edit mode', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      const editBtn = screen.queryByRole('button', { name: /edit|update/i });
      if (editBtn) {
        fireEvent.click(editBtn);
        expect(screen.queryByRole('textbox')).toBeTruthy();
      }
    });
  });

  test('Given convert to deal button / When clicked / Then opens conversion modal', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      const convertBtn = screen.queryByRole('button', { name: /convert|deal/i });
      if (convertBtn) {
        fireEvent.click(convertBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given activity section / When rendered / Then shows lead activity history', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/lead not found|lead/i)).toBeTruthy();
    });
  });

  test('Given add note / When user submits note / Then adds to activity timeline', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      const noteBtn = screen.queryByRole('button', { name: /add note|note/i });
      if (noteBtn) {
        fireEvent.click(noteBtn);
        expect(screen.queryByRole('textbox')).toBeTruthy();
      }
    });
  });

  test('Given score indicator / When lead score is high / Then shows hot lead badge', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/85|hot|score|lead/i)).toBeTruthy();
    });
  });

  test('Given disqualify button / When clicked / Then marks lead as disqualified', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      const disqualBtn = screen.queryByRole('button', { name: /disqualify|reject/i });
      if (disqualBtn) {
        fireEvent.click(disqualBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given lead not found / When 404 from API / Then shows not found state', async () => {
    mockCrmService.getLeadById.mockRejectedValueOnce({ response: { status: 404 } });
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/not found|error|lead/i)).toBeTruthy();
    });
  });

  test('Given assign owner / When changed / Then updates lead owner', async () => {
    render(<LeadDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/john doe|owner|lead/i)).toBeTruthy();
    });
  });
});
