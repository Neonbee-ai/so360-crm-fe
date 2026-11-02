/**
 * Plan gate for service-layer calls.
 *
 * Several CRM pages that a lower plan can open also load optional panels whose
 * backend routes are plan-gated (`@FeatureRequired`). Since previews/dev
 * enforce entitlements like prod, calling them on a plan that excludes the
 * feature returns 403. Callers check `planAllows(flag)` first and use their
 * empty fallback instead of calling a route the plan does not include.
 *
 * The reader is wired from the Shell in `CrmShellInitializer`. Until it is
 * wired (or while the Shell is still loading flags) every check fails open, so
 * an outage or a missing Shell never hides data the plan does include.
 */
export interface PlanFeatureReader {
  /** Shell `effectiveFlagsLoaded` — false while the flag fetch is in flight. */
  loaded: boolean;
  isFeatureEnabled?: (key: string) => boolean;
  isModuleEnabled?: (moduleId: string) => boolean;
}

export const PLAN_FLAGS = {
  ANALYTICS: 'submodule:crm:analytics',
  PARTNERS: 'submodule:crm:partners',
  AUDIT_TRAIL: 'submodule:crm:audit_trail',
  DEAL_NAMING: 'submodule:crm:deal_naming_settings',
  LINKEDIN_SYNC: 'submodule:crm:linkedin_sync',
  MARKETING_AUDIENCES: 'submodule:marketing:audiences',
} as const;

let reader: PlanFeatureReader | null = null;

export function setPlanFeatureReader(next: PlanFeatureReader | null): void {
  reader = next;
}

/** True unless the loaded Shell flags say the plan excludes `flag`. */
export function planAllows(flag: string): boolean {
  if (!reader || !reader.loaded || typeof reader.isFeatureEnabled !== 'function') return true;
  try {
    return reader.isFeatureEnabled(flag) !== false;
  } catch {
    return true;
  }
}

/**
 * True unless the loaded Shell says `moduleId` is not enabled for the org.
 * Used for cross-module calls (e.g. Marketing audiences) where the Shell's
 * fail-open flag check cannot see a flag the CRM plan never lists.
 */
export function planHasModule(moduleId: string): boolean {
  if (!reader || !reader.loaded || typeof reader.isModuleEnabled !== 'function') return true;
  try {
    return reader.isModuleEnabled(moduleId) !== false;
  } catch {
    return true;
  }
}
