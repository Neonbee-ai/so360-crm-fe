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
  useDatasetSchema: () => ({ fields: [], isLoading: false, error: null }),
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

vi.mock('./pages/PipelinePage', () => ({ default: () => <div data-testid="pipeline-page" /> }));
vi.mock('./pages/DealDetailPage', () => ({
  default: () => { const { id } = useParams(); return <div data-testid="deal-detail-page" data-id={id ?? ''} />; },
}));

import App from './App';

const Probe = () => <div data-testid="loc">{useLocation().pathname}</div>;
const renderAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><App /><Probe /></MemoryRouter>);

beforeEach(() => {
  shellState.getFeatureState = () => 'enabled';
  shellState.hasPermission = () => true;
  shellState.permissionsLoaded = true;
});

describe('Given the plural /deals URLs that users and links expect', () => {
  describe('When /deals is opened', () => {
    it('Then it redirects to the pipeline board', async () => {
      renderAt('/deals');
      expect(await screen.findByTestId('pipeline-page')).toBeTruthy();
      expect(screen.getByTestId('loc').textContent).toMatch(/\/pipeline$/);
    });
  });
  describe('When /deals/d-42 is opened', () => {
    it('Then the deal detail page renders with that id (no Page Not Found)', async () => {
      renderAt('/deals/d-42');
      expect((await screen.findByTestId('deal-detail-page')).getAttribute('data-id')).toBe('d-42');
      expect(screen.queryByText(/page not found/i)).toBeNull();
    });
  });
  describe('When /deal/d-42 (singular, existing) is opened', () => {
    it('Then the same deal detail page still renders', async () => {
      renderAt('/deal/d-42');
      expect((await screen.findByTestId('deal-detail-page')).getAttribute('data-id')).toBe('d-42');
    });
  });
  describe('When /deals/d-42 is opened without deals.read', () => {
    it('Then the deal detail page is not rendered', async () => {
      shellState.hasPermission = () => false;
      renderAt('/deals/d-42');
      await screen.findByTestId('loc');
      expect(screen.queryByTestId('deal-detail-page')).toBeNull();
    });
  });
  describe('When /deals/d-42 is opened with the pipeline flag disabled', () => {
    it('Then the unavailable panel shows instead of the deal', async () => {
      shellState.getFeatureState = (f) => (f === 'submodule:crm:pipeline' ? 'disabled' : 'enabled');
      renderAt('/deals/d-42');
      expect(await screen.findByText(/feature unavailable/i)).toBeTruthy();
      expect(screen.queryByTestId('deal-detail-page')).toBeNull();
    });
  });
});
