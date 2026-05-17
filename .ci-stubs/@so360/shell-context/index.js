export const useShellBridge = () => null;
export const useShell = () => ({
  isModuleEnabled: () => false,
  isFeatureHidden: () => false,
  isFeatureEnabled: () => true,
});
export const useBusinessSettings = () => ({ settings: { base_currency: 'USD', timezone: 'UTC' } });
export const useNotify = () => ({ emitNotification: () => {} });
export const useActivity = () => ({ recordActivity: async () => {} });
export const usePeople = () => ({ people: [] });
export const useTenant = () => ({ id: 'test-tenant' });
export const useOrganization = () => ({ id: 'test-org' });
export const useIdentity = () => ({ user: null });
export const ShellContext = {};
export const eventBus = { publish: () => {}, subscribe: () => () => {} };
export default {};
