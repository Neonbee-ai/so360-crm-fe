/**
 * Pulse b1512967 — "plan a project from the won deal's products".
 * Off for every tenant until the flag is registered and on (fail-closed), so
 * the deal close form stays exactly as it is today.
 */
export const DEAL_PRODUCT_PLAN_FLAG = 'submodule:projects:deal_product_plan';

export type PlanFromProducts = 'phases' | 'none';

export const PLAN_FROM_PRODUCTS_OPTIONS: ReadonlyArray<{ value: PlanFromProducts; label: string }> = [
    { value: 'phases', label: 'Plan from deal products' },
    { value: 'none', label: 'Blank project' },
];

interface FlagBridgeLike {
    effectiveFlagsLoaded?: boolean;
    effectiveFlags?: Record<string, { enabled?: boolean } | undefined>;
}

/** Strict read: true only when the effective matrix has loaded and the key is on. */
export function isDealProductPlanOn(shell: FlagBridgeLike | null | undefined): boolean {
    return !!shell && shell.effectiveFlagsLoaded === true && shell.effectiveFlags?.[DEAL_PRODUCT_PLAN_FLAG]?.enabled === true;
}
