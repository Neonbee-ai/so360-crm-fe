import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast, UserSelector } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import {
    salesSettingsService,
    validateSalesSettings,
    EARN_TRIGGERS,
    type EarnTrigger,
    type OverrideScope,
    type SalesSettings,
    type SalesShareOverride,
    type UnitVisibility,
} from '../../../services/salesSettingsService';
import { useCrmFeatureFlag, RE_FLAGS } from '../../../hooks/useCrmFeatureFlag';
import { describeApiError } from '../../../utils/apiErrorMessage';

const FIELD_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-all font-bold text-sm disabled:opacity-60';
const LABEL_CLS = 'block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5';
const CARD_CLS = 'bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5';

interface Props {
    canWrite: boolean;
}

const EARN_TRIGGER_VALUES: readonly string[] = EARN_TRIGGERS.map((t) => t.value);

/** Numeric input text → number; empty reads as NaN so validation catches it. */
const toPercent = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text));
const showPercent = (n: number): string => (Number.isFinite(n) ? String(n) : '');

/**
 * Settings → Sales & commission (RE Phase C). One settings row per org:
 * when commission is earned, whether it needs approval, VAT, the default
 * agent / team-leader split with per-role or per-user overrides, and — with
 * `action:crm:unit_allocation` — whether agents see every unit or only the
 * ones allocated to them. Edited inline, saved with one PUT.
 */
const SalesCommissionSettingsTab: React.FC<Props> = ({ canWrite }) => {
    const shell = useShellBridge() as any;
    const orgId: string = shell?.currentOrg?.id ?? '';
    const tenantId: string | undefined = shell?.currentTenant?.id ?? undefined;
    const commissionsOn = useCrmFeatureFlag(RE_FLAGS.COMMISSIONS);
    const allocationOn = useCrmFeatureFlag(RE_FLAGS.UNIT_ALLOCATION);

    const [draft, setDraft] = useState<SalesSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setDraft(await salesSettingsService.get());
        } catch (e) {
            setLoadError(describeApiError(e, 'Could not load sales settings.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-slate-400 text-sm" role="status">
                <Loader2 className="animate-spin" size={16} /> Loading sales settings…
            </div>
        );
    }
    if (loadError || !draft) {
        return (
            <div className="space-y-3">
                <p role="alert" className="text-sm text-rose-400">{loadError ?? 'Could not load sales settings.'}</p>
                <button type="button" onClick={() => void load()} className="text-xs font-black uppercase tracking-widest text-blue-400 hover:text-blue-300">
                    Retry
                </button>
            </div>
        );
    }

    const set = (patch: Partial<SalesSettings>) => {
        setError(null);
        setDraft((d) => (d ? { ...d, ...patch } : d));
    };
    const setOverride = (i: number, patch: Partial<SalesShareOverride>) =>
        set({ overrides: draft.overrides.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
    const addOverride = () =>
        set({
            overrides: [...draft.overrides, {
                scope: 'role',
                role_key: '',
                agent_share_percent: draft.default_agent_share_percent,
                team_leader_override_percent: draft.team_leader_override_percent,
            }],
        });
    const removeOverride = (i: number) => set({ overrides: draft.overrides.filter((_, j) => j !== i) });
    const changeScope = (i: number, scope: OverrideScope) => {
        const o = draft.overrides[i];
        const next: SalesShareOverride = scope === 'role'
            ? { scope, role_key: '', agent_share_percent: o.agent_share_percent, team_leader_override_percent: o.team_leader_override_percent }
            : { scope, user_id: '', agent_share_percent: o.agent_share_percent, team_leader_override_percent: o.team_leader_override_percent };
        set({ overrides: draft.overrides.map((x, j) => (j === i ? next : x)) });
    };

    const save = async () => {
        const problem = validateSalesSettings(draft);
        if (problem) {
            setError(problem);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            setDraft(await salesSettingsService.save(draft));
            toast.success('Sales settings saved');
        } catch (e) {
            setError(describeApiError(e, 'Could not save sales settings.'));
        } finally {
            setSaving(false);
        }
    };

    const ro = !canWrite;

    return (
        <div className="space-y-6">
            {commissionsOn && (
                <section className={CARD_CLS} aria-label="Commission">
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">Commission</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="sales-earn-trigger" className={LABEL_CLS}>Commission is earned</label>
                            <select
                                id="sales-earn-trigger"
                                className={FIELD_CLS}
                                value={draft.earn_trigger}
                                disabled={ro}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (EARN_TRIGGER_VALUES.includes(v)) set({ earn_trigger: v as EarnTrigger });
                                }}
                            >
                                {EARN_TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="sales-vat" className={LABEL_CLS}>VAT on commission (%)</label>
                            <input
                                id="sales-vat"
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                className={FIELD_CLS}
                                value={showPercent(draft.vat_percent)}
                                disabled={ro}
                                onChange={(e) => set({ vat_percent: toPercent(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label htmlFor="sales-agent-share" className={LABEL_CLS}>Default agent share (%)</label>
                            <input
                                id="sales-agent-share"
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                className={FIELD_CLS}
                                value={showPercent(draft.default_agent_share_percent)}
                                disabled={ro}
                                onChange={(e) => set({ default_agent_share_percent: toPercent(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label htmlFor="sales-tl-override" className={LABEL_CLS}>Team-leader override (%)</label>
                            <input
                                id="sales-tl-override"
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                className={FIELD_CLS}
                                value={showPercent(draft.team_leader_override_percent)}
                                disabled={ro}
                                onChange={(e) => set({ team_leader_override_percent: toPercent(e.target.value) })}
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-3 text-sm text-slate-300">
                        <input
                            type="checkbox"
                            checked={draft.approval_required}
                            disabled={ro}
                            onChange={(e) => set({ approval_required: e.target.checked })}
                        />
                        Commission needs manager approval before it becomes payable
                    </label>
                    <p className="text-xs text-slate-500">The company keeps whatever is left after the agent and team-leader shares.</p>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className={LABEL_CLS}>Overrides by role or person</span>
                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={addOverride}
                                    className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-blue-400 hover:text-blue-300"
                                >
                                    <Plus size={14} /> Add override
                                </button>
                            )}
                        </div>
                        {draft.overrides.length === 0 ? (
                            <p className="text-xs text-slate-500">No overrides — everyone uses the default split.</p>
                        ) : (
                            <table className="w-full text-sm" aria-label="Share overrides">
                                <thead>
                                    <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <th className="py-2 pr-2">Applies to</th>
                                        <th className="py-2 pr-2">Who</th>
                                        <th className="py-2 pr-2">Agent %</th>
                                        <th className="py-2 pr-2">Team leader %</th>
                                        <th className="py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {draft.overrides.map((o, i) => (
                                        <tr key={i} className="border-t border-slate-800">
                                            <td className="py-2 pr-2">
                                                <select
                                                    aria-label={`Override ${i + 1} applies to`}
                                                    className={FIELD_CLS}
                                                    value={o.scope}
                                                    disabled={ro}
                                                    onChange={(e) => changeScope(i, e.target.value === 'user' ? 'user' : 'role')}
                                                >
                                                    <option value="role">Role</option>
                                                    <option value="user">Person</option>
                                                </select>
                                            </td>
                                            <td className="py-2 pr-2">
                                                {o.scope === 'role' ? (
                                                    <input
                                                        aria-label={`Override ${i + 1} role`}
                                                        className={FIELD_CLS}
                                                        placeholder="Role key, e.g. sales_agent"
                                                        value={o.role_key ?? ''}
                                                        disabled={ro}
                                                        onChange={(e) => setOverride(i, { role_key: e.target.value })}
                                                    />
                                                ) : ro ? (
                                                    <span className="text-slate-300">{o.user_id || '—'}</span>
                                                ) : (
                                                    <UserSelector
                                                        value={o.user_id || undefined}
                                                        onChange={(id: string | string[] | null) =>
                                                            setOverride(i, { user_id: Array.isArray(id) ? (id[0] ?? '') : (id ?? '') })}
                                                        orgId={orgId}
                                                        tenantId={tenantId}
                                                        placeholder="Pick a person"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-2 pr-2">
                                                <input
                                                    aria-label={`Override ${i + 1} agent share`}
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    className={FIELD_CLS}
                                                    value={showPercent(o.agent_share_percent)}
                                                    disabled={ro}
                                                    onChange={(e) => setOverride(i, { agent_share_percent: toPercent(e.target.value) })}
                                                />
                                            </td>
                                            <td className="py-2 pr-2">
                                                <input
                                                    aria-label={`Override ${i + 1} team-leader override`}
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    className={FIELD_CLS}
                                                    value={showPercent(o.team_leader_override_percent)}
                                                    disabled={ro}
                                                    onChange={(e) => setOverride(i, { team_leader_override_percent: toPercent(e.target.value) })}
                                                />
                                            </td>
                                            <td className="py-2 text-right">
                                                {canWrite && (
                                                    <button
                                                        type="button"
                                                        aria-label={`Remove override ${i + 1}`}
                                                        onClick={() => removeOverride(i)}
                                                        className="p-2 text-slate-500 hover:text-rose-400"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            )}

            {allocationOn && (
                <section className={CARD_CLS} aria-label="Unit visibility">
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">Unit visibility</h3>
                    <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-700/50 w-fit" role="radiogroup" aria-label="Agents can book">
                        {([['all', 'Any available unit'], ['assigned_only', 'Only units allocated to them']] as const).map(([v, label]) => (
                            <button
                                key={v}
                                type="button"
                                role="radio"
                                aria-checked={draft.unit_visibility === v}
                                disabled={ro}
                                onClick={() => set({ unit_visibility: v as UnitVisibility })}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60 ${draft.unit_visibility === v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500">Managers can always see and book every unit.</p>
                </section>
            )}

            {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}

            {canWrite ? (
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest disabled:opacity-60"
                >
                    {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save sales settings
                </button>
            ) : (
                <p className="text-xs text-slate-500">You can view these settings but not change them.</p>
            )}
        </div>
    );
};

export default SalesCommissionSettingsTab;
