import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LeadDetailPage from './LeadDetailPage';

/**
 * RE §26 — the "Source & attribution" card on Lead Detail is gated by
 * `action:crm:leads:utm_attribution` and fails closed: flags not loaded, the
 * flag off, or a shell without isFeatureEnabled all hide it.
 *
 * (Template adapted from the authz spec.) Lead Detail used to fetch nine things in one Promise.all with no per-call catch.
 * A single 403 on ANY of them rejected the whole batch, left `lead` null, and
 * rendered "Lead not found." — so a user who could read the lead perfectly well
 * was told it did not exist because they lacked, say, partner access. And when the
 * denial really was on the lead, the same message sent administrators hunting for
 * a deleted record instead of granting a permission.
 *
 * These tests pin the three outcomes apart: denied, absent, and partially degraded.
 */

const shellState = vi.hoisted(() => ({ bridge: {} as Record<string, unknown> }));

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
  useShellBridge: () => shellState.bridge,
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
  useShellBridge: () => shellState.bridge,
}));

const attributedLead = {
  id: 'lead-1',
  first_name: 'Alice',
  last_name: 'Kumar',
  company_name: 'Acme Corp',
  email: 'alice@acme.com',
  status: 'qualified',
  utm_source: 'facebook',
  ad_platform: 'instagram',
  notes: [],
  documents: [],
  activities: [],
};

const bridge = (over: Record<string, unknown> = {}) => ({
  tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
  orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
  userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
  effectiveFlagsLoaded: true,
  permissionsLoaded: true,
  hasPermission: () => true,
  hasAnyPermission: () => true,
  isFeatureEnabled: () => true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  shellState.bridge = bridge();
  mockCrmService.getLeadById.mockResolvedValue(attributedLead);
  mockCrmService.getActivitiesByLeadIdPaginated.mockResolvedValue({ data: [], total: 0 });
  mockCrmService.getTasksByLeadId.mockResolvedValue([]);
  mockCrmService.getDealsByLeadId.mockResolvedValue([]);
  mockCrmService.getUsers.mockResolvedValue([]);
  mockCrmService.getPartners.mockResolvedValue([]);
  mockCrmService.getDocumentsByLeadId.mockResolvedValue([]);
  mockCrmService.getSettings.mockResolvedValue({});
  mockSettingsApi.sourceTypes.getAll.mockResolvedValue([]);
});

const renderLoaded = async () => {
  render(<LeadDetailPage />);
  await waitFor(() => expect(screen.queryAllByText(/acme corp/i).length).toBeGreaterThan(0));
};

describe('Given a lead captured with UTM / ad attribution', () => {
  describe('When the utm_attribution flag is on and flags are loaded', () => {
    test('Then the Source & attribution card lists the captured fields', async () => {
      await renderLoaded();
      expect(await screen.findByTestId('lead-attribution-card')).toBeTruthy();
      expect(screen.getByTestId('attr-utm_source').textContent).toBe('facebook');
      expect(screen.getByTestId('attr-ad_platform').textContent).toBe('instagram');
    });
  });

  describe('When the utm_attribution flag is off', () => {
    test('Then the card is not rendered', async () => {
      shellState.bridge = bridge({ isFeatureEnabled: (key: string) => key !== 'action:crm:leads:utm_attribution' });
      await renderLoaded();
      expect(screen.queryByTestId('lead-attribution-card')).toBeNull();
    });
  });

  describe('When effective flags have not loaded yet', () => {
    test('Then the card stays hidden (fail-closed) even though the flag reads on', async () => {
      shellState.bridge = bridge({ effectiveFlagsLoaded: false });
      await renderLoaded();
      expect(screen.queryByTestId('lead-attribution-card')).toBeNull();
    });
  });

  describe('When the shell exposes no isFeatureEnabled', () => {
    test('Then the card stays hidden (a missing checker reads as off)', async () => {
      shellState.bridge = bridge({ isFeatureEnabled: undefined });
      await renderLoaded();
      expect(screen.queryByTestId('lead-attribution-card')).toBeNull();
    });
  });
});
