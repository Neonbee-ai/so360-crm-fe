import React, { useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Edit2, Trash2, Plus, Loader2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { toast, DepartmentSelector, UserSelector } from '@so360/design-system';
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
    parseReassignMinutes,
    toRuleBody,
    validateRule,
} from '../../../services/assignmentRulesService';
import { crmService } from '../../../services/crmService';
import { describeApiError } from '../../../utils/apiErrorMessage';

const FIELD_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-all font-bold text-sm';
const LABEL_CLS = 'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5';

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
    const who = rule.target_type === 'department'
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
        if (!window.confirm(`Delete the rule "${rule.name}"?`)) return;
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
        <div className="p-6 border-b border-slate-700/50 bg-slate-950/40 space-y-5" data-testid="assignment-rule-editor">
            <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-50 uppercase tracking-widest text-xs">
                    {editingId === 'new' ? 'New rule' : 'Edit rule'}
                </h4>
                <button type="button" onClick={closeEditor} aria-label="Close rule editor" className="text-slate-500 hover:text-slate-300">
                    <X size={16} />
                </button>
            </div>

            <div>
                <label htmlFor="assignment-rule-name" className={LABEL_CLS}>Rule name</label>
                <input
                    id="assignment-rule-name"
                    className={FIELD_CLS}
                    value={draft.name}
                    maxLength={120}
                    placeholder="e.g. Marina Heights — Facebook leads"
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
            </div>

            <div>
                <span className={LABEL_CLS}>When a new lead matches all of</span>
                {draft.conditions.length === 0 && (
                    <p className="text-xs text-slate-500 font-bold mb-2">No conditions — this rule catches every lead that reaches it.</p>
                )}
                <div className="space-y-2">
                    {draft.conditions.map((c, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center" data-testid="assignment-condition-row">
                            <select
                                aria-label={`Condition ${i + 1} field`}
                                className={FIELD_CLS}
                                value={c.field}
                                onChange={(e) => setCondition(i, { field: e.target.value })}
                            >
                                {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                            <select
                                aria-label={`Condition ${i + 1} operator`}
                                className={FIELD_CLS}
                                value={c.op}
                                onChange={(e) => setCondition(i, { op: e.target.value as any })}
                            >
                                {CONDITION_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <input
                                aria-label={`Condition ${i + 1} value`}
                                className={FIELD_CLS}
                                value={Array.isArray(c.value) ? c.value.join(', ') : c.value}
                                placeholder={c.op === 'in' ? 'facebook, google' : 'facebook'}
                                onChange={(e) => setCondition(i, { value: e.target.value })}
                            />
                            <button
                                type="button"
                                aria-label={`Remove condition ${i + 1}`}
                                className="p-2 text-slate-500 hover:text-red-400"
                                onClick={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, idx) => idx !== i) }))}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                {draft.conditions.length < 20 && (
                    <button
                        type="button"
                        className="mt-2 text-xs font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                        onClick={() => setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: 'source', op: 'eq', value: '' }] }))}
                    >
                        + Add condition
                    </button>
                )}
            </div>

            <div>
                <span className={LABEL_CLS}>Assign to</span>
                <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50 w-fit mb-3" role="radiogroup" aria-label="Assign to">
                    {(['users', 'department'] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={draft.target_type === t}
                            onClick={() => setDraft((d) => ({ ...d, target_type: t }))}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${draft.target_type === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {t === 'users' ? 'People' : 'Department'}
                        </button>
                    ))}
                </div>
                {draft.target_type === 'department' ? (
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

            <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                    <label htmlFor="assignment-rule-method" className={LABEL_CLS}>Method</label>
                    <select
                        id="assignment-rule-method"
                        className={FIELD_CLS}
                        value={draft.method}
                        onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as any }))}
                    >
                        {ASSIGNMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-300 pb-2.5">
                    <input
                        type="checkbox"
                        checked={draft.skip_inactive}
                        onChange={(e) => setDraft((d) => ({ ...d, skip_inactive: e.target.checked }))}
                    />
                    Skip people who are inactive
                </label>
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                    <label htmlFor="assignment-rule-reassign" className={LABEL_CLS}>Reassign if not contacted within (minutes)</label>
                    <input
                        id="assignment-rule-reassign"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_REASSIGN_AFTER_MINUTES}
                        step={1}
                        className={FIELD_CLS}
                        placeholder="Never"
                        value={draft.reassign_after_minutes ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, reassign_after_minutes: parseReassignMinutes(e.target.value) }))}
                    />
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-300 pb-2.5">
                    <input
                        type="checkbox"
                        checked={draft.skip_on_leave !== false}
                        onChange={(e) => setDraft((d) => ({ ...d, skip_on_leave: e.target.checked }))}
                    />
                    Skip people on leave today
                </label>
            </div>

            {draftError && <p role="alert" className="text-xs font-bold text-red-400">{draftError}</p>}

            <div className="flex justify-end gap-2">
                <button type="button" onClick={closeEditor} className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-200">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={saveDraft}
                    disabled={busy}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    Save rule
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-10">
            <section className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                    <div>
                        <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Lead Assignment Rules</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">NEW LEADS GO TO THE FIRST MATCHING RULE, TOP TO BOTTOM</p>
                    </div>
                    {canWrite && !editingId && (
                        <button
                            type="button"
                            onClick={() => openEditor()}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest"
                        >
                            <Plus size={14} /> Add rule
                        </button>
                    )}
                </div>

                {editor}

                {loading ? (
                    <div className="p-10 flex justify-center text-slate-500"><Loader2 size={20} className="animate-spin" /></div>
                ) : loadError ? (
                    <p role="alert" className="p-6 text-sm font-bold text-red-400">{loadError}</p>
                ) : rules.length === 0 ? (
                    <p className="p-6 text-sm font-bold text-slate-500">No rules yet. New leads keep the owner they are created with.</p>
                ) : (
                    <ol className="divide-y divide-slate-800" aria-label="Assignment rules">
                        {rules.map((rule, i) => (
                            <li key={rule.id} className="p-4 flex items-center gap-4" data-testid="assignment-rule-row">
                                <span className="w-6 text-center text-xs font-black text-slate-500">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-sm truncate ${rule.is_active ? 'text-slate-50' : 'text-slate-500 line-through'}`}>{rule.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{conditionSummary(rule)} → {targetSummary(rule)}</p>
                                </div>
                                {canWrite && (
                                    <div className="flex items-center gap-1">
                                        <button type="button" aria-label={`Move ${rule.name} up`} disabled={busy || i === 0} onClick={() => move(i, -1)} className="p-1.5 text-slate-500 hover:text-slate-200 disabled:opacity-30">
                                            <ChevronUp size={16} />
                                        </button>
                                        <button type="button" aria-label={`Move ${rule.name} down`} disabled={busy || i === rules.length - 1} onClick={() => move(i, 1)} className="p-1.5 text-slate-500 hover:text-slate-200 disabled:opacity-30">
                                            <ChevronDown size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={rule.is_active ? `Turn off ${rule.name}` : `Turn on ${rule.name}`}
                                            disabled={busy}
                                            onClick={() => toggleActive(rule)}
                                            className="p-1.5 text-slate-500 hover:text-slate-200"
                                        >
                                            {rule.is_active ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} />}
                                        </button>
                                        <button type="button" aria-label={`Edit ${rule.name}`} disabled={busy} onClick={() => openEditor(rule)} className="p-1.5 text-slate-500 hover:text-slate-200">
                                            <Edit2 size={14} />
                                        </button>
                                        <button type="button" aria-label={`Delete ${rule.name}`} disabled={busy} onClick={() => removeRule(rule)} className="p-1.5 text-slate-500 hover:text-red-400">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            <section className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-2xl space-y-4" aria-label="Test assignment">
                <div>
                    <h3 className="font-black text-slate-50 uppercase tracking-widest text-xs">Test a lead</h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">SEE WHO A LEAD WOULD GO TO. NOTHING IS SAVED.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {CONDITION_FIELDS.map((f) => (
                        <div key={f.value}>
                            <label htmlFor={`assignment-test-${f.value}`} className={LABEL_CLS}>{f.label}</label>
                            <input
                                id={`assignment-test-${f.value}`}
                                className={FIELD_CLS}
                                value={sample[f.value] ?? ''}
                                onChange={(e) => setSample((s) => ({ ...s, [f.value]: e.target.value }))}
                            />
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={runTest}
                        disabled={testing}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        {testing && <Loader2 size={14} className="animate-spin" />}
                        Run test
                    </button>
                    {testResult && (
                        <p className="text-sm font-bold text-slate-300" data-testid="assignment-test-result">
                            {testResult.assigned
                                ? `Goes to ${assigneeName ?? testResult.user_id} via "${testResult.rule_name}".`
                                : `No rule would assign this lead${testResult.reason ? ` (${testResult.reason})` : ''}.`}
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AssignmentRulesSettingsTab;
