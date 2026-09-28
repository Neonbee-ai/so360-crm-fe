import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from '@so360/design-system';
import LeadDetailPage from './LeadDetailPage';

/**
 * A6 on Lead Detail, branch coverage: canMergeLead (permissionsLoaded, update,
 * delete), the customers route, panel close, merge success (publish + refetch),
 * the duplicate warning Cancel (leave edit + refetch), a later successful save
 * clearing the warning, and the non-duplicate error toast (4xx message vs
 * fallback).
 */

const mockPerms = vi.hoisted(() => new Set<string>(['leads.update', 'leads.delete', 'leads.read']));
const mockMerge = vi.hoisted(() => vi.fn());
const mockRoute = vi.hoisted(() => ({ pathname: '/crm/leads/lead-1', permissionsLoaded: true as boolean }));
const mockPublish = vi.hoisted(() => vi.fn());

vi.mock('../utils/leadEvents', async (importActual) => {
  const actual = await importActual<typeof import('../utils/leadEvents')>();
  return { ...actual, publishLeadsChanged: (...a: Parameters<typeof actual.publishLeadsChanged>) => mockPublish(...a) };
});

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
  useLocation: () => ({ search: '', pathname: mockRoute.pathname, state: null }),
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
    permissionsLoaded: mockRoute.permissionsLoaded, hasPermission: (code: string) => mockPerms.has(code), hasAnyPermission: () => true, isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
  useShell: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isModuleEnabled: () => true,
    permissionsLoaded: mockRoute.permissionsLoaded, hasPermission: (code: string) => mockPerms.has(code), hasAnyPermission: () => true, isFeatureEnabled: () => true,
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
    permissionsLoaded: mockRoute.permissionsLoaded, hasPermission: (code: string) => mockPerms.has(code), hasAnyPermission: () => true, isFeatureEnabled: vi.fn().mockReturnValue(true),
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
  mockRoute.pathname = '/crm/leads/lead-1';
  mockRoute.permissionsLoaded = true;
});

const renderLoaded = async () => {
  render(<LeadDetailPage />);
  await waitFor(() => expect(screen.queryAllByText(/acme corp/i).length).toBeGreaterThan(0));
};

const startEdit = async () => {
  fireEvent.click(document.querySelector('[title="Edit Intelligence"]') as HTMLElement);
  await waitFor(() => expect(document.querySelector('[title="Save Changes"]')).not.toBeNull());
};
const clickSave = () => fireEvent.click(document.querySelector('[title="Save Changes"]') as HTMLElement);

const httpError = (message: string, status?: number, body?: unknown) => {
  const err = new Error(message) as Error & { status?: number; body?: unknown };
  if (status !== undefined) err.status = status;
  if (body !== undefined) err.body = body;
  return err;
};
const dupError = () => httpError('Lead already exists', 409, {
  code: 'DUPLICATE_LEAD',
  existing: { id: 'lead-9', name: 'Acme Holdings', owner_name: 'Ravi' },
});

describe('Given the Merge action permission gate', () => {
  it('When the user lacks leads.update / Then Merge is hidden (fail closed)', async () => {
    mockPerms.delete('leads.update');
    await renderLoaded();
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
  });

  it('When permissions have not loaded yet / Then Merge is hidden even with both rights', async () => {
    mockRoute.permissionsLoaded = false;
    await renderLoaded();
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
  });

  it('When the same record is opened on the customers route / Then Merge is not offered', async () => {
    mockRoute.pathname = '/crm/customers/lead-1';
    await renderLoaded();
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull();
  });
});

describe('Given the merge panel is open', () => {
  it('When the panel close button is tapped / Then the panel goes away and nothing is merged', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(screen.getByTestId('merge-lead-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close merge panel' }));
    await waitFor(() => expect(screen.queryByTestId('merge-lead-panel')).toBeNull());
    expect(mockMerge).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('When a merge succeeds / Then the removed lead id is broadcast and the kept lead is re-read', async () => {
    await renderLoaded();
    const readsBefore = mockCrmService.getLeadById.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    const panel = screen.getByTestId('merge-lead-panel');
    fireEvent.change(within(panel).getByLabelText('Find the duplicate lead'), { target: { value: 'acme' } });
    fireEvent.click(await within(panel).findByRole('option', { name: /Acme Corporation/ }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Merge' }));
    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('deleted', ['lead-2']));
    await waitFor(() => expect(mockCrmService.getLeadById.mock.calls.length).toBeGreaterThan(readsBefore));
    expect(screen.queryByTestId('merge-lead-panel')).toBeNull();
  });
});

describe('Given the DUPLICATE_LEAD warning after an inline save', () => {
  it('When Cancel is tapped / Then edit mode ends and the saved values are re-read', async () => {
    mockCrmService.updateLead.mockRejectedValueOnce(dupError());
    await renderLoaded();
    await startEdit();
    clickSave();
    const warning = await screen.findByTestId('duplicate-lead-warning');
    // A duplicate keeps the user in edit mode so they can fix the value.
    expect(document.querySelector('[title="Save Changes"]')).not.toBeNull();
    const readsBefore = mockCrmService.getLeadById.mock.calls.length;
    fireEvent.click(within(warning).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByTestId('duplicate-lead-warning')).toBeNull());
    await waitFor(() => expect(mockCrmService.getLeadById.mock.calls.length).toBeGreaterThan(readsBefore));
    expect(document.querySelector('[title="Edit Intelligence"]')).not.toBeNull();
  });

  it('When the next save succeeds / Then the warning is cleared', async () => {
    mockCrmService.updateLead.mockRejectedValueOnce(dupError()).mockResolvedValueOnce({});
    await renderLoaded();
    await startEdit();
    clickSave();
    await screen.findByTestId('duplicate-lead-warning');
    clickSave();
    await waitFor(() => expect(mockCrmService.updateLead).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('duplicate-lead-warning')).toBeNull());
  });
});

describe('Given an inline save that fails for another reason', () => {
  it('When crm-be answers a 4xx with a message / Then that message is toasted and no warning shows', async () => {
    const errorToast = vi.spyOn(toast, 'error');
    mockCrmService.updateLead.mockRejectedValueOnce(httpError('Email is invalid', 422));
    await renderLoaded();
    await startEdit();
    clickSave();
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Email is invalid'));
    expect(screen.queryByTestId('duplicate-lead-warning')).toBeNull();
    expect(document.querySelector('[title="Save Changes"]')).not.toBeNull();
  });

  it('When the failure is a 5xx / Then the generic message is toasted', async () => {
    const errorToast = vi.spyOn(toast, 'error');
    mockCrmService.updateLead.mockRejectedValueOnce(httpError('upstream exploded', 500));
    await renderLoaded();
    await startEdit();
    clickSave();
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Failed to save changes.'));
  });

  it('When the failure has no status / Then the generic message is toasted', async () => {
    const errorToast = vi.spyOn(toast, 'error');
    mockCrmService.updateLead.mockRejectedValueOnce(httpError('network down'));
    await renderLoaded();
    await startEdit();
    clickSave();
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Failed to save changes.'));
  });

  it('When a 409 is not a DUPLICATE_LEAD body / Then it is treated as an ordinary 4xx, not a duplicate', async () => {
    const errorToast = vi.spyOn(toast, 'error');
    mockCrmService.updateLead.mockRejectedValueOnce(httpError('Version conflict', 409, { code: 'STALE' }));
    await renderLoaded();
    await startEdit();
    clickSave();
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Version conflict'));
    expect(screen.queryByTestId('duplicate-lead-warning')).toBeNull();
  });
});
