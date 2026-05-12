import { describe, it, expect } from 'vitest';
import { isFeatureEnabled, getEnabledFeatures, FEATURES } from './features';
import type { FeatureFlag } from './features';

describe('isFeatureEnabled', () => {
  it('returns true for an enabled feature', () => {
    expect(isFeatureEnabled('DEAL_INVOICE_REQUEST')).toBe(true);
    expect(isFeatureEnabled('LEAD_SCORING')).toBe(true);
    expect(isFeatureEnabled('CUSTOM_FIELDS')).toBe(true);
    expect(isFeatureEnabled('DOCUMENT_UPLOAD')).toBe(true);
  });

  it('returns false for a disabled feature', () => {
    expect(isFeatureEnabled('DEAL_ACTIVITIES_ENDPOINT')).toBe(false);
    expect(isFeatureEnabled('GLOBAL_ACTIVITIES_ENDPOINT')).toBe(false);
    expect(isFeatureEnabled('TASK_DESCRIPTION_FIELD')).toBe(false);
  });

  it('matches the value in the FEATURES object', () => {
    for (const [key, value] of Object.entries(FEATURES)) {
      expect(isFeatureEnabled(key as FeatureFlag)).toBe(value);
    }
  });
});

describe('getEnabledFeatures', () => {
  it('returns only the features that are true', () => {
    const enabled = getEnabledFeatures();
    for (const flag of enabled) {
      expect(FEATURES[flag]).toBe(true);
    }
  });

  it('does NOT include disabled features', () => {
    const enabled = getEnabledFeatures();
    expect(enabled).not.toContain('DEAL_ACTIVITIES_ENDPOINT');
    expect(enabled).not.toContain('GLOBAL_ACTIVITIES_ENDPOINT');
    expect(enabled).not.toContain('TASK_DESCRIPTION_FIELD');
  });

  it('returns an array of strings', () => {
    const enabled = getEnabledFeatures();
    expect(Array.isArray(enabled)).toBe(true);
    enabled.forEach((f) => expect(typeof f).toBe('string'));
  });

  it('has the correct count of enabled features', () => {
    const expectedCount = Object.values(FEATURES).filter(Boolean).length;
    expect(getEnabledFeatures()).toHaveLength(expectedCount);
  });
});
