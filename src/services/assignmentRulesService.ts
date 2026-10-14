import { crmApiClient } from './crmService';

/**
 * Lead auto-assignment rules (A5). crm-be has no /v1 prefix.
 *
 *  GET    /assignment-rules              → AssignmentRule[] (evaluation order)
 *  POST   /assignment-rules              → AssignmentRule
 *  PATCH  /assignment-rules/:id          → AssignmentRule
 *  DELETE /assignment-rules/:id          → { success: true }
 *  POST   /assignment-rules/reorder {ids} → AssignmentRule[] (first id = priority 0)
 *  POST   /assignment-rules/test {lead}   → AssignmentTestResult (dry run)
 *
 * G5 fields (crm-be migration 075): `skip_on_leave` (default true on the
 * server) and `reassign_after_minutes` (1..10080, null = never). Both are only
 * sent once the rule carries a value for them, so saving a rule never depends
 * on those columns existing.
 */

export type AssignmentTargetType = 'department' | 'users';
export type AssignmentMethod = 'round_robin' | 'least_loaded' | 'fixed';
export type AssignmentConditionOp = 'eq' | 'in' | 'contains';

export interface AssignmentCondition {
    /** source | project | campaign | city | language | custom:<key> */
    field: string;
    op: AssignmentConditionOp;
    value: string | string[];
}

/**
 * RE Phase C: where the rule's pool comes from. `project_assigned` = the
 * agents allocated to the lead's project (resolved server-side); the
 * target fields are ignored then. Absent/null = the rule's own target.
 */
export type AssignmentPoolSource = 'project_assigned';

export interface AssignmentRule {
    id: string;
    name: string;
    priority: number;
    is_active: boolean;
    conditions: AssignmentCondition[];
    target_type: AssignmentTargetType;
    target_department_id: string | null;
    target_user_ids: string[];
    method: AssignmentMethod;
    skip_inactive: boolean;
    /** Skip pool members on approved leave today (People Connect). Server default true. */
    skip_on_leave?: boolean;
    /** Reassign when the owner logs no activity within this many minutes. null = never. */
    reassign_after_minutes?: number | null;
    /** RE Phase C — see AssignmentPoolSource. */
    pool_source?: AssignmentPoolSource | null;
}

/** Longest reassign window crm-be accepts: one week. */
export const MAX_REASSIGN_AFTER_MINUTES = 10080;

export type AssignmentRuleInput = Omit<AssignmentRule, 'id' | 'priority'> & { priority?: number };

export interface AssignmentTestResult {
    assigned: boolean;
    user_id?: string;
    rule_id?: string;
    rule_name?: string;
    method?: AssignmentMethod;
    reason?: string;
    evaluated?: Array<{ rule_id: string; rule_name: string; matched: boolean; pool_size: number; reason?: string }>;
}

export const CONDITION_FIELDS: Array<{ value: string; label: string }> = [
    { value: 'source', label: 'Source' },
    { value: 'project', label: 'Project' },
    { value: 'campaign', label: 'Campaign' },
    { value: 'city', label: 'City' },
    { value: 'language', label: 'Language' },
];

export const CONDITION_OPS: Array<{ value: AssignmentConditionOp; label: string }> = [
    { value: 'eq', label: 'is' },
    { value: 'in', label: 'is one of' },
    { value: 'contains', label: 'contains' },
];

export const ASSIGNMENT_METHODS: Array<{ value: AssignmentMethod; label: string }> = [
    { value: 'round_robin', label: 'Round robin' },
    { value: 'least_loaded', label: 'Least loaded' },
    { value: 'fixed', label: 'Fixed (first person)' },
];

export function emptyRule(): AssignmentRuleInput {
    return {
        name: '',
        is_active: true,
        conditions: [],
        target_type: 'users',
        target_department_id: null,
        target_user_ids: [],
        method: 'round_robin',
        skip_inactive: true,
    };
}

/**
 * Normalises editor state into the body crm-be validates: `in` values become
 * trimmed string lists (comma separated in the editor), empty conditions are
 * dropped, and only the chosen target's id(s) are sent.
 */
export function toRuleBody(rule: AssignmentRuleInput): Record<string, unknown> {
    const conditions = rule.conditions
        .map((c) => {
            const raw = Array.isArray(c.value) ? c.value.join(',') : String(c.value ?? '');
            const value = c.op === 'in'
                ? raw.split(',').map((v) => v.trim()).filter(Boolean)
                : raw.trim();
            return { field: c.field, op: c.op, value };
        })
        .filter((c) => (Array.isArray(c.value) ? c.value.length > 0 : c.value !== ''));
    const body: Record<string, unknown> = {
        name: rule.name.trim(),
        is_active: rule.is_active,
        conditions,
        target_type: rule.target_type,
        method: rule.method,
        skip_inactive: rule.skip_inactive,
    };
    if (rule.skip_on_leave !== undefined) body.skip_on_leave = rule.skip_on_leave;
    if (rule.reassign_after_minutes !== undefined) body.reassign_after_minutes = rule.reassign_after_minutes;
    if (rule.pool_source !== undefined) body.pool_source = rule.pool_source;
    if (rule.pool_source === 'project_assigned') {
        body.target_type = 'users';
        body.target_user_ids = [];
    } else if (rule.target_type === 'department') {
        if (rule.target_department_id) body.target_department_id = rule.target_department_id;
    } else {
        body.target_user_ids = rule.target_user_ids;
    }
    return body;
}

/** Editor text → minutes: empty clears the window (null); anything else is validated on save. */
export function parseReassignMinutes(text: string): number | null {
    const trimmed = text.trim();
    return trimmed === '' ? null : Number(trimmed);
}

/** Why the rule cannot be saved yet, or null when it can. */
export function validateRule(rule: AssignmentRuleInput): string | null {
    if (!rule.name.trim()) return 'Give the rule a name.';
    if (rule.pool_source !== 'project_assigned') {
        if (rule.target_type === 'department' && !rule.target_department_id) return 'Pick a department.';
        if (rule.target_type === 'users' && rule.target_user_ids.length === 0) return 'Pick at least one person.';
    }
    const minutes = rule.reassign_after_minutes;
    if (minutes !== undefined && minutes !== null
        && (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_REASSIGN_AFTER_MINUTES)) {
        return `Reassign after must be a whole number of minutes from 1 to ${MAX_REASSIGN_AFTER_MINUTES}, or empty.`;
    }
    return null;
}

export const assignmentRulesService = {
    list: async (): Promise<AssignmentRule[]> => {
        const rows = await crmApiClient.get<AssignmentRule[]>('/assignment-rules');
        return Array.isArray(rows) ? rows : [];
    },
    create: (rule: AssignmentRuleInput) =>
        crmApiClient.post<AssignmentRule>('/assignment-rules', toRuleBody(rule)),
    update: (id: string, patch: Record<string, unknown>) =>
        crmApiClient.patch<AssignmentRule>(`/assignment-rules/${id}`, patch),
    remove: (id: string) => crmApiClient.delete<{ success: boolean }>(`/assignment-rules/${id}`),
    reorder: async (ids: string[]): Promise<AssignmentRule[]> => {
        const rows = await crmApiClient.post<AssignmentRule[]>('/assignment-rules/reorder', { ids });
        return Array.isArray(rows) ? rows : [];
    },
    test: (lead: Record<string, string>) =>
        crmApiClient.post<AssignmentTestResult>('/assignment-rules/test', { lead }),
};
