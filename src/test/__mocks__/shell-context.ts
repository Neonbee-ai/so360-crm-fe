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
export const useIdentity = () => ({ user: { id: 'mock-user-id', email: 'test@test.com', full_name: 'Test User' } });
export const useShellBridge = () => ({
  isFeatureEnabled: () => true,
  isFeatureHidden: () => false,
});
export const usePeople = () => ({ people: [] });
export const ShellContext = React.createContext<any>({ user: { id: 'mock-user-id', email: 'test@test.com' } });

// Mirrors shell-context useSandboxLimit with sandbox mode off (no truncation).
export const useSandboxLimit = () => ({
  isSandboxMode: false,
  sandboxEntryLimit: 5,
  limitItems: <T,>(items: T[]): T[] => items,
  isLimited: (_count: number): boolean => false,
});
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
export const QUOTA_EXCEEDED_EVENT = '__so360_quota_exceeded';
export const buildQuotaExceededDetail = (error: any): unknown => {
  const data = error?.response?.data ?? {};
  return data?.resolution ?? data;
};

export const useDatasetSchema = (_code?: string) => ({ fields: [] as any[], isLoading: false, error: null });
