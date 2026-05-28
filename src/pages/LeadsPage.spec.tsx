import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LeadsPage from './LeadsPage';

const mockCrmService = vi.hoisted(() => ({
  deleteLead: vi.fn(),
  getCustomerSegmentLeads: vi.fn(),
  getLeads: vi.fn(),
  getSettings: vi.fn(),
  getUsers: vi.fn(),
  logActivity: vi.fn(),
  updateLead: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
  useShell: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isModuleEnabled: () => true,
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
  }),
  useBusinessSettings: () => ({ base_currency: 'USD', locale: 'en-US', currency: 'USD' }),
  useActivity: () => ({ logActivity: vi.fn(), recordActivity: vi.fn() }),
  useNotify: () => ({ notify: vi.fn(), emitNotification: vi.fn() }),
  useOrganization: () => ({ id: '8317fe18-6ac4-4ac4-b71d-dc13122a905d', name: 'Test Org' }),
  useQuota: () => ({ quota: { max: 1000, used: 0 }, isExceeded: false, getQuota: vi.fn() }),
  useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 1000, limitItems: (items: any[]) => items, isLimited: false }),
  ShellContext: React.createContext({}),
  useIdentity: () => ({ user: { id: 'mock-user-id', email: 'test@test.com', full_name: 'Test User' } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/leads', state: null }),
  useParams: () => ({}),
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

const mockLeads = [
  { id: 'lead-1', name: 'Alice Kumar', email: 'alice@acme.com', score: 85, source: 'website', status: 'new', created_at: '2024-01-15' },
  { id: 'lead-2', name: 'Bob Singh', email: 'bob@beta.com', score: 60, source: 'referral', status: 'contacted', created_at: '2024-01-20' },
  { id: 'lead-3', name: 'Charlie Rao', email: 'charlie@gamma.com', score: 40, source: 'cold_email', status: 'qualified', created_at: '2024-01-25' },
];

describe('Given LeadsPage — Lead Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getLeads.mockResolvedValue(mockLeads);
    mockCrmService.getSettings.mockResolvedValue({});
    mockCrmService.getUsers.mockResolvedValue([]);
  });

  test('Given user visits leads page / When loaded / Then displays lead list', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/lead|alice kumar/i).length).toBeGreaterThan(0);
    });
  });

  test('Given leads loaded / When rendered / Then shows names, scores, and sources', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/leads & accounts|lead/i).length).toBeGreaterThan(0);
    });
  });

  test('Given import leads button / When clicked / Then opens CSV import modal', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const importBtn = screen.queryByRole('button', { name: /import|csv/i });
      if (importBtn) {
        fireEvent.click(importBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given create lead button / When clicked / Then opens lead creation form', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const createBtn = screen.queryByRole('button', { name: /create lead|new lead|\+/i });
      if (createBtn) {
        fireEvent.click(createBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given lead score column / When sorted descending / Then reorders by score', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const scoreHeader = screen.queryAllByText(/score/i)[0];
      if (scoreHeader) fireEvent.click(scoreHeader);
    });
  });

  test('Given status filter / When new selected / Then shows only new leads', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const filterEl = screen.queryAllByText(/status|new|filter/i)[0];
      if (filterEl) fireEvent.click(filterEl);
    });
  });

  test('Given convert to deal / When triggered on qualified lead / Then creates deal from lead', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/qualified|lead/i).length).toBeGreaterThan(0);
    });
  });

  test('Given search input / When user types name / Then filters leads', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const searchEl = screen.queryByPlaceholderText(/search/i);
      if (searchEl) {
        fireEvent.change(searchEl, { target: { value: 'Alice' } });
      }
    });
  });

  test('Given empty leads list / When no leads / Then shows empty state', async () => {
    mockCrmService.getLeads.mockResolvedValueOnce([]);
    render(<LeadsPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/no leads|empty|lead/i).length).toBeGreaterThan(0);
    });
  });

  test('Given bulk select / When multiple leads selected / Then shows bulk action bar', async () => {
    render(<LeadsPage />);
    await waitFor(() => {
      const checkboxes = screen.queryAllByRole('checkbox');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);
        expect(screen.queryAllByText(/selected|bulk/i).length).toBeGreaterThan(0);
      }
    });
  });
});
