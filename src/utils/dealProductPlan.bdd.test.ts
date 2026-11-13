import { describe, it, expect } from 'vitest';
import { isDealProductPlanOn, DEAL_PRODUCT_PLAN_FLAG, PLAN_FROM_PRODUCTS_OPTIONS } from './dealProductPlan';

describe('Given the deal product plan flag reader', () => {
    it('When the bridge is missing / Then it is off', () => {
        expect(isDealProductPlanOn(null)).toBe(false);
    });
    it('When the matrix has not loaded / Then it is off', () => {
        expect(isDealProductPlanOn({ effectiveFlagsLoaded: false, effectiveFlags: { [DEAL_PRODUCT_PLAN_FLAG]: { enabled: true } } })).toBe(false);
    });
    it('When the key is not registered / Then it is off', () => {
        expect(isDealProductPlanOn({ effectiveFlagsLoaded: true, effectiveFlags: {} })).toBe(false);
    });
    it('When the key is on / Then it is on', () => {
        expect(isDealProductPlanOn({ effectiveFlagsLoaded: true, effectiveFlags: { [DEAL_PRODUCT_PLAN_FLAG]: { enabled: true } } })).toBe(true);
    });
    it('When the options are listed / Then "Blank project" comes first as the default', () => {
        expect(PLAN_FROM_PRODUCTS_OPTIONS[0]).toEqual({ value: 'none', label: 'Blank project' });
    });
});
