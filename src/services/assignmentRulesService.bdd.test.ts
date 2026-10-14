import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    assignmentRulesService, toRuleBody, validateRule, emptyRule, CONDITION_FIELDS, CONDITION_OPS, ASSIGNMENT_METHODS,
} from './assignmentRulesService';

beforeEach(() => vi.clearAllMocks());

describe('Given the assignment rules service', () => {
    describe('When rules are listed', () => {
        it('Then GET /assignment-rules is called and a non-list reads as empty', async () => {
            api.get.mockResolvedValueOnce([{ id: 'r1' }]);
            expect(await assignmentRulesService.list()).toEqual([{ id: 'r1' }]);
            expect(api.get).toHaveBeenCalledWith('/assignment-rules');
            api.get.mockResolvedValueOnce(null);
            expect(await assignmentRulesService.list()).toEqual([]);
        });
    });

    describe('When a rule is created', () => {
        it('Then the normalised body is posted', async () => {
            api.post.mockResolvedValueOnce({ id: 'r1' });
            await assignmentRulesService.create({ ...emptyRule(), name: ' FB ', target_user_ids: ['u1'] });
            expect(api.post).toHaveBeenCalledWith('/assignment-rules', expect.objectContaining({ name: 'FB', target_type: 'users', target_user_ids: ['u1'] }));
        });
    });

    describe('When a rule is updated, removed, reordered or tested', () => {
        it('Then each hits its crm-be route', async () => {
            api.patch.mockResolvedValue({});
            api.delete.mockResolvedValue({ success: true });
            api.post.mockResolvedValue([{ id: 'b' }, { id: 'a' }]);
            await assignmentRulesService.update('r1', { is_active: false });
            expect(api.patch).toHaveBeenCalledWith('/assignment-rules/r1', { is_active: false });
            await assignmentRulesService.remove('r1');
            expect(api.delete).toHaveBeenCalledWith('/assignment-rules/r1');
            expect(await assignmentRulesService.reorder(['b', 'a'])).toEqual([{ id: 'b' }, { id: 'a' }]);
            expect(api.post).toHaveBeenCalledWith('/assignment-rules/reorder', { ids: ['b', 'a'] });
            await assignmentRulesService.test({ source: 'facebook' });
            expect(api.post).toHaveBeenCalledWith('/assignment-rules/test', { lead: { source: 'facebook' } });
        });
    });
});

describe('Given editor state (toRuleBody)', () => {
    describe('When conditions hold comma lists, blanks and a department target', () => {
        it('Then "in" values split, blanks drop and only the department id is sent', () => {
            const body = toRuleBody({
                ...emptyRule(),
                name: 'Dept',
                target_type: 'department',
                target_department_id: 'd1',
                target_user_ids: ['u1'],
                conditions: [
                    { field: 'source', op: 'in', value: 'facebook, google ,' },
                    { field: 'city', op: 'eq', value: '  ' },
                    { field: 'project', op: 'contains', value: ' marina ' },
                ],
            });
            expect(body.conditions).toEqual([
                { field: 'source', op: 'in', value: ['facebook', 'google'] },
                { field: 'project', op: 'contains', value: 'marina' },
            ]);
            expect(body.target_department_id).toBe('d1');
            expect(body).not.toHaveProperty('target_user_ids');
        });
    });
});

describe('Given validateRule', () => {
    describe('When the name or target is missing', () => {
        it('Then a reason is returned, and null once complete', () => {
            expect(validateRule(emptyRule())).toMatch(/name/i);
            expect(validateRule({ ...emptyRule(), name: 'x' })).toMatch(/person/i);
            expect(validateRule({ ...emptyRule(), name: 'x', target_type: 'department' })).toMatch(/department/i);
            expect(validateRule({ ...emptyRule(), name: 'x', target_user_ids: ['u1'] })).toBeNull();
        });
    });
});

describe('Given further toRuleBody inputs', () => {
    describe('When a condition value is already an array', () => {
        it('Then an "in" array is trimmed and an "eq" array is joined into one string', () => {
            const body = toRuleBody({
                ...emptyRule(),
                name: 'Arr',
                conditions: [
                    { field: 'source', op: 'in', value: [' a ', '', 'b'] },
                    { field: 'city', op: 'eq', value: ['x', 'y'] },
                ],
            });
            expect(body.conditions).toEqual([
                { field: 'source', op: 'in', value: ['a', 'b'] },
                { field: 'city', op: 'eq', value: 'x,y' },
            ]);
        });
    });
    describe('When a condition value is null or an "in" list is all blanks', () => {
        it('Then those conditions are dropped', () => {
            const body = toRuleBody({
                ...emptyRule(),
                name: 'Nulls',
                conditions: [
                    { field: 'source', op: 'eq', value: null as unknown as string },
                    { field: 'campaign', op: 'in', value: undefined as unknown as string },
                    { field: 'city', op: 'in', value: ' , ,' },
                ],
            });
            expect(body.conditions).toEqual([]);
        });
    });
    describe('When the department target has no department picked', () => {
        it('Then neither target id key is sent', () => {
            const body = toRuleBody({ ...emptyRule(), name: 'D', target_type: 'department', target_department_id: null });
            expect(body).not.toHaveProperty('target_department_id');
            expect(body).not.toHaveProperty('target_user_ids');
            expect(body).toMatchObject({ name: 'D', is_active: true, method: 'round_robin', skip_inactive: true, target_type: 'department' });
        });
    });
    describe('When the users target is chosen', () => {
        it('Then the department id is never sent', () => {
            const body = toRuleBody({ ...emptyRule(), name: 'U', target_department_id: 'd9', target_user_ids: ['u1', 'u2'] });
            expect(body.target_user_ids).toEqual(['u1', 'u2']);
            expect(body).not.toHaveProperty('target_department_id');
        });
    });
});

describe('Given reorder returns something that is not a list', () => {
    it('Then it reads as an empty list', async () => {
        api.post.mockResolvedValueOnce({ unexpected: true });
        expect(await assignmentRulesService.reorder(['a'])).toEqual([]);
    });
});

describe('Given the editor option catalogues', () => {
    it('Then fields, operators and methods carry the agreed values', () => {
        expect(CONDITION_FIELDS.map(f => f.value)).toEqual(['source', 'project', 'campaign', 'city', 'language']);
        expect(CONDITION_OPS.map(o => o.value)).toEqual(['eq', 'in', 'contains']);
        expect(ASSIGNMENT_METHODS.map(m => m.value)).toEqual(['round_robin', 'least_loaded', 'fixed']);
        expect(emptyRule()).toEqual({
            name: '', is_active: true, conditions: [], target_type: 'users', target_department_id: null,
            target_user_ids: [], method: 'round_robin', skip_inactive: true,
        });
    });
});

describe('Given validateRule with whitespace names and a picked department', () => {
    it('Then a blank name is rejected and a department rule with an id passes', () => {
        expect(validateRule({ ...emptyRule(), name: '   ', target_user_ids: ['u1'] })).toBe('Give the rule a name.');
        expect(validateRule({ ...emptyRule(), name: 'x', target_type: 'department', target_department_id: 'd1' })).toBeNull();
    });
});
