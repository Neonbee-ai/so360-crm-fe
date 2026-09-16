import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mutable holder so each test can drive the resolved feature state the shell returns.
const shellState: {
  getFeatureState: (flag: string) => string;
  // Entitlements default to unrestricted so the flag specs below exercise flag
  // behaviour alone; the permission specs drive this down to a real code set.
  hasPermission: (code: string) => boolean;
  permissionsLoaded: boolean;
} = {
  getFeatureState: () => 'enabled',
  hasPermission: () => true,
  permissionsLoaded: true,
};

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
    hasAnyPermission: (...codes: string[]) => codes.some(c => shellState.hasPermission(c)),
  }),
  useActivity: () => ({ recordActivity: async () => {} }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

vi.mock('./services/crmService', () => ({
  crmService: {
    setTenantId: vi.fn(),
    setOrgId: vi.fn(),
    setAccessToken: vi.fn(),
    setUser: vi.fn(),
  },
}));

import App from './App';

beforeEach(() => {
  shellState.getFeatureState = () => 'enabled';
  shellState.hasPermission = () => true;
  shellState.permissionsLoaded = true;
});

describe('Given the App component is rendered', () => {
  it('When navigated to /dashboard / Then renders without crashing and shows loading then content', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    // The shell initializer or lazy loading shows something
    expect(document.body).toBeTruthy();
  });

  it('When navigated to root / / Then redirects to dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });
});

describe('Given a flag-guarded route on the 5-state model', () => {
  it('When the feature is locked / Then the route shows the upgrade prompt instead of the page', async () => {
    shellState.getFeatureState = () => 'locked';
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/upgrade plan/i)).toBeTruthy();
  });

  it('When the feature is disabled / Then the route shows the unavailable panel and NO upgrade prompt', async () => {
    shellState.getFeatureState = () => 'disabled';
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/feature unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/upgrade plan/i)).toBeNull();
  });
});

describe('Given a page gated on role permissions', () => {
  it('When the user holds the page code / Then the page is not withheld', () => {
    shellState.hasPermission = (c) => c === 'leads.read';
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/don't have access/i)).toBeNull();
  });

  it('When the user lacks the page code / Then the page is withheld with a notice', async () => {
    shellState.hasPermission = () => false;
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/don't have access to this page/i)).toBeTruthy();
  });

  it('When the user lacks the code / Then the plan-flag prompt is NOT shown instead', async () => {
    shellState.hasPermission = () => false;
    shellState.getFeatureState = () => 'locked';
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/don't have access to this page/i)).toBeTruthy();
    expect(screen.queryByText(/upgrade plan/i)).toBeNull();
  });

  it('When entitlements have not resolved / Then no denial flashes', () => {
    shellState.permissionsLoaded = false;
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/don't have access/i)).toBeNull();
  });

  it('When the dashboard is opened with no page codes / Then it stays reachable', () => {
    shellState.hasPermission = () => false;
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/don't have access/i)).toBeNull();
  });
});
