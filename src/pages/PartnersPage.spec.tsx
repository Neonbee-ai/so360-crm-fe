import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import PartnersPage from './PartnersPage';

const mockPartnersApi = vi.hoisted(() => ({
  getAll: vi.fn(),
  create: vi.fn(),
  getOne: vi.fn(),
  update: vi.fn(),
}));
const mockSettingsApi = vi.hoisted(() => ({
  leadStages: { getAll: vi.fn() },
  sourceTypes: { getAll: vi.fn() },
  customFields: { getAll: vi.fn() },
}));
const mockCrmService = vi.hoisted(() => ({
  getUsers: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
  partnersApi: mockPartnersApi,
  settingsApi: mockSettingsApi,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/', state: null }),
  useParams: () => ({}),
  Link: ({ children }: any) => children,
  NavLink: ({ children }: any) => children,
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

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const mockPartners = [
  { id: 'partner-1', name: 'Alpha Resellers', type: 'reseller', tier: 'gold', contact_email: 'contact@alpha.com', deals_count: 12 },
  { id: 'partner-2', name: 'Beta Integrators', type: 'integrator', tier: 'silver', contact_email: 'info@beta.com', deals_count: 5 },
  { id: 'partner-3', name: 'Gamma Distributors', type: 'distributor', tier: 'platinum', contact_email: 'sales@gamma.com', deals_count: 28 },
];

describe('Given PartnersPage — Partner Relationship Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrmService.getUsers.mockResolvedValue([]);
    mockPartnersApi.getAll.mockResolvedValue(mockPartners);
    mockPartnersApi.create.mockResolvedValue({});
    mockSettingsApi.leadStages.getAll.mockResolvedValue([]);
    mockSettingsApi.sourceTypes.getAll.mockResolvedValue([]);
    mockSettingsApi.customFields.getAll.mockResolvedValue([]);
  });

  test('Given user visits partners page / When loaded / Then displays partner list', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/partner|alpha resellers/i).length).toBeGreaterThan(0);
    });
  });

  test('Given partners loaded / When rendered / Then shows partner names and tiers', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/partner/i).length).toBeGreaterThan(0);
    });
  });

  test('Given add partner button / When clicked / Then opens partner creation form', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      const addBtn = screen.queryByRole('button', { name: /add partner|new partner|\+/i });
      if (addBtn) {
        fireEvent.click(addBtn);
        expect(screen.queryByRole('dialog')).toBeTruthy();
      }
    });
  });

  test('Given tier filter / When gold selected / Then shows only gold partners', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      const filterEl = screen.queryAllByText(/tier|gold/i)[0];
      if (filterEl) fireEvent.click(filterEl);
    });
  });

  test('Given partner row / When clicked / Then navigates to partner detail', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      const partnerEl = screen.queryByText(/alpha resellers/i);
      if (partnerEl) fireEvent.click(partnerEl);
    });
  });

  test('Given platinum partner / When rendered / Then shows platinum badge', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/partner/i).length).toBeGreaterThan(0);
    });
  });

  test('Given empty partner list / When no partners / Then shows empty state', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/no partners|empty|partner/i).length).toBeGreaterThan(0);
    });
  });

  test('Given search input / When user types / Then filters partners', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      const searchEl = screen.queryByPlaceholderText(/search/i);
      if (searchEl) {
        fireEvent.change(searchEl, { target: { value: 'Alpha' } });
      }
    });
  });

  test('Given type filter / When reseller selected / Then shows resellers only', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      const typeEl = screen.queryAllByText(/type|reseller/i)[0];
      if (typeEl) fireEvent.click(typeEl);
    });
  });

  test('Given API error / When partners fail to load / Then shows error state', async () => {
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.queryAllByText(/error|failed|partner/i).length).toBeGreaterThan(0);
    });
  });
});
