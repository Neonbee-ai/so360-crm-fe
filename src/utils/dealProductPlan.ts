/**
 * Pulse b1512967 — "plan a project from the won deal's products".
 * Off for every tenant until the flag is registered and on (fail-closed), so
 * the deal close form stays exactly as it is today.
 *
 * Pulse 202244cb — since projects-be #133 a deal's lines become ONE board task
 * each ('tasks'), which is also what Projects does when CRM sends no choice.
 * 'phases' (one phase per product) is legacy: still accepted by the API, no
 * longer offered here.
 */
export const DEAL_PRODUCT_PLAN_FLAG = 'submodule:projects:deal_product_plan';

/**
 * Projects' own template flag (gates GET /project-templates on projects-be).
 * Reused for the deal-close template picker: no separate CRM flag.
 */
export const PROJECT_TEMPLATES_FLAG = 'submodule:projects:templates';

export type PlanFromProducts = 'tasks' | 'phases' | 'none';

export const DEFAULT_PLAN_FROM_PRODUCTS: PlanFromProducts = 'tasks';

export const PLAN_FROM_PRODUCTS_OPTIONS: ReadonlyArray<{ value: PlanFromProducts; label: string }> = [
    { value: 'tasks', label: 'One task per deal line' },
    { value: 'none', label: 'Blank project' },
];

/** Narrow a select value to an offered plan; anything else falls back to the default. */
export function toPlanFromProducts(value: string): PlanFromProducts {
    return PLAN_FROM_PRODUCTS_OPTIONS.some((o) => o.value === value) ? (value as PlanFromProducts) : DEFAULT_PLAN_FROM_PRODUCTS;
}

interface FlagBridgeLike {
    effectiveFlagsLoaded?: boolean;
    effectiveFlags?: Record<string, { enabled?: boolean } | undefined>;
}

/** Strict read: true only when the effective matrix has loaded and the key is on. */
function isStrictFlagOn(shell: FlagBridgeLike | null | undefined, key: string): boolean {
    return !!shell && shell.effectiveFlagsLoaded === true && shell.effectiveFlags?.[key]?.enabled === true;
}

export function isDealProductPlanOn(shell: FlagBridgeLike | null | undefined): boolean {
    return isStrictFlagOn(shell, DEAL_PRODUCT_PLAN_FLAG);
}

export function isProjectTemplatesOn(shell: FlagBridgeLike | null | undefined): boolean {
    return isStrictFlagOn(shell, PROJECT_TEMPLATES_FLAG);
}

/** Row shape of projects-be GET /project-templates (only what the picker reads). */
export interface ProjectTemplateOption {
    id: string;
    name: string;
    is_system?: boolean;
    industry_key?: string | null;
    is_active?: boolean;
}

export const BLANK_TEMPLATE = '';

/**
 * Same order as New Project's TemplatePicker: blank first, then system
 * templates, then tenant/org ones, each by name. Inactive rows are dropped.
 */
export function templateSelectOptions(rows: ReadonlyArray<ProjectTemplateOption>): Array<{ value: string; label: string }> {
    const active = rows.filter((r) => r && r.id && r.is_active !== false);
    const sorted = [...active].sort((a, b) => Number(!!b.is_system) - Number(!!a.is_system) || a.name.localeCompare(b.name));
    return [
        { value: BLANK_TEMPLATE, label: 'No template (blank structure)' },
        ...sorted.map((t) => ({ value: t.id, label: t.is_system ? `${t.name} · System` : t.name })),
    ];
}
