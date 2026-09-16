import { describe, it, expect } from 'vitest';
import { canCreatePlan, canEditPlan, canAllocatePlan } from './targetPlanPermissions';

/**
 * BDD specs for Target Plans button-level RBAC.
 *
 * The page route opens on ANY of create/update/delete/assign (App.tsx), but
 * that only decides whether the page is reachable at all — these gate the
 * individual New Plan / Edit / Allocate actions once inside it, so a role
 * holding only `sales_targets.create` (say) sees New Plan but not Edit.
 */

const shellWith = (...granted: string[]) => ({
  hasPermission: (code: string) => granted.includes(code),
});

describe('Given the Target Plans "New plan" button', () => {
  it('When the caller holds sales_targets.create / Then it is shown', () => {
    expect(canCreatePlan(shellWith('sales_targets.create'))).toBe(true);
  });

  it('When the caller holds only sales_targets.update / Then it is hidden', () => {
    expect(canCreatePlan(shellWith('sales_targets.update'))).toBe(false);
  });

  it('When the caller holds no permissions at all / Then it is hidden', () => {
    expect(canCreatePlan(shellWith())).toBe(false);
  });

  it('When there is no shell bridge yet (still loading) / Then it fails closed, not open', () => {
    expect(canCreatePlan(null)).toBe(false);
    expect(canCreatePlan(undefined)).toBe(false);
  });

  it('When hasPermission itself is missing from the bridge / Then it fails closed', () => {
    expect(canCreatePlan({})).toBe(false);
  });
});

describe('Given the Target Plans row "Edit" button', () => {
  it('When the caller holds sales_targets.update / Then it is shown', () => {
    expect(canEditPlan(shellWith('sales_targets.update'))).toBe(true);
  });

  it('When the caller holds only sales_targets.create / Then it is hidden', () => {
    // Creating a plan and editing an existing one are deliberately separate
    // grants — a role that can only originate plans must not also be able to
    // silently rewrite someone else's.
    expect(canEditPlan(shellWith('sales_targets.create'))).toBe(false);
  });
});

describe('Given the Target Plans row "Allocate" button', () => {
  it('When the plan is team-owned and the caller holds sales_targets.assign / Then it is shown', () => {
    expect(canAllocatePlan(shellWith('sales_targets.assign'), 'team')).toBe(true);
  });

  it('When the plan is team-owned but the caller lacks sales_targets.assign / Then it is hidden', () => {
    expect(canAllocatePlan(shellWith('sales_targets.create', 'sales_targets.update'), 'team')).toBe(
      false,
    );
  });

  it("When the caller holds sales_targets.assign but the plan is NOT team-owned / Then it is hidden regardless", () => {
    // Allocation only makes sense for a team plan being split across
    // individuals; an individual-owned plan has nothing to allocate.
    expect(canAllocatePlan(shellWith('sales_targets.assign'), 'individual')).toBe(false);
  });

  it('When there is no shell bridge yet / Then it fails closed', () => {
    expect(canAllocatePlan(null, 'team')).toBe(false);
  });
});
