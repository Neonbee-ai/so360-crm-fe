import { useShellBridge } from '@so360/shell-context';

/**
 * RE §48 — may the user export here? Needs the RBAC permission (the API
 * enforces it too) and, when given, an effective feature flag. Both fail
 * closed until the shell has loaded them.
 */
export function useCanExport(permission: string, flagKey?: string): boolean {
    const shell = useShellBridge() as any;
    const allowed = shell?.permissionsLoaded === true && (shell?.hasPermission?.(permission) ?? false);
    if (!allowed) return false;
    if (!flagKey) return true;
    return shell?.effectiveFlagsLoaded !== false && (shell?.isFeatureEnabled?.(flagKey) ?? false);
}
