import { describe, it, expect, vi } from 'vitest';

/**
 * Feature: assignment rule pool source (RE Phase C) — `project_assigned`
 * draws the pool from the lead's project allocation; the person/department
 * checks do not apply then.
 */

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import { emptyRule, toRuleBody, validateRule, type AssignmentRuleInput } from './assignmentRulesService';

const rule = (over: Partial<AssignmentRuleInput> = {}): AssignmentRuleInput => ({ ...emptyRule(), name: 'Desk', ...over });

describe('Given a rule whose pool is the project agents', () => {
    it('When validated with nobody picked / Then it is valid', () => {
        expect(validateRule(rule({ pool_source: 'project_assigned' }))).toBeNull();
        expect(validateRule(rule({ pool_source: 'project_assigned', target_type: 'department' }))).toBeNull();
    });
    it('When validated without a name / Then the name check still applies', () => {
        expect(validateRule(rule({ name: ' ', pool_source: 'project_assigned' }))).toBe('Give the rule a name.');
    });
    it('When turned into a body / Then it sends pool_source with an empty users target and no department', () => {
        const body = toRuleBody(rule({ pool_source: 'project_assigned', target_type: 'department', target_department_id: 'd1', target_user_ids: ['u1'] }));
        expect(body).toMatchObject({ pool_source: 'project_assigned', target_type: 'users', target_user_ids: [] });
        expect(body).not.toHaveProperty('target_department_id');
    });
});

describe('Given a rule with its own target', () => {
    it('When pool_source is absent / Then the body omits it and the person check applies', () => {
        expect(toRuleBody(rule({ target_user_ids: ['u1'] }))).not.toHaveProperty('pool_source');
        expect(validateRule(rule())).toBe('Pick at least one person.');
    });
    it('When pool_source was cleared to null / Then null is sent so the server clears it', () => {
        const body = toRuleBody(rule({ pool_source: null, target_type: 'department', target_department_id: 'd2' }));
        expect(body).toMatchObject({ pool_source: null, target_type: 'department', target_department_id: 'd2' });
        expect(validateRule(rule({ pool_source: null, target_type: 'department' }))).toBe('Pick a department.');
    });
});
