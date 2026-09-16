import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LeadDetailPage from './LeadDetailPage';

/**
 * Lead Detail used to fetch nine things in one Promise.all with no per-call catch.
 * A single 403 on ANY of them rejected the whole batch, left `lead` null, and
 * rendered "Lead not found." — so a user who could read the lead perfectly well
 * was told it did not exist because they lacked, say, partner access. And when the
 * denial really was on the lead, the same message sent administrators hunting for
 * a deleted record instead of granting a permission.
 *
 * These tests pin the three outcomes apart: denied, absent, and partially degraded.
 */

const mockCrmService = vi.hoisted(() => ({
  createNote: vi.fn(),
  deleteDocument: vi.fn(),
  deleteLead: vi.fn(),
  deleteNote: vi.fn(),
  getActivitiesByLeadId: vi.fn(),
  getActivitiesByLeadIdPaginated: vi.fn(),
  getDealsByLeadId: vi.fn(),
  getDocumentDownloadUrl: vi.fn(),
  getDocumentsByLeadId: vi.fn(),
  getLeadById: vi.fn(),
  getPartners: vi.fn(),
  getSettings: vi.fn(),
  getTasksByLeadId: vi.fn(),
  getUsers: vi.fn(),
  // useLeadDetailLayoutPreferences persists column layout on an 800ms timer and
  // chains .catch() on the result, so these must exist and return promises —
  // otherwise the timer fires after the test ends and throws an uncaught
  // "Cannot read properties of undefined" that fails the whole file.
  gridColumns: {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
  },
  logActivity: vi.fn(),
  updateLead: vi.fn(),
  updateNote: vi.fn(),
  updateTask: vi.fn(),
  uploadDocument: vi.fn(),
}));

const mockSettingsApi = vi.hoisted(() => ({
  sourceTypes: { getAll: vi.fn() },
  scoringRules: { recalculate: vi.fn() },
}));

const mockActivitiesApi = vi.hoisted(() => ({
  getByLeadId: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
  settingsApi: mockSettingsApi,
  activitiesApi: mockActivitiesApi,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'lead-1' }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ search: '', pathname: '/', state: null }),
  Link: ({ children }: any) => children,
  NavLink: ({ children }: any) => children,
}));

vi.mock('@so360/shell-context', () => ({
  useCurrentEntity: () => ({ setCurrentEntity: vi.fn() }),
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
  useShell: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isModuleEnabled: () => true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: () => true,
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
    effectiveFlagsLoaded: true,
    permissionsLoaded: true, hasPermission: () => true, hasAnyPermission: () => true, isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

// Field names matter: the page renders first_name / company_name, not `name`.
const mockLead = {
  id: 'lead-1',
  first_name: 'Alice',
  last_name: 'Kumar',
  company_name: 'Acme Corp',
  email: 'alice@acme.com',
  status: 'qualified',
  notes: [],
  documents: [],
  activities: [],
};

/** A 403 as the API layer now reports it: a real Error carrying the status. */
function forbidden() {
  const err = new Error('This action requires one of these permissions: leads.read') as Error & { status?: number };
  err.status = 403;
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCrmService.getLeadById.mockResolvedValue(mockLead);
  mockCrmService.getActivitiesByLeadIdPaginated.mockResolvedValue({ data: [], total: 0 });
  mockCrmService.getTasksByLeadId.mockResolvedValue([]);
  mockCrmService.getDealsByLeadId.mockResolvedValue([]);
  mockCrmService.getUsers.mockResolvedValue([]);
  mockCrmService.getPartners.mockResolvedValue([]);
  mockCrmService.getDocumentsByLeadId.mockResolvedValue([]);
  mockCrmService.getSettings.mockResolvedValue({});
  mockSettingsApi.sourceTypes.getAll.mockResolvedValue([]);
});

describe('Given LeadDetailPage and a user who may not read the lead', () => {
  test('When the lead fetch returns 403 / Then an access-denied message is shown', async () => {
    mockCrmService.getLeadById.mockRejectedValueOnce(forbidden());

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/permission to view this lead/i)).toBeTruthy();
    });
  });

  test('When the lead fetch returns 403 / Then it does NOT claim the lead is missing', async () => {
    mockCrmService.getLeadById.mockRejectedValueOnce(forbidden());

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/permission to view this lead/i)).toBeTruthy();
    });
    expect(screen.queryByText(/lead not found/i)).toBeNull();
  });
});

describe('Given LeadDetailPage and a lead that genuinely does not exist', () => {
  test('When the lead resolves to undefined / Then the not-found state is shown', async () => {
    mockCrmService.getLeadById.mockResolvedValueOnce(undefined);

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/lead not found/i)).toBeTruthy();
    });
    expect(screen.queryByText(/permission to view this lead/i)).toBeNull();
  });
});

describe('Given LeadDetailPage where only a SUPPORTING call is denied', () => {
  // Each of these used to take the whole page down with "Lead not found."
  const supporting: Array<[string, keyof typeof mockCrmService]> = [
    ['partners', 'getPartners'],
    ['deals', 'getDealsByLeadId'],
    ['tasks', 'getTasksByLeadId'],
    ['users', 'getUsers'],
    ['documents', 'getDocumentsByLeadId'],
    ['settings', 'getSettings'],
    ['activities', 'getActivitiesByLeadIdPaginated'],
  ];

  test.each(supporting)('When %s is denied / Then the lead still renders', async (_label, method) => {
    (mockCrmService[method] as any).mockRejectedValueOnce(forbidden());

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.queryAllByText(/acme corp/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/lead not found/i)).toBeNull();
    expect(screen.queryByText(/permission to view this lead/i)).toBeNull();
  });

  test('When the source-types lookup is denied / Then the lead still renders', async () => {
    mockSettingsApi.sourceTypes.getAll.mockRejectedValueOnce(forbidden());

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.queryAllByText(/acme corp/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/lead not found/i)).toBeNull();
  });
});
