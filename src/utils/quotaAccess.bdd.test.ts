import { describe, it, expect } from 'vitest';
import { canReadQuota } from './quotaAccess';

describe('canReadQuota', () => {
  it('given permissions are loaded and the role holds quota.read, when checked, then the quota fetch is allowed', () => {
    expect(canReadQuota({ permissionsLoaded: true, hasPermission: (p) => p === 'quota.read' })).toBe(true);
  });

  it('given the role lacks quota.read, when checked, then the quota fetch is skipped (no 403)', () => {
    expect(canReadQuota({ permissionsLoaded: true, hasPermission: () => false })).toBe(false);
  });

  it('given permissions are still loading, when checked, then the quota fetch waits', () => {
    expect(canReadQuota({ permissionsLoaded: false, hasPermission: () => true })).toBe(false);
  });

  it('given no shell bridge, when checked, then the quota fetch is skipped', () => {
    expect(canReadQuota(undefined)).toBe(false);
  });
});
