import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, History, Loader2, Pencil, RefreshCw, Save, X } from 'lucide-react';
import { toast } from '@so360/design-system';
import {
    commissionsService,
    legalTransitions,
    canOverride,
    validateOverride,
    maskedMoney,
    PARTICIPANT_LABELS,
    COMMISSION_STATUS_LABELS,
    TRANSITION_LABELS,
    type CommissionLine,
    type CommissionStatus,
} from '../../services/commissionsService';
import { salesSettingsService } from '../../services/salesSettingsService';
import { useCRMFormatters } from '../../utils/formatters';
import { describeApiError } from '../../utils/apiErrorMessage';

const FIELD_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-all font-bold text-xs';
const BTN_PRIMARY = 'flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60';
const BTN_GHOST = 'flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 disabled:opacity-60';

const STATUS_CHIP: Record<CommissionStatus, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    approved: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    payable: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const statusName = (s: string | null) =>
    (s && s in COMMISSION_STATUS_LABELS ? COMMISSION_STATUS_LABELS[s as CommissionStatus] : s) ?? '—';

type Action =
    | { kind: 'override'; id: string; amount: string; reason: string }
    | { kind: 'transition'; id: string; to: CommissionStatus; note: string };

interface Props {
    dealId: string;
}

/**
 * Deal → Commission (RE Phase C, `submodule:crm:commissions`). One line per
 * participant; pending lines can be re-priced with a reason; each line only
 * offers the status moves the backend accepts. Values the caller may not see
 * arrive as null and render "—".
 */
const DealCommissionPanel: React.FC<Props> = ({ dealId }) => {
    const fmt = useCRMFormatters();
    const [lines, setLines] = useState<CommissionLine[]>([]);
    const [approvalRequired, setApprovalRequired] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [action, setAction] = useState<Action | null>(null);
    const [openAudit, setOpenAudit] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [ls, settings] = await Promise.all([
                commissionsService.list(dealId),
                salesSettingsService.get().catch(() => null),
            ]);
            setLines(ls);
            setApprovalRequired(settings?.approval_required ?? true);
        } catch (e) {
            setLoadError(describeApiError(e, 'Could not load commissions.'));
        } finally {
            setLoading(false);
        }
    }, [dealId]);

    useEffect(() => { void load(); }, [load]);

    const run = async (fn: () => Promise<void>, fallback: string) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
        } catch (e) {
            setError(describeApiError(e, fallback));
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center gap-2 text-slate-400 text-sm" role="status">
                <Loader2 className="animate-spin" size={16} /> Loading commissions…
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="p-8 space-y-3">
                <p role="alert" className="text-sm text-rose-400">{loadError}</p>
                <button type="button" className={BTN_GHOST} onClick={() => void load()}>Retry</button>
            </div>
        );
    }

    const money = (v: number | null) => maskedMoney(v, fmt.formatCurrency);

    const generate = () => run(async () => {
        setLines(await commissionsService.generate(dealId));
        setAction(null);
        toast.success('Commission lines generated');
    }, 'Could not generate commission lines.');

    const saveOverride = (line: CommissionLine, a: Extract<Action, { kind: 'override' }>) => {
        const amount = a.amount.trim() === '' ? null : Number(a.amount);
        const problem = validateOverride({ amount, reason: a.reason }, line);
        if (problem) {
            setError(problem);
            return;
        }
        void run(async () => {
            await commissionsService.update(dealId, line.id, { amount: amount as number, override_reason: a.reason.trim() });
            setAction(null);
            setLines(await commissionsService.list(dealId));
            toast.success('Commission updated');
        }, 'Could not update the commission.');
    };

    const confirmTransition = (line: CommissionLine, a: Extract<Action, { kind: 'transition' }>) => run(async () => {
        await commissionsService.transition(dealId, line.id, a.to, a.note);
        setAction(null);
        setLines(await commissionsService.list(dealId));
        toast.success(`${line.name || PARTICIPANT_LABELS[line.participant_type]}: ${COMMISSION_STATUS_LABELS[a.to]}`);
    }, 'Could not change the commission status.');

    const patchAction = (patch: Partial<{ amount: string; reason: string; note: string }>) => {
        setError(null);
        setAction((a) => (a ? { ...a, ...patch } as Action : a));
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">Commission</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        {approvalRequired ? 'Lines need approval before they become payable.' : 'Lines become payable without approval.'}
                    </p>
                </div>
                <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void generate()}>
                    {busy ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                    {lines.length ? 'Regenerate' : 'Generate'}
                </button>
            </div>

            {lines.length === 0 ? (
                <p className="text-sm text-slate-500" data-testid="commission-empty">
                    No commission lines yet. Generate them from the sales & commission settings.
                </p>
            ) : (
                <ul className="space-y-3" aria-label="Commission lines">
                    {lines.map((l) => {
                        const act = action?.id === l.id ? action : null;
                        const moves = legalTransitions(l.status, approvalRequired);
                        const auditOpen = openAudit === l.id;
                        return (
                            <li key={l.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3" data-testid={`commission-${l.id}`}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{PARTICIPANT_LABELS[l.participant_type]}</p>
                                        <p className="text-sm font-bold text-slate-200">{l.name || '—'}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${STATUS_CHIP[l.status]}`}>
                                        {COMMISSION_STATUS_LABELS[l.status]}
                                    </span>
                                </div>
                                <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div><dt className="text-slate-500">Basis</dt><dd className="font-bold text-slate-200">{money(l.basis_amount)}</dd></div>
                                    <div><dt className="text-slate-500">Rate</dt><dd className="font-bold text-slate-200">{l.percent === null ? '—' : `${l.percent}%`}</dd></div>
                                    <div><dt className="text-slate-500">Amount</dt><dd className="font-bold text-slate-200" data-testid={`commission-amount-${l.id}`}>{money(l.amount)}</dd></div>
                                    <div><dt className="text-slate-500">VAT</dt><dd className="font-bold text-slate-200">{money(l.vat_amount)}</dd></div>
                                </dl>
                                {l.override_reason && <p className="text-[11px] text-slate-400">Overridden: {l.override_reason}</p>}

                                {act?.kind === 'override' && (
                                    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-center">
                                        <input aria-label={`New amount for ${l.name}`} type="number" min={0} className={FIELD_CLS} value={act.amount} onChange={(e) => patchAction({ amount: e.target.value })} />
                                        <input aria-label={`Reason for ${l.name}`} placeholder="Reason (required)" className={FIELD_CLS} value={act.reason} onChange={(e) => patchAction({ reason: e.target.value })} />
                                        <div className="flex gap-1">
                                            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => saveOverride(l, act)}><Save size={12} /> Save</button>
                                            <button type="button" className={BTN_GHOST} onClick={() => { setError(null); setAction(null); }}><X size={12} /> Cancel</button>
                                        </div>
                                    </div>
                                )}
                                {act?.kind === 'transition' && (
                                    <div className="grid grid-cols-1 md:grid-cols-[2fr_auto] gap-2 items-center">
                                        <input aria-label={`Note for ${l.name}`} placeholder="Note (optional)" className={FIELD_CLS} value={act.note} onChange={(e) => patchAction({ note: e.target.value })} />
                                        <div className="flex gap-1">
                                            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void confirmTransition(l, act)}>
                                                Confirm: {TRANSITION_LABELS[act.to]}
                                            </button>
                                            <button type="button" className={BTN_GHOST} onClick={() => { setError(null); setAction(null); }}><X size={12} /> Cancel</button>
                                        </div>
                                    </div>
                                )}

                                {!act && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        {canOverride(l) && (
                                            <button
                                                type="button"
                                                className={BTN_GHOST}
                                                aria-label={`Override amount for ${l.name}`}
                                                onClick={() => { setError(null); setAction({ kind: 'override', id: l.id, amount: String(l.amount), reason: '' }); }}
                                            >
                                                <Pencil size={12} /> Override
                                            </button>
                                        )}
                                        {moves.map((to) => (
                                            <button
                                                key={to}
                                                type="button"
                                                className={BTN_GHOST}
                                                aria-label={`${TRANSITION_LABELS[to]} ${l.name}`}
                                                onClick={() => { setError(null); setAction({ kind: 'transition', id: l.id, to, note: '' }); }}
                                            >
                                                {TRANSITION_LABELS[to]}
                                            </button>
                                        ))}
                                        {l.audit.length > 0 && (
                                            <button
                                                type="button"
                                                className={BTN_GHOST}
                                                aria-expanded={auditOpen}
                                                aria-label={`History for ${l.name}`}
                                                onClick={() => setOpenAudit(auditOpen ? null : l.id)}
                                            >
                                                <History size={12} /> History ({l.audit.length}) {auditOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {auditOpen && (
                                    <ol className="border-l border-slate-800 pl-3 space-y-1 text-[11px] text-slate-400" aria-label={`Audit trail for ${l.name}`}>
                                        {l.audit.map((a, i) => (
                                            <li key={i}>
                                                <span className="text-slate-500">{a.at ? fmt.formatDateTime(a.at) : '—'}</span>
                                                {' · '}{statusName(a.from)} → {statusName(a.to)}
                                                {a.by && <> · {a.by}</>}
                                                {a.note && <> · “{a.note}”</>}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        </div>
    );
};

export default DealCommissionPanel;
