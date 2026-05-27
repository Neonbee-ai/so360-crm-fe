import React from 'react';
// Stub for @so360/shell-context — vi.mock() in each test overrides these
export const useShell = () => ({
  isModuleEnabled: () => false,
  isFeatureHidden: () => false,
  isFeatureEnabled: () => true,
});
export const useBusinessSettings = () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } });
export const useNotify = () => ({ emitNotification: async () => {} });
export const useActivity = () => ({ recordActivity: async () => {} });
export const useShellBridge = () => ({
  isFeatureEnabled: () => true,
  isFeatureHidden: () => false,
});
export const usePeople = () => ({ people: [] });
export const ShellContext = React.createContext<any>({ user: { id: 'mock-user-id', email: 'test@test.com' } });

export const useQuota = () => ({
  quotas: [],
  isLoading: false,
  error: null,
  isExceeded: () => false,
  getQuota: () => null,
  getPercentage: () => 0,
  refresh: async () => {},
});

export const useOrganization = () => ({ currentOrg: { id: 'org-1', name: 'Test Org' } });
