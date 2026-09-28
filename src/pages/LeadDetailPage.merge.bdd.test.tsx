import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from '@so360/design-system';
import LeadDetailPage from './LeadDetailPage';

/**
 * A6 on Lead Detail: the header Merge action (side panel, not a modal) and the
 * DUPLICATE_LEAD warning on an inline save.
 */

const mockPerms = vi.hoisted(() => new Set<string>(['leads.update', 'leads.delete', 'leads.read']));
const mockMerge = vi.hoisted(() => vi.fn());

vi.mock('../services/leadDedupService', async (importActual) => {
  const actual = await importActual<typeof import('../services/leadDedupService')>();
  return { ...actual, leadDedupService: { mergeLeads: (...a: any[]) => mockMerge(...a) } };
});

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
  getLeads: vi.fn(),
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
    permissionsLoaded: true, hasPermission: (code: string) => mockPerms.has(code), hasAnyPermission: () => true, isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
  useShell: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isModuleEnabled: () => true,
    permissionsLoaded: true, hasPermission: (code: string) => mockPerms.has(code), hasAnyPermission: () => true, isFeatureEnabled: () => true,
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
    permissionsLoaded: true, hasPermission: (code: string) => mockPerms.has(code), hasAnyPermission: () => true, isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

const keepLead = {
  id: 'lead-1',
  first_name: 'Alice',
  last_name: 'Kumar',
  company_name: 'Acme Corp',
  contact_email: 'alice@acme.com',
  phone: '+91 9876543210',
  source: 'website',
  status: 'qualified',
  notes: [],
  documents: [],
  activities: [],
};

const otherLead = {
  id: 'lead-2',
  first_name: 'Alice',
  last_name: 'K',
  company_name: 'Acme Corporation',
  contact_email: 'alice@acme.io',
  phone: '+91 9876543210',
  source: 'referral',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms.clear();
  ['leads.update', 'leads.delete', 'leads.read'].forEach(p => mockPerms.add(p));
  mockCrmService.getLeadById.mockResolvedValue(keepLead);
  mockCrmService.getLeads.mockResolvedValue([keepLead, otherLead]);
  mockCrmService.getActivitiesByLeadIdPaginated.mockResolvedValue({ data: [], total: 0 });
  mockCrmService.getTasksByLeadId.mockResolvedValue([]);
  mockCrmService.getDealsByLeadId.mockResolvedValue([]);
  mockCrmService.getUsers.mockResolvedValue([]);
  mockCrmService.getPartners.mockResolvedValue([]);
  mockCrmService.getDocumentsByLeadId.mockResolvedValue([]);
  mockCrmService.getSettings.mockResolvedValue({});
  mockSettingsApi.sourceTypes.getAll.mockResolvedValue([]);
  mockMerge.mockResolvedValue({ id: 'lead-1' });
});

const renderLoaded = async () => {
  render(<LeadDetailPage />);
  await waitFor(() => expect(screen.queryAllByText(/acme corp/i).length).toBeGreaterThan(0));
};

describe('Given a user who may update and delete leads', () => {
  it('When Lead Detail loads / Then a Merge action is offered in the header', async () => {
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeInTheDocument();
    expect(screen.queryByTestId('merge-lead-panel')).toBeNull();
  });

  it('When Merge is tapped, a duplicate picked and Merge confirmed / Then the merge is posted with the kept lead as default for every field', async () => {
    const success = vi.spyOn(toast, 'success');
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    const panel = screen.getByTestId('merge-lead-panel');
    fireEvent.change(within(panel).getByLabelText('Find the duplicate lead'), { target: { value: 'acme' } });
    const option = await within(panel).findByRole('option', { name: /Acme Corporation/ });
    // The lead being viewed is never offered as its own duplicate.
    expect(within(panel).getAllByRole('option')).toHaveLength(1);
    fireEvent.click(option);
    fireEvent.click(within(panel).getByRole('button', { name: 'Merge' }));
    await waitFor(() => expect(mockMerge).toHaveBeenCalledTimes(1));
    const [keepId, mergeId, choices] = mockMerge.mock.calls[0];
    expect(keepId).toBe('lead-1');
    expect(mergeId).toBe('lead-2');
    expect(Object.values(choices).every(v => v === 'lead-1')).toBe(true);
    await waitFor(() => expect(screen.queryByTestId('merge-lead-panel')).toBeNull());
    expect(success).toHaveBeenCalled();
  });
});

describe('Given a user without delete rights', () => {
  it('When Lead Detail loads / Then no Merge action is shown (fail closed)', async () => {
    mockPerms.delete('leads.delete');
    await renderLoaded();
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
  });
});

describe('Given an inline edit that crm-be rejects as DUPLICATE_LEAD', () => {
  const dupError = () => {
    const err = new Error('Lead already exists') as Error & { status?: number; body?: any };
    err.status = 409;
    err.body = { code: 'DUPLICATE_LEAD', existing: { id: 'lead-9', name: 'Acme Holdings', owner_name: 'Ravi' } };
    return err;
  };

  it('When Save is tapped / Then the duplicate warning replaces the error toast, and Cancel dismisses it', async () => {
    const errorToast = vi.spyOn(toast, 'error');
    mockCrmService.updateLead.mockRejectedValueOnce(dupError());
    await renderLoaded();
    fireEvent.click(document.querySelector('[title="Edit Intelligence"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[title="Save Changes"]')).not.toBeNull());
    fireEvent.click(document.querySelector('[title="Save Changes"]') as HTMLElement);
    const warning = await screen.findByTestId('duplicate-lead-warning');
    expect(warning).toHaveTextContent('Acme Holdings');
    expect(warning).toHaveTextContent('Ravi');
    expect(within(warning).getByTestId('open-existing-lead')).toHaveAttribute('href', '/crm/leads/lead-9');
    expect(errorToast).not.toHaveBeenCalled();
    fireEvent.click(within(warning).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('duplicate-lead-warning')).toBeNull());
  });
});
