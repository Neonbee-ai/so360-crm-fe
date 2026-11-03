/**
 * Quota limits come from subscription-be POST /v1/quota/resolve/batch, which
 * requires the `quota.read` permission. Roles without it got a 403 on every
 * Leads/Quotes page load (prod-error-log B06), so only fetch when the role can
 * read quotas. When skipped the page simply shows no limit banner; the backend
 * still enforces the quota on create.
 */
export interface QuotaShell {
  permissionsLoaded?: boolean;
  hasPermission?: (permission: string) => boolean;
}

export function canReadQuota(shell: QuotaShell | null | undefined): boolean {
  return shell?.permissionsLoaded === true && (shell?.hasPermission?.('quota.read') ?? false);
}
