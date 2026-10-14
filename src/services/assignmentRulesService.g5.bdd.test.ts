import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Feature: assignment rule G5 fields (RE plan G5) — language condition,
 * skip-on-leave and the uncontacted-reassign window.
 *
 * The G5 fields are only sent once the rule carries a value, so a save never
 * writes a column crm-be (migration 075) may not have yet.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    assignmentRulesService,
    CONDITION_FIELDS,
    emptyRule,
    MAX_REASSIGN_AFTER_MINUTES,
    parseReassignMinutes,
    toRuleBody,
    validateRule,
    type AssignmentRuleInput,
} from './assignmentRulesService';

beforeEach(() => vi.clearAllMocks());

const valid = (over: Partial<AssignmentRuleInput> = {}): AssignmentRuleInput => ({
    ...emptyRule(),
    name: 'Arabic speakers',
    target_user_ids: ['u1'],
    ...over,
});

describe('Feature: language condition', () => {
    it('Given the condition catalogue / Then Language is offered with the server field key', () => {
        expect(CONDITION_FIELDS).toContainEqual({ value: 'language', label: 'Language' });
    });

    it('Given a language condition / When the body is built / Then it is sent like any other field', () => {
        const body = toRuleBody(valid({ conditions: [{ field: 'language', op: 'in', value: 'Arabic, Hindi' }] }));
        expect(body.conditions).toEqual([{ field: 'language', op: 'in', value: ['Arabic', 'Hindi'] }]);
    });
});

describe('Feature: G5 fields in the request body', () => {
    it('Given a new rule untouched by the user / Then neither G5 field is sent (server defaults apply)', () => {
        expect(emptyRule().skip_on_leave).toBeUndefined();
        expect(emptyRule().reassign_after_minutes).toBeUndefined();
        const body = toRuleBody(valid());
        expect(body).not.toHaveProperty('skip_on_leave');
        expect(body).not.toHaveProperty('reassign_after_minutes');
    });

    it.each([
        [true, 30],
        [false, 10080],
        [true, null],
    ])('Given skip_on_leave=%s and reassign_after_minutes=%s / Then both are sent as given', (skip, minutes) => {
        const body = toRuleBody(valid({ skip_on_leave: skip, reassign_after_minutes: minutes }));
        expect(body.skip_on_leave).toBe(skip);
        expect(body.reassign_after_minutes).toBe(minutes);
    });

    it('Given a rule with a window / When created / Then POST /assignment-rules carries it', async () => {
        api.post.mockResolvedValue({ id: 'r1' });
        await assignmentRulesService.create(valid({ reassign_after_minutes: 45, skip_on_leave: false }));
        expect(api.post).toHaveBeenCalledWith('/assignment-rules', expect.objectContaining({
            reassign_after_minutes: 45,
            skip_on_leave: false,
        }));
    });
});

describe('Feature: reassign window validation', () => {
    it('Then the upper bound is one week, matching crm-be', () => {
        expect(MAX_REASSIGN_AFTER_MINUTES).toBe(10080);
    });

    it.each([[undefined], [null], [1], [30], [10080]])('Given %s minutes / Then the rule can be saved', (minutes) => {
        expect(validateRule(valid({ reassign_after_minutes: minutes as number | null | undefined }))).toBeNull();
    });

    it.each([[0], [-5], [10081], [2.5], [Number.NaN]])('Given %s minutes / Then saving is blocked with the range', (minutes) => {
        expect(validateRule(valid({ reassign_after_minutes: minutes }))).toBe(
            'Reassign after must be a whole number of minutes from 1 to 10080, or empty.',
        );
    });

    it('Given a missing name and a bad window / Then the name problem is reported first', () => {
        expect(validateRule(valid({ name: ' ', reassign_after_minutes: 0 }))).toBe('Give the rule a name.');
    });
});

describe('Feature: editor text to minutes', () => {
    it.each([
        ['', null],
        ['   ', null],
        ['30', 30],
        [' 45 ', 45],
        ['1.5', 1.5],
    ])('Given "%s" / Then it becomes %s', (text, expected) => {
        expect(parseReassignMinutes(text)).toBe(expected);
    });

    it('Given non-numeric text / Then it becomes NaN, which validation rejects', () => {
        const minutes = parseReassignMinutes('abc');
        expect(Number.isNaN(minutes)).toBe(true);
        expect(validateRule(valid({ reassign_after_minutes: minutes }))).not.toBeNull();
    });
});
