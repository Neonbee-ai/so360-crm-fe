import { describe, it, expect } from 'vitest';
import { isFeatureEnabled, getEnabledFeatures, FEATURES } from './features';
import type { FeatureFlag } from './features';

describe('isFeatureEnabled', () => {
  describe('Given a feature that is enabled in the registry', () => {
    it('When DEAL_ESTIMATE_REQUEST is checked / Then returns true', () => {
      expect(isFeatureEnabled('DEAL_ESTIMATE_REQUEST')).toBe(true);
    });

    it('When DEAL_INVOICE_REQUEST is checked / Then returns true', () => {
      expect(isFeatureEnabled('DEAL_INVOICE_REQUEST')).toBe(true);
    });

    it('When LEAD_SCORING is checked / Then returns true', () => {
      expect(isFeatureEnabled('LEAD_SCORING')).toBe(true);
    });

    it('When CUSTOM_FIELDS is checked / Then returns true', () => {
      expect(isFeatureEnabled('CUSTOM_FIELDS')).toBe(true);
    });

    it('When DOCUMENT_UPLOAD is checked / Then returns true', () => {
      expect(isFeatureEnabled('DOCUMENT_UPLOAD')).toBe(true);
    });
  });

  describe('Given a feature that is disabled in the registry', () => {
    it('When DEAL_ACTIVITIES_ENDPOINT is checked / Then returns false', () => {
      expect(isFeatureEnabled('DEAL_ACTIVITIES_ENDPOINT')).toBe(false);
    });

    it('When GLOBAL_ACTIVITIES_ENDPOINT is checked / Then returns false', () => {
      expect(isFeatureEnabled('GLOBAL_ACTIVITIES_ENDPOINT')).toBe(false);
    });

    it('When TASK_DESCRIPTION_FIELD is checked / Then returns false', () => {
      expect(isFeatureEnabled('TASK_DESCRIPTION_FIELD')).toBe(false);
    });
  });

  describe('Given any flag key in the FEATURES registry', () => {
    it('When each flag is checked / Then the result matches its value in the registry', () => {
      for (const [key, value] of Object.entries(FEATURES)) {
        expect(isFeatureEnabled(key as FeatureFlag)).toBe(value);
      }
    });
  });
});

describe('getEnabledFeatures', () => {
  describe('Given the feature registry', () => {
    it('When called / Then returns only enabled feature keys', () => {
      const enabled = getEnabledFeatures();
      for (const flag of enabled) {
        expect(FEATURES[flag]).toBe(true);
      }
    });

    it('When called / Then does not include any disabled features', () => {
      const enabled = getEnabledFeatures();
      expect(enabled).not.toContain('DEAL_ACTIVITIES_ENDPOINT');
      expect(enabled).not.toContain('GLOBAL_ACTIVITIES_ENDPOINT');
      expect(enabled).not.toContain('TASK_DESCRIPTION_FIELD');
    });

    it('When called / Then returns an array of strings', () => {
      const enabled = getEnabledFeatures();
      expect(Array.isArray(enabled)).toBe(true);
      enabled.forEach((f) => expect(typeof f).toBe('string'));
    });

    it('When called / Then the count matches the number of true entries in FEATURES', () => {
      const expectedCount = Object.values(FEATURES).filter(Boolean).length;
      expect(getEnabledFeatures()).toHaveLength(expectedCount);
    });
  });
});
