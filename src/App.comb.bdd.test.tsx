import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

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

vi.mock('@so360/shell-context', () => {
  const bridge = () => ({
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
  });
  return {
    useDatasetSchema: () => ({ fields: [], isLoading: false, error: null }),
    useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
    useShellBridge: bridge,
    // Pages call useShell() directly (Dashboard, Tasks, Deal/Lead detail) — same bridge surface.
    useShell: bridge,
    useNotify: () => ({ emitNotification: () => {} }),
    useIdentity: () => ({ user: { id: 'u1', email: 'a@b.com', full_name: 'A' } }),
    useOrganization: () => ({ currentOrg: { id: 'org-1' } }),
    useCurrentEntity: () => ({ setCurrentEntity: () => {} }),
    useSandboxLimit: () => ({ isSandboxMode: false, sandboxEntryLimit: 0, isLimited: false }),
    useActivity: () => ({ recordActivity: async () => {} }),
    useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),
    QUOTA_EXCEEDED_EVENT: 'so360:quota-exceeded',
    buildQuotaExceededDetail: (d: unknown) => d,
  };
});

// Pages reached through the router call many service methods on mount; any
// method not pinned here resolves to an empty list so the routes settle. The
// dashboard stats call resolves to null (the "couldn't load" state).
vi.mock('./services/crmService', () => {
  const pinned: Record<string, unknown> = {
    setTenantId: vi.fn(),
    setOrgId: vi.fn(),
    setAccessToken: vi.fn(),
    setUser: vi.fn(),
    getDashboardStats: vi.fn().mockResolvedValue(null),
    getSettings: vi.fn().mockResolvedValue(null),
  };
  const auto = (target: Record<string, unknown>) => new Proxy(target, {
    get(t, key: string) {
      if (!(key in t)) t[key] = typeof key === 'string' && key !== 'then' ? vi.fn().mockResolvedValue([]) : undefined;
      return t[key];
    },
  });
  const nested = () => new Proxy({} as Record<string, unknown>, {
    get(t, key: string) {
      if (key === 'then') return undefined;
      if (!(key in t)) t[key] = auto({});
      return t[key];
    },
  });
  return { crmService: auto(pinned), settingsApi: nested(), activitiesApi: auto({}) };
});

import App from './App';

const Probe = () => <div data-testid="loc">{useLocation().pathname}</div>;
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <App />
    <Probe />
  </MemoryRouter>,
);

beforeEach(() => {
  shellState.getFeatureState = () => 'enabled';
  shellState.hasPermission = () => true;
  shellState.permissionsLoaded = true;
});

/** Feature: Comb adoption (95ffb66) - the locked-route upgrade prompt uses a Comb Button. */
describe('Feature: App upgrade prompt Button (Comb)', () => {
  describe('Scenario: render', () => {
    it('Given the feature is locked / When the route renders / Then Upgrade plan is a named Comb Button of type button', async () => {
      shellState.getFeatureState = () => 'locked';
      renderAt('/leads');
      const btn = await screen.findByRole('button', { name: 'Upgrade plan' });
      expect(btn).toHaveAttribute('data-comb', 'button');
      expect(btn).toHaveAttribute('type', 'button');
      expect(btn).toBeEnabled();
      expect(screen.getByText('This feature is part of a higher plan')).toBeInTheDocument();
    });
  });

  describe('Scenario: primary interaction', () => {
    it('Given the prompt / When clicked / Then it navigates to /org/billing', async () => {
      shellState.getFeatureState = () => 'locked';
      const user = userEvent.setup();
      renderAt('/leads');
      await user.click(await screen.findByRole('button', { name: 'Upgrade plan' }));
      expect(screen.getByTestId('loc')).toHaveTextContent('/org/billing');
    });
    it('Given the prompt / When focused and Enter pressed / Then it navigates to /org/billing', async () => {
      shellState.getFeatureState = () => 'locked';
      const user = userEvent.setup();
      renderAt('/leads');
      (await screen.findByRole('button', { name: 'Upgrade plan' })).focus();
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('loc')).toHaveTextContent('/org/billing');
    });
    it('Given the prompt / When focused and Space pressed / Then it navigates to /org/billing', async () => {
      shellState.getFeatureState = () => 'locked';
      const user = userEvent.setup();
      renderAt('/leads');
      (await screen.findByRole('button', { name: 'Upgrade plan' })).focus();
      await user.keyboard(' ');
      expect(screen.getByTestId('loc')).toHaveTextContent('/org/billing');
    });
  });

  describe('Scenario: keyboard focus', () => {
    it('Given the prompt / When Tab is pressed / Then the Upgrade button is reachable', async () => {
      shellState.getFeatureState = () => 'locked';
      const user = userEvent.setup();
      renderAt('/leads');
      const btn = await screen.findByRole('button', { name: 'Upgrade plan' });
      for (let i = 0; i < 30 && document.activeElement !== btn; i++) await user.tab();
      expect(btn).toHaveFocus();
    });
  });

  describe('Scenario: hidden when not applicable', () => {
    it('Given the feature is enabled / Then no Upgrade button', async () => {
      renderAt('/leads');
      await screen.findByTestId('loc');
      expect(screen.queryByRole('button', { name: 'Upgrade plan' })).toBeNull();
    });
    it('Given the feature is disabled / Then no Upgrade button, only the unavailable panel', async () => {
      shellState.getFeatureState = () => 'disabled';
      renderAt('/leads');
      expect(await screen.findByText(/feature unavailable/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upgrade plan' })).toBeNull();
    });
    it('Given the feature is hidden / Then the route redirects to the dashboard with no Upgrade button', async () => {
      shellState.getFeatureState = () => 'hidden';
      renderAt('/leads');
      await screen.findByTestId('loc');
      expect(screen.queryByRole('button', { name: 'Upgrade plan' })).toBeNull();
    });
    it('Given the user lacks the page permission and the feature is locked / Then the access notice shows instead', async () => {
      shellState.hasPermission = () => false;
      shellState.getFeatureState = () => 'locked';
      renderAt('/leads');
      expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Upgrade plan' })).toBeNull();
    });
  });
});
