import React, { useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Edit2, Trash2, Plus, Loader2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { toast, DepartmentSelector, UserSelector, useConfirm, Card, Button, IconButton, TextField, NumberInput, Select, Checkbox } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
    assignmentRulesService,
    AssignmentRule,
    AssignmentRuleInput,
    AssignmentTestResult,
    ASSIGNMENT_METHODS,
    CONDITION_FIELDS,
    CONDITION_OPS,
    MAX_REASSIGN_AFTER_MINUTES,
    emptyRule,
    toRuleBody,
    validateRule,
} from '../../../services/assignmentRulesService';
import { crmService } from '../../../services/crmService';
import { describeApiError } from '../../../utils/apiErrorMessage';

const LABEL_CLS = 'block text-xs font-semibold text-fg-muted mb-1.5';

interface Props {
    canWrite: boolean;
}

function ruleToInput(rule: AssignmentRule): AssignmentRuleInput {
    return {
        name: rule.name,
        is_active: rule.is_active,
        conditions: (rule.conditions ?? []).map((c) => ({ ...c, value: Array.isArray(c.value) ? c.value.join(', ') : c.value })),
        target_type: rule.target_type,
        target_department_id: rule.target_department_id ?? null,
        target_user_ids: rule.target_user_ids ?? [],
        method: rule.method,
        skip_inactive: rule.skip_inactive,
        // G5: carried only when the row has them, so an edit never writes a
        // column the server does not have yet.
        ...(rule.skip_on_leave !== undefined && { skip_on_leave: rule.skip_on_leave }),
        ...(rule.reassign_after_minutes !== undefined && { reassign_after_minutes: rule.reassign_after_minutes }),
        ...(rule.pool_source !== undefined && { pool_source: rule.pool_source }),
    };
}

function conditionSummary(rule: AssignmentRule): string {
    if (!rule.conditions?.length) return 'Every new lead';
    return rule.conditions
        .map((c) => {
            const field = CONDITION_FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
            const op = CONDITION_OPS.find((o) => o.value === c.op)?.label ?? c.op;
            const value = Array.isArray(c.value) ? c.value.join(', ') : c.value;
            return `${field} ${op} ${value}`;
        })
        .join(' and ');
}

function targetSummary(rule: AssignmentRule): string {
    const method = ASSIGNMENT_METHODS.find((m) => m.value === rule.method)?.label ?? rule.method;
    const who = rule.pool_source === 'project_assigned'
        ? "the lead's project agents"
        : rule.target_type === 'department'
        ? 'a department'
        : `${rule.target_user_ids?.length ?? 0} ${rule.target_user_ids?.length === 1 ? 'person' : 'people'}`;
    const reassign = rule.reassign_after_minutes ? ` · reassign after ${rule.reassign_after_minutes} min` : '';
    return `${who} · ${method}${reassign}`;
}

/**
 * Settings → Assignment (A5). Lists the org's lead auto-assignment rules in
 * evaluation order, edits one rule inline (no modal), and dry-runs a sample
 * lead against the rules.
 */
const AssignmentRulesSettingsTab: React.FC<Props> = ({ canWrite }) => {
    const [confirm, confirmDialog] = useConfirm();
    const shell = useShellBridge() as any;
    const orgId: string = shell?.currentOrg?.id ?? '';
    const tenantId: string | undefined = shell?.currentTenant?.id ?? undefined;

    const [rules, setRules] = useState<AssignmentRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // null = editor closed; 'new' = creating; otherwise the id being edited.
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<AssignmentRuleInput>(emptyRule());
    const [draftError, setDraftError] = useState<string | null>(null);

    const [sample, setSample] = useState<Record<string, string>>({ source: '', project: '', campaign: '', city: '', language: '' });
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<AssignmentTestResult | null>(null);
    const [assigneeName, setAssigneeName] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setRules(await assignmentRulesService.list());
            setLoadError(null);
        } catch (err) {
            setLoadError(describeApiError(err, 'Could not load assignment rules.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openEditor = (rule?: AssignmentRule) => {
        setEditingId(rule ? rule.id : 'new');
        setDraft(rule ? ruleToInput(rule) : emptyRule());
        setDraftError(null);
    };

    const closeEditor = () => {
        setEditingId(null);
        setDraftError(null);
    };

    const saveDraft = async () => {
        const problem = validateRule(draft);
        if (problem) { setDraftError(problem); return; }
        setBusy(true);
        try {
            if (editingId === 'new') {
                await assignmentRulesService.create(draft);
                toast.success('Assignment rule created');
            } else if (editingId) {
                await assignmentRulesService.update(editingId, toRuleBody(draft));
                toast.success('Assignment rule saved');
            }
            closeEditor();
            await load();
        } catch (err) {
            setDraftError(describeApiError(err, 'Could not save the rule.'));
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (rule: AssignmentRule) => {
        setBusy(true);
        try {
            const next = !rule.is_active;
            await assignmentRulesService.update(rule.id, { is_active: next });
            setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, is_active: next } : r)));
        } catch (err) {
            toast.error(describeApiError(err, 'Could not update the rule.'));
        } finally {
            setBusy(false);
        }
    };

    const removeRule = async (rule: AssignmentRule) => {
        if (!await confirm({ title: 'Delete?', message: `Delete the rule "${rule.name}"?`, intent: 'danger', confirmLabel: 'Delete' })) return;
        setBusy(true);
        try {
            await assignmentRulesService.remove(rule.id);
            setRules((rs) => rs.filter((r) => r.id !== rule.id));
            if (editingId === rule.id) closeEditor();
            toast.success('Assignment rule deleted');
        } catch (err) {
            toast.error(describeApiError(err, 'Could not delete the rule.'));
        } finally {
            setBusy(false);
        }
    };

    const move = async (index: number, delta: -1 | 1) => {
        const target = index + delta;
        if (target < 0 || target >= rules.length) return;
        const previous = rules;
        const next = [...rules];
        [next[index], next[target]] = [next[target], next[index]];
        setRules(next);
        setBusy(true);
        try {
            const saved = await assignmentRulesService.reorder(next.map((r) => r.id));
            if (saved.length) setRules(saved);
        } catch (err) {
            setRules(previous);
            toast.error(describeApiError(err, 'Could not reorder the rules.'));
        } finally {
            setBusy(false);
        }
    };

    const runTest = async () => {
        const lead = Object.fromEntries(Object.entries(sample).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
        setTesting(true);
        setTestResult(null);
        setAssigneeName(null);
        try {
            const result = await assignmentRulesService.test(lead);
            setTestResult(result);
            if (result?.assigned && result.user_id) {
                try {
                    const users = await crmService.getUsers();
                    const match = users.find((u) => u.id === result.user_id);
                    setAssigneeName(match?.full_name ?? null);
                } catch {
                    // Name lookup is cosmetic; the id still shows.
                }
            }
        } catch (err) {
            toast.error(describeApiError(err, 'Could not run the test.'));
        } finally {
            setTesting(false);
        }
    };

    const setCondition = (i: number, patch: Partial<AssignmentRuleInput['conditions'][number]>) =>
        setDraft((d) => ({ ...d, conditions: d.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));

    const editor = editingId && (
        <div className="p-nb-4 border-b border-line space-y-5" data-testid="assignment-rule-editor">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-fg text-xs">
                    {editingId === 'new' ? 'New rule' : 'Edit rule'}
                </h4>
                <IconButton label="Close rule editor" icon={<X size={16} />} onClick={closeEditor} />
            </div>

            <div>
                <TextField
                    id="assignment-rule-name"
                    name="assignment-rule-name"
                    label="Rule name"
                    value={draft.name}
                    maxLength={120}
                    placeholder="e.g. Marina Heights — Facebook leads"
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
            </div>

            <div>
                <span className={LABEL_CLS}>When a new lead matches all of</span>
                {draft.conditions.length === 0 && (
                    <p className="text-xs text-fg-muted font-bold mb-2">No conditions — this rule catches every lead that reaches it.</p>
                )}
                <div className="space-y-2">
                    {draft.conditions.map((c, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center" data-testid="assignment-condition-row">
                            <Select
                                name={`assignment-condition-${i}-field`}
                                aria-label={`Condition ${i + 1} field`}
                                value={c.field}
                                options={CONDITION_FIELDS.map((f) => ({ value: f.value, label: f.label }))}
                                onChange={(e) => setCondition(i, { field: e.target.value })}
                            />
                            <Select
                                name={`assignment-condition-${i}-op`}
                                aria-label={`Condition ${i + 1} operator`}
                                value={c.op}
                                options={CONDITION_OPS.map((o) => ({ value: o.value, label: o.label }))}
                                onChange={(e) => setCondition(i, { op: e.target.value as any })}
                            />
                            <TextField
                                name={`assignment-condition-${i}-value`}
                                aria-label={`Condition ${i + 1} value`}
                                value={Array.isArray(c.value) ? c.value.join(', ') : c.value}
                                placeholder={c.op === 'in' ? 'facebook, google' : 'facebook'}
                                onChange={(e) => setCondition(i, { value: e.target.value })}
                            />
                            <IconButton
                                label={`Remove condition ${i + 1}`}
                                variant="danger"
                                icon={<Trash2 size={14} />}
                                onClick={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, idx) => idx !== i) }))}
                            />
                        </div>
                    ))}
                </div>
                {draft.conditions.length < 20 && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: 'source', op: 'eq', value: '' }] }))}
                    >
                        + Add condition
                    </Button>
                )}
            </div>

            <div>
                <span className={LABEL_CLS}>Assign to</span>
                <div className="flex gap-1 bg-surface-sunken p-1 rounded-nb border border-line w-fit mb-3" role="radiogroup" aria-label="Assign to">
                    {(['users', 'department'] as const).map((t) => {
                        const on = draft.pool_source !== 'project_assigned' && draft.target_type === t;
                        return (
                            <button
                                key={t}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                // Leaving the project pool writes null so the server clears it.
                                onClick={() => setDraft((d) => ({
                                    ...d,
                                    target_type: t,
                                    ...(d.pool_source === 'project_assigned' ? { pool_source: null } : {}),
                                }))}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${on ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg-subtle'}`}
                            >
                                {t === 'users' ? 'People' : 'Department'}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        role="radio"
                        aria-checked={draft.pool_source === 'project_assigned'}
                        onClick={() => setDraft((d) => ({ ...d, pool_source: 'project_assigned', target_type: 'users', target_user_ids: [] }))}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${draft.pool_source === 'project_assigned' ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg-subtle'}`}
                    >
                        Project agents
                    </button>
                </div>
                {draft.pool_source === 'project_assigned' ? (
                    <p className="text-xs text-fg-subtle">The pool is the agents (and team members) allocated to the lead's project.</p>
                ) : draft.target_type === 'department' ? (
                    <DepartmentSelector
                        value={draft.target_department_id ?? undefined}
                        onChange={(id: string | null) => setDraft((d) => ({ ...d, target_department_id: id }))}
                        orgId={orgId}
                        tenantId={tenantId}
                        placeholder="Pick a department"
                        allowClear
                    />
                ) : (
                    <UserSelector
                        multiSelect
                        value={draft.target_user_ids}
                        onChange={(ids: string | string[] | null) =>
                            setDraft((d) => ({ ...d, target_user_ids: Array.isArray(ids) ? ids : ids ? [ids] : [] }))}
                        orgId={orgId}
                        tenantId={tenantId}
                        placeholder="Pick people"
                    />
                )}
            </div>

            <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3 items-end">
                <div>
                    <Select
                        id="assignment-rule-method"
                        name="assignment-rule-method"
                        label="Method"
                        value={draft.method}
                        options={ASSIGNMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
                        onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as any }))}
                    />
                </div>
                <Checkbox
                    name="assignment-skip-inactive"
                    label="Skip people who are inactive"
                    checked={draft.skip_inactive}
                    onChange={(e) => setDraft((d) => ({ ...d, skip_inactive: e.target.checked }))}
                />
            </div>

            <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3 items-end">
                <div>
                    <NumberInput
                        id="assignment-rule-reassign"
                        name="assignment-rule-reassign"
                        label="Reassign if not contacted within (minutes)"
                        min={1}
                        max={MAX_REASSIGN_AFTER_MINUTES}
                        step={1}
                        placeholder="Never"
                        value={draft.reassign_after_minutes ?? null}
                        onChange={(v) => setDraft((d) => ({ ...d, reassign_after_minutes: v }))}
                    />
                </div>
                <Checkbox
                    name="assignment-skip-on-leave"
                    label="Skip people on leave today"
                    checked={draft.skip_on_leave !== false}
                    onChange={(e) => setDraft((d) => ({ ...d, skip_on_leave: e.target.checked }))}
                />
            </div>

            {draftError && <p role="alert" className="text-xs font-bold text-danger">{draftError}</p>}

            <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeEditor}>
                    Cancel
                </Button>
                <Button type="button" variant="primary" onClick={saveDraft} disabled={busy}>
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    Save rule
                </Button>
            </div>
        </div>
    );

    return (
        <div className="space-y-nb-4">
            {confirmDialog}
            <Card
                title="Lead assignment rules"
                padding="none"
                actions={canWrite && !editingId ? (
                    <Button type="button" variant="primary" onClick={() => openEditor()}>
                        <Plus size={14} /> Add rule
                    </Button>
                ) : undefined}
            >
                <p className="px-nb-4 pt-nb-3 text-xs text-fg-muted">New leads go to the first matching rule, top to bottom</p>

                {editor}

                {loading ? (
                    <div className="p-10 flex justify-center text-fg-muted"><Loader2 size={20} className="animate-spin" /></div>
                ) : loadError ? (
                    <p role="alert" className="p-6 text-sm font-bold text-danger">{loadError}</p>
                ) : rules.length === 0 ? (
                    <p className="p-6 text-sm font-bold text-fg-muted">No rules yet. New leads keep the owner they are created with.</p>
                ) : (
                    <ol className="divide-y divide-line" aria-label="Assignment rules">
                        {rules.map((rule, i) => (
                            <li key={rule.id} className="p-4 flex items-center gap-4" data-testid="assignment-rule-row">
                                <span className="w-6 text-center text-xs font-semibold text-fg-muted">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-sm truncate ${rule.is_active ? 'text-fg' : 'text-fg-muted line-through'}`}>{rule.name}</p>
                                    <p className="text-xs text-fg-muted truncate">{conditionSummary(rule)} → {targetSummary(rule)}</p>
                                </div>
                                {canWrite && (
                                    <div className="flex items-center gap-1">
                                        <IconButton label={`Move ${rule.name} up`} icon={<ChevronUp size={16} />} disabled={busy || i === 0} onClick={() => move(i, -1)} />
                                        <IconButton label={`Move ${rule.name} down`} icon={<ChevronDown size={16} />} disabled={busy || i === rules.length - 1} onClick={() => move(i, 1)} />
                                        <IconButton
                                            label={rule.is_active ? `Turn off ${rule.name}` : `Turn on ${rule.name}`}
                                            disabled={busy}
                                            onClick={() => toggleActive(rule)}
                                            icon={rule.is_active ? <ToggleRight size={18} className="text-success" /> : <ToggleLeft size={18} />}
                                        />
                                        <IconButton label={`Edit ${rule.name}`} icon={<Edit2 size={14} />} disabled={busy} onClick={() => openEditor(rule)} />
                                        <IconButton label={`Delete ${rule.name}`} variant="danger" icon={<Trash2 size={14} />} disabled={busy} onClick={() => removeRule(rule)} />
                                    </div>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </Card>

            <Card title="Test a lead">
              <div className="space-y-4">
                <p className="text-xs text-fg-muted">See who a lead would go to. nothing is saved.</p>
                <div className="grid grid-cols-2 wc-medium:grid-cols-4 gap-nb-3">
                    {CONDITION_FIELDS.map((f) => (
                        <div key={f.value}>
                            <label htmlFor={`assignment-test-${f.value}`} className={LABEL_CLS}>{f.label}</label>
                            <TextField
                                id={`assignment-test-${f.value}`}
                                name={`assignment-test-${f.value}`}
                                value={sample[f.value] ?? ''}
                                onChange={(e) => setSample((s) => ({ ...s, [f.value]: e.target.value }))}
                            />
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-4">
                    <Button type="button" variant="secondary" onClick={runTest} disabled={testing}>
                        {testing && <Loader2 size={14} className="animate-spin" />}
                        Run test
                    </Button>
                    {testResult && (
                        <p className="text-sm font-bold text-fg-subtle" data-testid="assignment-test-result">
                            {testResult.assigned
                                ? `Goes to ${assigneeName ?? testResult.user_id} via "${testResult.rule_name}".`
                                : `No rule would assign this lead${testResult.reason ? ` (${testResult.reason})` : ''}.`}
                        </p>
                    )}
                </div>
              </div>
            </Card>
        </div>
    );
};

export default AssignmentRulesSettingsTab;
