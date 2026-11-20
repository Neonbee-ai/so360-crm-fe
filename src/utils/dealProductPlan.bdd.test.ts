import { describe, it, expect } from 'vitest';
import {
    isDealProductPlanOn, isProjectTemplatesOn, DEAL_PRODUCT_PLAN_FLAG, PROJECT_TEMPLATES_FLAG, PLAN_FROM_PRODUCTS_OPTIONS,
    DEFAULT_PLAN_FROM_PRODUCTS, toPlanFromProducts, templateSelectOptions, BLANK_TEMPLATE,
} from './dealProductPlan';

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
    it('When the options are listed (Pulse 202244cb) / Then "One task per deal line" comes first as the default and legacy phases is not offered', () => {
        expect(DEFAULT_PLAN_FROM_PRODUCTS).toBe('tasks');
        expect(PLAN_FROM_PRODUCTS_OPTIONS).toEqual([
            { value: 'tasks', label: 'One task per deal line' },
            { value: 'none', label: 'Blank project' },
        ]);
    });
});

describe('Given a select value for the product plan (Pulse 202244cb)', () => {
    it('When it is an offered value / Then it is kept', () => {
        expect(toPlanFromProducts('none')).toBe('none');
        expect(toPlanFromProducts('tasks')).toBe('tasks');
    });
    it('When it is legacy or unknown / Then it falls back to tasks', () => {
        expect(toPlanFromProducts('phases')).toBe('tasks');
        expect(toPlanFromProducts('')).toBe('tasks');
    });
});

describe('Given the project templates flag reader (Pulse 202244cb)', () => {
    it('When the matrix has not loaded / Then it is off', () => {
        expect(isProjectTemplatesOn({ effectiveFlagsLoaded: false, effectiveFlags: { [PROJECT_TEMPLATES_FLAG]: { enabled: true } } })).toBe(false);
    });
    it('When the key is off or missing / Then it is off', () => {
        expect(isProjectTemplatesOn({ effectiveFlagsLoaded: true, effectiveFlags: {} })).toBe(false);
        expect(isProjectTemplatesOn(undefined)).toBe(false);
    });
    it('When the key is on / Then it is on', () => {
        expect(isProjectTemplatesOn({ effectiveFlagsLoaded: true, effectiveFlags: { [PROJECT_TEMPLATES_FLAG]: { enabled: true } } })).toBe(true);
    });
});

describe('Given project template rows for the deal-close picker (Pulse 202244cb)', () => {
    it('When there are none / Then only the blank choice is offered', () => {
        expect(templateSelectOptions([])).toEqual([{ value: BLANK_TEMPLATE, label: 'No template (blank structure)' }]);
    });
    it('When system and tenant templates mix / Then blank comes first, then system by name, then tenant by name', () => {
        const opts = templateSelectOptions([
            { id: 't3', name: 'Zeta fit-out' },
            { id: 's2', name: 'Interior', is_system: true },
            { id: 't1', name: 'Alpha build' },
            { id: 's1', name: 'Furniture Manufacturing / Small Manufacturing', is_system: true },
        ]);
        expect(opts.map((o) => o.value)).toEqual([BLANK_TEMPLATE, 's1', 's2', 't1', 't3']);
        expect(opts[1].label).toBe('Furniture Manufacturing / Small Manufacturing · System');
        expect(opts[3].label).toBe('Alpha build');
    });
    it('When a row is inactive or has no id / Then it is dropped', () => {
        const opts = templateSelectOptions([
            { id: 'a', name: 'Active' },
            { id: 'b', name: 'Old', is_active: false },
            { id: '', name: 'Broken' },
        ]);
        expect(opts.map((o) => o.value)).toEqual([BLANK_TEMPLATE, 'a']);
    });
});
