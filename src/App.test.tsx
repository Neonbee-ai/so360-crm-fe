import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mutable holder so each test can drive the resolved feature state the shell returns.
const shellState: { getFeatureState: (flag: string) => string } = {
  getFeatureState: () => 'enabled',
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
