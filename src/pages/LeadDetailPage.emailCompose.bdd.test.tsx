import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LeadDetailPage from './LeadDetailPage';

// RE G9 — the lead header mounts the Compose Email action. The button itself
// (flag + permission gating) is covered in EmailComposeButton.bdd.test.tsx.
const composeProps = vi.hoisted(() => ({ calls: [] as any[] }));
vi.mock('../components/emailCompose/EmailComposeButton', () => ({
  EmailComposeButton: (p: any) => { composeProps.calls.push(p); return <button data-testid="email-compose-stub">{p.entityType}:{p.entityId}</button>; },
}));

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
  composeProps.calls = [];
});

describe('Given LeadDetailPage for a readable lead (RE G9)', () => {
  describe('When the header renders', () => {
    test('Then the Compose Email action is mounted for entity type lead with the lead id', async () => {
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByTestId('email-compose-stub')).toBeTruthy());
      expect(screen.getByTestId('email-compose-stub').textContent).toBe('lead:lead-1');
      expect(composeProps.calls.at(-1)).toMatchObject({ entityType: 'lead', entityId: 'lead-1' });
    });
  });

  describe('When the lead cannot be read', () => {
    test('Then no Compose Email action is mounted', async () => {
      mockCrmService.getLeadById.mockResolvedValueOnce(undefined);
      render(<LeadDetailPage />);
      await waitFor(() => expect(screen.getByText(/lead not found/i)).toBeTruthy());
      expect(screen.queryByTestId('email-compose-stub')).toBeNull();
    });
  });
});
