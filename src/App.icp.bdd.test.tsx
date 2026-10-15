import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation, useParams } from 'react-router-dom';

const shellState: {
  getFeatureState: (flag: string) => string;
  hasPermission: (code: string) => boolean;
  permissionsLoaded: boolean;
} = { getFeatureState: () => 'enabled', hasPermission: () => true, permissionsLoaded: true };

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
  useShellBridge: () => ({
    currentTenant: { id: 'tenant-1' },
    currentOrg: { id: 'org-1' },
    accessToken: 'tok',
    user: { id: 'u1', email: 'a@b.com', full_name: 'A', avatar_url: null },
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    isModuleEnabled: () => true,
    getFeatureState: (flag: string) => shellState.getFeatureState(flag),
    permissionsLoaded: shellState.permissionsLoaded,
    hasPermission: (code: string) => shellState.hasPermission(code),
    hasAnyPermission: (...codes: string[]) => codes.some((c) => shellState.hasPermission(c)),
  }),
  useActivity: () => ({ recordActivity: async () => {} }),
  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
}));

vi.mock('./services/crmService', () => ({
  crmService: { setTenantId: vi.fn(), setOrgId: vi.fn(), setAccessToken: vi.fn(), setUser: vi.fn() },
}));

vi.mock('./pages/IcpListPage', () => ({ default: () => <div data-testid="icp-list-page" /> }));
vi.mock('./pages/IcpFormPage', () => ({
  default: () => { const { id } = useParams(); return <div data-testid="icp-form-page" data-id={id ?? ''} />; },
}));
vi.mock('./pages/SettingsPage', () => ({
  default: ({ onOpenIcps }: { onOpenIcps?: () => void }) => (
    <button type="button" data-testid="settings-stub" onClick={onOpenIcps}>settings</button>
  ),
}));

import App from './App';

const Probe = () => <div data-testid="loc">{useLocation().pathname}</div>;
const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><App /><Probe /></MemoryRouter>);
const FLAG = 'submodule:crm:icp_manager';
const flagState = (state: string) => { shellState.getFeatureState = (f) => (f === FLAG ? state : 'enabled'); };
const onlyPerm = (code: string) => { shellState.hasPermission = (c) => c === code; };

beforeEach(() => {
  shellState.getFeatureState = () => 'enabled';
  shellState.hasPermission = () => true;
  shellState.permissionsLoaded = true;
});

describe('Given the ICP manager routes with the flag on', () => {
  describe('When /settings/icps is opened', () => {
    it('Then the ICP list page renders', async () => {
      renderAt('/settings/icps');
      expect(await screen.findByTestId('icp-list-page')).toBeTruthy();
      expect(screen.queryByTestId('icp-form-page')).toBeNull();
    });
  });
  describe('When /settings/icps/new is opened', () => {
    it('Then the ICP form renders in create mode (no id)', async () => {
      renderAt('/settings/icps/new');
      expect((await screen.findByTestId('icp-form-page')).getAttribute('data-id')).toBe('');
    });
  });
  describe('When /settings/icps/abc-123 is opened', () => {
    it('Then the ICP form renders with the id param', async () => {
      renderAt('/settings/icps/abc-123');
      expect((await screen.findByTestId('icp-form-page')).getAttribute('data-id')).toBe('abc-123');
    });
  });
});

describe('Given the ICP manager routes with the flag in other states', () => {
  describe.each(['/settings/icps', '/settings/icps/new', '/settings/icps/abc'])('When %s is opened', (path) => {
    it('Then a disabled flag shows the unavailable panel and not the page', async () => {
      flagState('disabled');
      renderAt(path);
      expect(await screen.findByText(/feature unavailable/i)).toBeTruthy();
      expect(screen.queryByTestId('icp-list-page')).toBeNull();
      expect(screen.queryByTestId('icp-form-page')).toBeNull();
    });
    it('Then a locked flag shows the upgrade prompt and not the page', async () => {
      flagState('locked');
      renderAt(path);
      expect(await screen.findByText(/upgrade plan/i)).toBeTruthy();
      expect(screen.queryByTestId('icp-list-page')).toBeNull();
      expect(screen.queryByTestId('icp-form-page')).toBeNull();
    });
    it('Then a hidden flag never renders the page', async () => {
      flagState('hidden');
      renderAt(path);
      await screen.findByTestId('loc');
      expect(screen.queryByTestId('icp-list-page')).toBeNull();
      expect(screen.queryByTestId('icp-form-page')).toBeNull();
    });
  });
  describe('When another flag is disabled but the ICP flag is on', () => {
    it('Then the ICP page still renders (the guard keys on the ICP flag)', async () => {
      shellState.getFeatureState = (f) => (f === FLAG ? 'enabled' : 'disabled');
      renderAt('/settings/icps');
      expect(await screen.findByTestId('icp-list-page')).toBeTruthy();
    });
  });
});

describe('Given the ICP routes are gated by role permissions', () => {
  it.each([
    ['/settings/icps', 'linkedin_sync.read', 'icp-list-page'],
    ['/settings/icps/new', 'linkedin_sync.create', 'icp-form-page'],
    ['/settings/icps/abc', 'linkedin_sync.update', 'icp-form-page'],
  ])('When %s is opened Then only %s lets the page render', async (path, code, testId) => {
    onlyPerm(code);
    renderAt(path);
    expect(await screen.findByTestId(testId)).toBeTruthy();
  });
  it.each([
    ['/settings/icps', 'linkedin_sync.create'],
    ['/settings/icps/new', 'linkedin_sync.read'],
    ['/settings/icps/abc', 'linkedin_sync.read'],
  ])('When %s is opened without the right code (%s) Then access is denied', async (path, code) => {
    onlyPerm(code);
    renderAt(path);
    expect(await screen.findByText(/don't have access to this page/i)).toBeTruthy();
    expect(screen.queryByTestId('icp-list-page')).toBeNull();
    expect(screen.queryByTestId('icp-form-page')).toBeNull();
  });
});

describe('Given the settings route', () => {
  describe('When /settings is opened and the Ideal customers entry is chosen', () => {
    it('Then the SettingsPage receives onOpenIcps which navigates to /crm/settings/icps', async () => {
      renderAt('/settings');
      fireEvent.click(await screen.findByTestId('settings-stub'));
      expect(screen.getByTestId('loc').textContent).toBe('/crm/settings/icps');
    });
  });
});
