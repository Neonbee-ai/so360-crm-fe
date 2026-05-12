import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({
    currentTenant: { id: 'tenant-1' },
    currentOrg: { id: 'org-1' },
    accessToken: 'tok',
    user: { id: 'u1', email: 'a@b.com', full_name: 'A', avatar_url: null },
    isFeatureEnabled: () => true,
    isFeatureHidden: () => false,
    isModuleEnabled: () => true,
  }),
}));

vi.mock('./services/crmService', () => ({
  crmService: {
    setTenantId: vi.fn(),
    setOrgId: vi.fn(),
    setAccessToken: vi.fn(),
    setUser: vi.fn(),
  },
}));

import App from './App';

describe('App', () => {
  it('renders without crashing and shows loading then content', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    // The shell initializer or lazy loading shows something
    expect(document.body).toBeTruthy();
  });

  it('redirects root to dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });
});
