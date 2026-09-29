import { useShellBridge } from '@so360/shell-context';

/**
 * Real-estate sales feature flags. Each is off for every tenant whose plan /
 * industry does not grant it, so non-RE tenants see no change at all.
 */
export const RE_FLAGS = {
    LEAD_ASSIGNMENT: 'submodule:crm:lead_assignment',
    BULK_IMPORT: 'action:crm:bulk_import',
    UNIT_BOOKING: 'submodule:crm:unit_booking',
    PROPERTY_MATCHING: 'submodule:crm:property_matching',
    RE_WIDGETS: 'submodule:crm:re_widgets',
    PAYMENT_PLANS: 'submodule:crm:payment_plans',
    COMMISSIONS: 'submodule:crm:commissions',
    UNIT_ALLOCATION: 'action:crm:unit_allocation',
} as const;

/**
 * True only once the shell's effective flags are loaded AND the key is on.
 * Same rule as the Neura copilot gate on LeadDetailPage: a missing bridge or
 * a missing `isFeatureEnabled` reads as "off", never as "on".
 */
export function useCrmFeatureFlag(key: string): boolean {
    const shell = useShellBridge() as any;
    return (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.(key) ?? false);
}
