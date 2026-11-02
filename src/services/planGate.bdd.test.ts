import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { planAllows, planHasModule, setPlanFeatureReader, PLAN_FLAGS } from './planGate';
import { crmService, orgStaticCache, partnersApi, timelineApi } from './crmService';
import { DEFAULT_DEAL_NAMING_CONFIG } from '../types/crm';

function ok(data: any) {
  return Promise.resolve({
    ok: true, status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  } as any);
}
const calledPaths = () => fetchMock.mock.calls.map((c) => String(c[0]));
const lockedPlan = (locked: string[], modules: string[] = ['crm']) =>
  setPlanFeatureReader({
    loaded: true,
    isFeatureEnabled: (k) => !locked.includes(k),
    isModuleEnabled: (m) => modules.includes(m),
  });

beforeEach(() => { fetchMock.mockReset(); fetchMock.mockImplementation(() => ok([])); orgStaticCache.invalidate(); });
afterEach(() => setPlanFeatureReader(null));

describe('planGate', () => {
  describe('Given no Shell reader is wired', () => {
    it('When a flag or module is checked / Then it fails open', () => {
      expect(planAllows(PLAN_FLAGS.PARTNERS)).toBe(true);
      expect(planHasModule('marketing')).toBe(true);
    });
  });
  describe('Given the Shell is still loading flags', () => {
    it('When a flag is checked / Then it fails open', () => {
      setPlanFeatureReader({ loaded: false, isFeatureEnabled: () => false, isModuleEnabled: () => false });
      expect(planAllows(PLAN_FLAGS.PARTNERS)).toBe(true);
      expect(planHasModule('marketing')).toBe(true);
    });
  });
  describe('Given the Shell flag check throws', () => {
    it('When a flag is checked / Then it fails open', () => {
      setPlanFeatureReader({ loaded: true, isFeatureEnabled: () => { throw new Error('x'); }, isModuleEnabled: () => { throw new Error('x'); } });
      expect(planAllows(PLAN_FLAGS.PARTNERS)).toBe(true);
      expect(planHasModule('marketing')).toBe(true);
    });
  });
  describe('Given loaded flags lock a feature', () => {
    it('When it is checked / Then it is denied and others allowed', () => {
      lockedPlan([PLAN_FLAGS.PARTNERS]);
      expect(planAllows(PLAN_FLAGS.PARTNERS)).toBe(false);
      expect(planAllows(PLAN_FLAGS.ANALYTICS)).toBe(true);
      expect(planHasModule('marketing')).toBe(false);
      expect(planHasModule('crm')).toBe(true);
    });
  });
});

describe('CRM service calls on a plan without the gated features', () => {
  beforeEach(() => lockedPlan(Object.values(PLAN_FLAGS)));

  it('Given partners are locked / When partners load / Then [] and no /partners call', async () => {
    await expect(partnersApi.getAll()).resolves.toEqual([]);
    expect(calledPaths().some((u) => u.includes('/partners'))).toBe(false);
  });
  it('Given the audit trail is locked / When a timeline loads / Then empty page and no audit-trail call', async () => {
    const r = await timelineApi.getTimeline('lead', 'l1');
    expect(r.data).toEqual([]);
    expect(r.nextCursor).toBeNull();
    expect(calledPaths().some((u) => u.includes('/audit-trail/'))).toBe(false);
  });
  it('Given deal naming is locked / When settings load / Then default config and no deal-naming call', async () => {
    const s = await crmService.getSettings();
    expect((s as any).deal_naming).toEqual(DEFAULT_DEAL_NAMING_CONFIG);
    await expect(crmService.getDealNamingSettings()).resolves.toEqual(DEFAULT_DEAL_NAMING_CONFIG);
    expect(calledPaths().some((u) => u.includes('/settings/deal-naming'))).toBe(false);
  });
  it('Given analytics is locked / When dashboard stats load / Then zeroed + analyticsLocked and no analytics call', async () => {
    const d: any = await crmService.getDashboardStats();
    expect(d.analyticsLocked).toBe(true);
    expect(d.financials.totalRevenue).toBe(0);
    expect(calledPaths().some((u) => u.includes('/analytics/'))).toBe(false);
  });
});

describe('CRM service calls on a plan that includes the features', () => {
  beforeEach(() => lockedPlan([]));

  it('Given partners are included / When partners load / Then /partners is called', async () => {
    await partnersApi.getAll();
    expect(calledPaths().some((u) => u.includes('/partners'))).toBe(true);
  });
  it('Given the audit trail is included / When a timeline loads / Then the audit-trail route is called', async () => {
    fetchMock.mockImplementation(() => ok({ data: [], nextCursor: null, summary: {} }));
    await timelineApi.getTimeline('lead', 'l1');
    expect(calledPaths().some((u) => u.includes('/audit-trail/lead/l1/timeline'))).toBe(true);
  });
  it('Given deal naming is included / When deal naming loads / Then the route is called', async () => {
    fetchMock.mockImplementation(() => ok(DEFAULT_DEAL_NAMING_CONFIG));
    await crmService.getDealNamingSettings();
    expect(calledPaths().some((u) => u.includes('/settings/deal-naming'))).toBe(true);
  });
  it('Given analytics is included / When dashboard stats load / Then /analytics/dashboard is called', async () => {
    await crmService.getDashboardStats();
    expect(calledPaths().some((u) => u.includes('/analytics/dashboard'))).toBe(true);
  });
});
