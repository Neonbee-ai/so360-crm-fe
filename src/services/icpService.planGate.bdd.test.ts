import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const neura = vi.hoisted(() => ({ post: vi.fn() }));
const mkt = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api, crmNeuraClient: neura, crmMarketingClient: mkt }));

import { icpService } from './icpService';
import { setPlanFeatureReader, PLAN_FLAGS } from './planGate';

beforeEach(() => { api.get.mockReset().mockResolvedValue([{ id: 'i1' }]); mkt.get.mockReset().mockResolvedValue([{ id: 'a', name: 'A' }]); });
afterEach(() => setPlanFeatureReader(null));

describe('icpService plan gate', () => {
  describe('Given a plan without LinkedIn sync or Marketing', () => {
    beforeEach(() => setPlanFeatureReader({
      loaded: true,
      isFeatureEnabled: (k) => k !== PLAN_FLAGS.LINKEDIN_SYNC,
      isModuleEnabled: (m) => m === 'crm',
    }));
    it('When ICPs load / Then [] and no /linkedin-sync/icps call', async () => {
      expect(await icpService.list()).toEqual([]);
      expect(api.get).not.toHaveBeenCalled();
    });
    it('When audiences load / Then [] and no marketing call', async () => {
      expect(await icpService.audiences()).toEqual([]);
      expect(mkt.get).not.toHaveBeenCalled();
    });
  });
  describe('Given Marketing is enabled but its audiences flag is locked', () => {
    it('When audiences load / Then [] and no marketing call', async () => {
      setPlanFeatureReader({ loaded: true, isFeatureEnabled: (k) => k !== PLAN_FLAGS.MARKETING_AUDIENCES, isModuleEnabled: () => true });
      expect(await icpService.audiences()).toEqual([]);
      expect(mkt.get).not.toHaveBeenCalled();
    });
  });
  describe('Given a plan with LinkedIn sync and Marketing audiences', () => {
    beforeEach(() => setPlanFeatureReader({ loaded: true, isFeatureEnabled: () => true, isModuleEnabled: () => true }));
    it('When ICPs and audiences load / Then both routes are called', async () => {
      expect(await icpService.list()).toEqual([{ id: 'i1' }]);
      expect(await icpService.audiences()).toEqual([{ id: 'a', name: 'A' }]);
      expect(api.get).toHaveBeenCalledWith('/linkedin-sync/icps');
      expect(mkt.get).toHaveBeenCalledWith('/v1/marketing/audiences');
    });
  });
});
