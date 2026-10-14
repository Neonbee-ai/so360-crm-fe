import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Loader2, Plus, Receipt, Save, Trash2, X } from 'lucide-react';
import { toast } from '@so360/design-system';
import {
    paymentScheduleService,
    resolveDealTemplates,
    scheduleTotals,
    canRaiseInvoice,
    isChequeMode,
    validateManualLines,
    PAYMENT_MODES,
    LINE_STATUSES,
    TRIGGER_LABELS,
    type BillingMode,
    type ManualLineInput,
    type PaymentLinePatch,
    type PaymentMode,
    type PaymentPlanTemplate,
    type PaymentScheduleLine,
    type PaymentScheduleResponse,
    type ScheduleLineStatus,
} from '../../services/paymentScheduleService';
import { useCRMFormatters } from '../../utils/formatters';
import { describeApiError } from '../../utils/apiErrorMessage';

const FIELD_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-3 py-2 outline-none focus:border-blue-500 transition-all font-bold text-xs';
const BTN_PRIMARY = 'flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60';
const BTN_GHOST = 'flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200';

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
    full_invoice: 'One invoice for the full price',
    invoice_per_instalment: 'Invoice each instalment',
    schedule_only: 'Schedule only (no invoices)',
};

const STATUS_CHIP: Record<ScheduleLineStatus, string> = {
    due: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    invoiced: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    bounced: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const MODE_VALUES: readonly string[] = PAYMENT_MODES.map((m) => m.value);
const STATUS_VALUES: readonly string[] = LINE_STATUSES.map((s) => s.value);
const modeLabel = (m: PaymentMode | null) => PAYMENT_MODES.find((x) => x.value === m)?.label ?? '—';
const statusLabel = (s: ScheduleLineStatus) => LINE_STATUSES.find((x) => x.value === s)?.label ?? s;

interface LineDraft {
    amount: string;
    due_date: string;
    payment_mode: PaymentMode | '';
    cheque_number: string;
    cheque_date: string;
    cheque_bank: string;
    status: ScheduleLineStatus;
}

const toDraft = (l: PaymentScheduleLine): LineDraft => ({
    amount: String(l.amount),
    due_date: l.due_date ?? '',
    payment_mode: l.payment_mode ?? '',
    cheque_number: l.cheque_number ?? '',
    cheque_date: l.cheque_date ?? '',
    cheque_bank: l.cheque_bank ?? '',
    status: l.status,
});

/** Only the fields the user actually changed; cheque fields are cleared when the mode isn't a cheque. */
export function diffLine(line: PaymentScheduleLine, d: LineDraft): PaymentLinePatch | string {
    const amount = d.amount.trim() === '' ? Number.NaN : Number(d.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Amount must be greater than 0.';
    const patch: PaymentLinePatch = {};
    if (amount !== line.amount) patch.amount = amount;
    const due = d.due_date || null;
    if (due !== line.due_date) patch.due_date = due;
    const mode = d.payment_mode || null;
    if (mode !== line.payment_mode) patch.payment_mode = mode;
    const cheque = isChequeMode(mode);
    const num = cheque ? (d.cheque_number.trim() || null) : null;
    const date = cheque ? (d.cheque_date || null) : null;
    const bank = cheque ? (d.cheque_bank.trim() || null) : null;
    if (num !== line.cheque_number) patch.cheque_number = num;
    if (date !== line.cheque_date) patch.cheque_date = date;
    if (bank !== line.cheque_bank) patch.cheque_bank = bank;
    if (d.status !== line.status) patch.status = d.status;
    return patch;
}

interface ManualRow { label: string; amount: string; due_date: string; payment_mode: PaymentMode | '' }
const blankRow = (): ManualRow => ({ label: '', amount: '', due_date: '', payment_mode: '' });

interface Props {
    dealId: string;
}

/**
 * Deal → Payment plan (RE Phase C, `submodule:crm:payment_plans`). Creates
 * the deal's instalment schedule from a project template or by hand, then
 * lets the user edit each line inline and — when the plan bills per
 * instalment — raise the invoice for a due line.
 */
const DealPaymentPlanPanel: React.FC<Props> = ({ dealId }) => {
    const fmt = useCRMFormatters();
    const [data, setData] = useState<PaymentScheduleResponse | null>(null);
    const [templates, setTemplates] = useState<PaymentPlanTemplate[]>([]);
    const [templateId, setTemplateId] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [manual, setManual] = useState<ManualRow[] | null>(null);
    const [editing, setEditing] = useState<{ id: string; draft: LineDraft } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await paymentScheduleService.get(dealId);
            setData({ schedule: res.schedule, lines: res.lines });
            if (!res.schedule) {
                const ts = await resolveDealTemplates(dealId, res.templates);
                setTemplates(ts);
                setTemplateId(ts[0]?.id ?? '');
            }
        } catch (e) {
            setLoadError(describeApiError(e, 'Could not load the payment plan.'));
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
                <Loader2 className="animate-spin" size={16} /> Loading payment plan…
            </div>
        );
    }
    if (loadError || !data) {
        return (
            <div className="p-8 space-y-3">
                <p role="alert" className="text-sm text-rose-400">{loadError ?? 'Could not load the payment plan.'}</p>
                <button type="button" className={BTN_GHOST} onClick={() => void load()}>Retry</button>
            </div>
        );
    }

    const createFromTemplate = () => run(async () => {
        setData(await paymentScheduleService.createFromTemplate(dealId, templateId));
        toast.success('Payment plan created');
    }, 'Could not create the payment plan.');

    const createManual = () => {
        const lines: ManualLineInput[] = (manual ?? []).map((r) => ({
            label: r.label,
            amount: r.amount.trim() === '' ? Number.NaN : Number(r.amount),
            due_date: r.due_date || null,
            payment_mode: r.payment_mode || null,
        }));
        const problem = validateManualLines(lines);
        if (problem) {
            setError(problem);
            return;
        }
        void run(async () => {
            setData(await paymentScheduleService.createManual(dealId, lines));
            setManual(null);
            toast.success('Payment plan created');
        }, 'Could not create the payment plan.');
    };

    const saveLine = (line: PaymentScheduleLine, draft: LineDraft) => {
        const patch = diffLine(line, draft);
        if (typeof patch === 'string') {
            setError(patch);
            return;
        }
        if (Object.keys(patch).length === 0) {
            setEditing(null);
            return;
        }
        void run(async () => {
            await paymentScheduleService.updateLine(dealId, line.id, patch);
            setEditing(null);
            const res = await paymentScheduleService.get(dealId);
            setData({ schedule: res.schedule, lines: res.lines });
            toast.success('Instalment updated');
        }, 'Could not update the instalment.');
    };

    const raiseInvoice = (line: PaymentScheduleLine) => run(async () => {
        await paymentScheduleService.raiseInvoice(dealId, line.id);
        const res = await paymentScheduleService.get(dealId);
        setData({ schedule: res.schedule, lines: res.lines });
        toast.success(`Invoice raised for ${line.label}`);
    }, 'Could not raise the invoice.');

    const errorLine = error && <p role="alert" className="text-sm text-rose-400">{error}</p>;

    // ── Empty state ────────────────────────────────────────────────────────
    if (!data.schedule) {
        const setRow = (i: number, patch: Partial<ManualRow>) => {
            setError(null);
            setManual((rows) => (rows ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)));
        };
        return (
            <div className="p-8 space-y-6" data-testid="payment-plan-empty">
                <div>
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">No payment plan yet</h3>
                    <p className="text-xs text-slate-500 mt-1">Start from one of the project's plans, or enter the instalments yourself.</p>
                </div>
                {manual === null && (
                    <div className="flex flex-wrap items-end gap-3">
                        {templates.length > 0 ? (
                            <>
                                <div className="min-w-[16rem]">
                                    <label htmlFor="pp-template" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Project plan</label>
                                    <select id="pp-template" className={FIELD_CLS} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                                        {templates.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (default)' : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <button type="button" className={BTN_PRIMARY} disabled={busy || !templateId} onClick={() => void createFromTemplate()}>
                                    {busy ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Create from template
                                </button>
                            </>
                        ) : (
                            <p className="text-xs text-slate-500">This deal's project has no payment plans set up.</p>
                        )}
                        <button type="button" className={BTN_GHOST} onClick={() => { setError(null); setManual([blankRow()]); }}>
                            <Edit2 size={14} /> Enter instalments manually
                        </button>
                    </div>
                )}
                {manual !== null && (
                    <div className="space-y-3" aria-label="Manual instalments">
                        {manual.map((r, i) => (
                            <div key={i} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                                <input aria-label={`Instalment ${i + 1} label`} placeholder="Label, e.g. Booking" className={FIELD_CLS} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                                <input aria-label={`Instalment ${i + 1} amount`} type="number" min={0} placeholder="Amount" className={FIELD_CLS} value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
                                <input aria-label={`Instalment ${i + 1} due date`} type="date" className={FIELD_CLS} value={r.due_date} onChange={(e) => setRow(i, { due_date: e.target.value })} />
                                <select
                                    aria-label={`Instalment ${i + 1} payment mode`}
                                    className={FIELD_CLS}
                                    value={r.payment_mode}
                                    onChange={(e) => setRow(i, { payment_mode: MODE_VALUES.includes(e.target.value) ? e.target.value as PaymentMode : '' })}
                                >
                                    <option value="">Mode…</option>
                                    {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <button
                                    type="button"
                                    aria-label={`Remove instalment ${i + 1}`}
                                    className="p-2 text-slate-500 hover:text-rose-400"
                                    onClick={() => setManual((rows) => (rows ?? []).filter((_, j) => j !== i))}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className={BTN_GHOST} onClick={() => setManual((rows) => [...(rows ?? []), blankRow()])}>
                                <Plus size={14} /> Add instalment
                            </button>
                            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={createManual}>
                                {busy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Create plan
                            </button>
                            <button type="button" className={BTN_GHOST} onClick={() => { setError(null); setManual(null); }}>
                                <X size={14} /> Cancel
                            </button>
                        </div>
                    </div>
                )}
                {errorLine}
            </div>
        );
    }

    // ── Plan ───────────────────────────────────────────────────────────────
    const { schedule, lines } = data;
    const totals = scheduleTotals(lines);
    const setDraft = (patch: Partial<LineDraft>) => {
        setError(null);
        setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest">{schedule.template_name ?? 'Payment plan'}</h3>
                    <p className="text-xs text-slate-500 mt-1">{BILLING_MODE_LABELS[schedule.billing_mode]}</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {([['Total', totals.total], ['Paid', totals.paid], ['Outstanding', totals.outstanding]] as const).map(([label, v]) => (
                    <div key={label} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4" data-testid={`pp-total-${label.toLowerCase()}`}>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                        <p className="text-lg font-black text-slate-50 mt-1">{fmt.formatCurrency(v)}</p>
                    </div>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs" aria-label="Instalments">
                    <thead>
                        <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <th className="py-2 pr-3">#</th>
                            <th className="py-2 pr-3">Instalment</th>
                            <th className="py-2 pr-3">Amount</th>
                            <th className="py-2 pr-3">Due</th>
                            <th className="py-2 pr-3">Mode</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l) => {
                            const d: LineDraft | null = editing && editing.id === l.id ? editing.draft : null;
                            return (
                                <tr key={l.id} className="border-t border-slate-800 align-top" data-testid={`pp-line-${l.id}`}>
                                    <td className="py-3 pr-3 text-slate-500">{l.seq}</td>
                                    <td className="py-3 pr-3">
                                        <p className="font-bold text-slate-200">{l.label}</p>
                                        {l.trigger && <p className="text-[10px] text-slate-500">{TRIGGER_LABELS[l.trigger]}</p>}
                                    </td>
                                    <td className="py-3 pr-3">
                                        {d ? (
                                            <input aria-label={`${l.label} amount`} type="number" min={0} className={FIELD_CLS} value={d.amount} onChange={(e) => setDraft({ amount: e.target.value })} />
                                        ) : <span className="font-bold text-slate-200">{fmt.formatCurrency(l.amount)}</span>}
                                    </td>
                                    <td className="py-3 pr-3">
                                        {d ? (
                                            <input aria-label={`${l.label} due date`} type="date" className={FIELD_CLS} value={d.due_date} onChange={(e) => setDraft({ due_date: e.target.value })} />
                                        ) : <span className="text-slate-300">{l.due_date ? fmt.formatDate(l.due_date) : '—'}</span>}
                                    </td>
                                    <td className="py-3 pr-3 space-y-2">
                                        {d ? (
                                            <>
                                                <select
                                                    aria-label={`${l.label} payment mode`}
                                                    className={FIELD_CLS}
                                                    value={d.payment_mode}
                                                    onChange={(e) => setDraft({ payment_mode: MODE_VALUES.includes(e.target.value) ? e.target.value as PaymentMode : '' })}
                                                >
                                                    <option value="">—</option>
                                                    {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                                </select>
                                                {isChequeMode(d.payment_mode || null) && (
                                                    <>
                                                        <input aria-label={`${l.label} cheque number`} placeholder="Cheque no." className={FIELD_CLS} value={d.cheque_number} onChange={(e) => setDraft({ cheque_number: e.target.value })} />
                                                        <input aria-label={`${l.label} cheque date`} type="date" className={FIELD_CLS} value={d.cheque_date} onChange={(e) => setDraft({ cheque_date: e.target.value })} />
                                                        <input aria-label={`${l.label} cheque bank`} placeholder="Bank" className={FIELD_CLS} value={d.cheque_bank} onChange={(e) => setDraft({ cheque_bank: e.target.value })} />
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-slate-300">{modeLabel(l.payment_mode)}</span>
                                                {isChequeMode(l.payment_mode) && (l.cheque_number || l.cheque_bank) && (
                                                    <p className="text-[10px] text-slate-500">
                                                        {[l.cheque_number && `#${l.cheque_number}`, l.cheque_bank, l.cheque_date && fmt.formatDate(l.cheque_date)].filter(Boolean).join(' · ')}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </td>
                                    <td className="py-3 pr-3">
                                        {d ? (
                                            <select
                                                aria-label={`${l.label} status`}
                                                className={FIELD_CLS}
                                                value={d.status}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    if (STATUS_VALUES.includes(v)) setDraft({ status: v as ScheduleLineStatus });
                                                }}
                                            >
                                                {LINE_STATUSES
                                                    .filter((s) => s.value !== 'invoiced' || l.status === 'invoiced')
                                                    .map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                        ) : (
                                            <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${STATUS_CHIP[l.status]}`}>
                                                {statusLabel(l.status)}
                                            </span>
                                        )}
                                        {l.invoice_id && !d && <p className="text-[10px] text-slate-500 mt-1">Invoice raised</p>}
                                    </td>
                                    <td className="py-3 text-right whitespace-nowrap">
                                        {d ? (
                                            <div className="flex justify-end gap-1">
                                                <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => saveLine(l, d)}>
                                                    <Save size={12} /> Save
                                                </button>
                                                <button type="button" className={BTN_GHOST} onClick={() => { setError(null); setEditing(null); }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-1">
                                                {canRaiseInvoice(schedule.billing_mode, l) && (
                                                    <button type="button" className={BTN_GHOST} disabled={busy} onClick={() => void raiseInvoice(l)} aria-label={`Raise invoice for ${l.label}`}>
                                                        <Receipt size={12} /> Raise invoice
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className={BTN_GHOST}
                                                    aria-label={`Edit ${l.label}`}
                                                    onClick={() => { setError(null); setEditing({ id: l.id, draft: toDraft(l) }); }}
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {errorLine}
        </div>
    );
};

export default DealPaymentPlanPanel;
