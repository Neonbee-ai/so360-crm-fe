/**
 * Button-level RBAC for the Target Plans page.
 *
 * The page route itself is gated by an OR of create/update/delete/assign
 * (so anyone who can do ANY plan management action can open the page — see
 * App.tsx), but "can open the page" is not "can do everything on it". These
 * helpers pin the specific code each action needs so New Plan/Edit/Allocate
 * can be granted independently in Roles & Permissions.
 */

export interface PermissionHolder {
  hasPermission?: (code: string) => boolean;
}

export const canCreatePlan = (shell: PermissionHolder | null | undefined): boolean =>
  shell?.hasPermission?.('sales_targets.create') ?? false;

export const canEditPlan = (shell: PermissionHolder | null | undefined): boolean =>
  shell?.hasPermission?.('sales_targets.update') ?? false;

export const canAllocatePlan = (
  shell: PermissionHolder | null | undefined,
  ownerType: string,
): boolean =>
  ownerType === 'team' && (shell?.hasPermission?.('sales_targets.assign') ?? false);
