import { describe, it, expect } from 'vitest';
import { CONDITION_FIELDS, CONDITION_OPS, toRuleBody, emptyRule } from './assignmentRulesService';

describe('Given the assignment rule condition catalogue', () => {
    describe('When the editor lists fields', () => {
        it('Then region, score and product interest are offered', () => {
            const values = CONDITION_FIELDS.map((f) => f.value);
            expect(values).toEqual(expect.arrayContaining(['region', 'score', 'product']));
        });
    });

    describe('When the editor lists operators', () => {
        it('Then the numeric comparisons are offered', () => {
            const values = CONDITION_OPS.map((o) => o.value);
            expect(values).toEqual(expect.arrayContaining(['gt', 'gte', 'lt', 'lte']));
        });
    });

    describe('When a score threshold rule is saved', () => {
        it('Then the condition is sent as a trimmed scalar', () => {
            const rule = { ...emptyRule(), name: 'Hot', target_user_ids: ['u1'], conditions: [{ field: 'score', op: 'gte' as const, value: ' 70 ' }] };
            expect(toRuleBody(rule).conditions).toEqual([{ field: 'score', op: 'gte', value: '70' }]);
        });
    });
});
