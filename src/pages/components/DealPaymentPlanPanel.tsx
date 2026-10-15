import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, Loader2, Plus, Receipt, Save, Trash2, X } from 'lucide-react';
import { toast, Button, IconButton, TextField, NumberInput, DatePicker, Select, DataTable } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';
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
import { CombGrid } from './CombGrid';


export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
    full_invoice: 'One invoice for the full price',
    invoice_per_instalment: 'Invoice each instalment',
    schedule_only: 'Schedule only (no invoices)',
};

const STATUS_CHIP: Record<ScheduleLineStatus, string> = {
    due: 'bg-warning/10 text-warning border-warning/30',
    invoiced: 'bg-info/10 text-info border-info/30',
    paid: 'bg-success/10 text-success border-success/30',
    bounced: 'bg-danger/10 text-danger border-danger/30',
    cancelled: 'bg-fg-muted/10 text-fg-subtle border-line',
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
            <div className="p-8 flex items-center gap-2 text-fg-subtle text-sm" role="status">
                <Loader2 className="animate-spin" size={16} /> Loading payment plan…
            </div>
        );
    }
    if (loadError || !data) {
        return (
            <div className="p-8 space-y-3">
                <p role="alert" className="text-sm text-danger">{loadError ?? 'Could not load the payment plan.'}</p>
                <Button variant="secondary" size="sm" type="button" onClick={() => void load()}>Retry</Button>
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

    const errorLine = error && <p role="alert" className="text-sm text-danger">{error}</p>;

    // ── Empty state ────────────────────────────────────────────────────────
    if (!data.schedule) {
        const setRow = (i: number, patch: Partial<ManualRow>) => {
            setError(null);
            setManual((rows) => (rows ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)));
        };
        return (
            <div className="p-8 space-y-6" data-testid="payment-plan-empty">
                <div>
                    <h3 className="text-sm font-semibold text-fg">No payment plan yet</h3>
                    <p className="text-xs text-fg-muted mt-1">Start from one of the project's plans, or enter the instalments yourself.</p>
                </div>
                {manual === null && (
                    <div className="flex flex-wrap items-end gap-3">
                        {templates.length > 0 ? (
                            <>
                                <div className="min-w-[16rem]">
                                    <label htmlFor="pp-template" className="block text-xs font-semibold text-fg-muted mb-1.5">Project plan</label>
                                    <Select id="pp-template" name="pp-template" value={templateId} options={templates.map((t) => ({ value: t.id, label: `${t.name}${t.is_default ? ' (default)' : ''}` }))} onChange={(e) => setTemplateId(e.target.value)} />
                                </div>
                                <Button variant="primary" size="sm" type="button" disabled={busy || !templateId} onClick={() => void createFromTemplate()}>
                                    {busy ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Create from template
                                </Button>
                            </>
                        ) : (
                            <p className="text-xs text-fg-muted">This deal's project has no payment plans set up.</p>
                        )}
                        <Button variant="secondary" size="sm" type="button" onClick={() => { setError(null); setManual([blankRow()]); }}>
                            <Edit2 size={14} /> Enter instalments manually
                        </Button>
                    </div>
                )}
                {manual !== null && (
                    <div className="space-y-3" aria-label="Manual instalments">
                        {manual.map((r, i) => (
                            <div key={i} className="grid grid-cols-1 wc-medium:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                                <TextField name={`pp-label-${i}`} aria-label={`Instalment ${i + 1} label`} placeholder="Label, e.g. Booking" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                                <NumberInput name={`pp-amount-${i}`} aria-label={`Instalment ${i + 1} amount`} min={0} placeholder="Amount" value={r.amount === '' ? null : Number(r.amount)} onChange={(v) => setRow(i, { amount: v == null ? '' : String(v) })} />
                                <DatePicker name={`pp-due-${i}`} aria-label={`Instalment ${i + 1} due date`} value={r.due_date} onChange={(v) => setRow(i, { due_date: v })} />
                                <Select
                                    name={`pp-mode-${i}`}
                                    aria-label={`Instalment ${i + 1} payment mode`}
                                    value={r.payment_mode}
                                    placeholder="Mode…"
                                    options={PAYMENT_MODES.map((m) => ({ value: m.value, label: m.label }))}
                                    onChange={(e) => setRow(i, { payment_mode: MODE_VALUES.includes(e.target.value) ? e.target.value as PaymentMode : '' })}
                                />
                                <IconButton
                                    label={`Remove instalment ${i + 1}`}
                                    variant="danger"
                                    icon={<Trash2 size={14} />}
                                    onClick={() => setManual((rows) => (rows ?? []).filter((_, j) => j !== i))}
                                />
                            </div>
                        ))}
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" type="button" onClick={() => setManual((rows) => [...(rows ?? []), blankRow()])}>
                                <Plus size={14} /> Add instalment
                            </Button>
                            <Button variant="primary" size="sm" type="button" disabled={busy} onClick={createManual}>
                                {busy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Create plan
                            </Button>
                            <Button variant="secondary" size="sm" type="button" onClick={() => { setError(null); setManual(null); }}>
                                <X size={14} /> Cancel
                            </Button>
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

    const ppColumns: DataTableColumn<PaymentScheduleLine>[] = [
        { key: 'seq', header: '#', render: (l) => <span className="text-fg-muted">{l.seq}</span> },
        {
            key: 'label',
            header: 'Instalment',
            render: (l) => (
                <div>
                    <p className="font-bold text-fg">{l.label}</p>
                    {l.trigger && <p className="text-xs text-fg-muted">{TRIGGER_LABELS[l.trigger]}</p>}
                </div>
            ),
        },
        {
            key: 'amount',
            header: 'Amount',
            render: (l) => {
                const d = editing && editing.id === l.id ? editing.draft : null;
                return d ? (
                    <NumberInput name={`pp-line-amount-${l.id}`} aria-label={`${l.label} amount`} min={0} value={d.amount === '' ? null : Number(d.amount)} onChange={(v) => setDraft({ amount: v == null ? '' : String(v) })} />
                ) : <span className="font-bold text-fg">{fmt.formatCurrency(l.amount)}</span>;
            },
        },
        {
            key: 'due_date',
            header: 'Due',
            render: (l) => {
                const d = editing && editing.id === l.id ? editing.draft : null;
                return d ? (
                    <DatePicker name={`pp-line-due-${l.id}`} aria-label={`${l.label} due date`} value={d.due_date} onChange={(v) => setDraft({ due_date: v })} />
                ) : <span className="text-fg-subtle">{l.due_date ? fmt.formatDate(l.due_date) : '—'}</span>;
            },
        },
        {
            key: 'payment_mode',
            header: 'Mode',
            render: (l) => {
                const d = editing && editing.id === l.id ? editing.draft : null;
                return d ? (
                    <div className="space-y-2">
                        <Select
                            name={`pp-line-mode-${l.id}`}
                            aria-label={`${l.label} payment mode`}
                            value={d.payment_mode}
                            placeholder="—"
                            options={PAYMENT_MODES.map((m) => ({ value: m.value, label: m.label }))}
                            onChange={(e) => setDraft({ payment_mode: MODE_VALUES.includes(e.target.value) ? e.target.value as PaymentMode : '' })}
                        />
                        {isChequeMode(d.payment_mode || null) && (
                            <>
                                <TextField name={`pp-line-chq-no-${l.id}`} aria-label={`${l.label} cheque number`} placeholder="Cheque no." value={d.cheque_number} onChange={(e) => setDraft({ cheque_number: e.target.value })} />
                                <DatePicker name={`pp-line-chq-date-${l.id}`} aria-label={`${l.label} cheque date`} value={d.cheque_date} onChange={(v) => setDraft({ cheque_date: v })} />
                                <TextField name={`pp-line-chq-bank-${l.id}`} aria-label={`${l.label} cheque bank`} placeholder="Bank" value={d.cheque_bank} onChange={(e) => setDraft({ cheque_bank: e.target.value })} />
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <span className="text-fg-subtle">{modeLabel(l.payment_mode)}</span>
                        {isChequeMode(l.payment_mode) && (l.cheque_number || l.cheque_bank) && (
                            <p className="text-xs text-fg-muted">
                                {[l.cheque_number && `#${l.cheque_number}`, l.cheque_bank, l.cheque_date && fmt.formatDate(l.cheque_date)].filter(Boolean).join(' · ')}
                            </p>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'status',
            header: 'Status',
            render: (l) => {
                const d = editing && editing.id === l.id ? editing.draft : null;
                return (
                    <>
                        {d ? (
                            <Select
                                name={`pp-line-status-${l.id}`}
                                aria-label={`${l.label} status`}
                                value={d.status}
                                options={LINE_STATUSES
                                    .filter((s) => s.value !== 'invoiced' || l.status === 'invoiced')
                                    .map((s) => ({ value: s.value, label: s.label }))}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (STATUS_VALUES.includes(v)) setDraft({ status: v as ScheduleLineStatus });
                                }}
                            />
                        ) : (
                            <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_CHIP[l.status]}`}>
                                {statusLabel(l.status)}
                            </span>
                        )}
                        {l.invoice_id && !d && <p className="text-xs text-fg-muted mt-1">Invoice raised</p>}
                    </>
                );
            },
        },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (l) => {
                const d = editing && editing.id === l.id ? editing.draft : null;
                return d ? (
                    <div className="flex justify-end gap-1">
                        <Button variant="primary" size="sm" type="button" disabled={busy} onClick={() => saveLine(l, d)}>
                            <Save size={12} /> Save
                        </Button>
                        <Button variant="secondary" size="sm" type="button" onClick={() => { setError(null); setEditing(null); }}>
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <div className="flex justify-end gap-1">
                        {canRaiseInvoice(schedule.billing_mode, l) && (
                            <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={() => void raiseInvoice(l)} aria-label={`Raise invoice for ${l.label}`}>
                                <Receipt size={12} /> Raise invoice
                            </Button>
                        )}
                        <IconButton
                            label={`Edit ${l.label}`}
                            icon={<Edit2 size={12} />}
                            onClick={() => { setError(null); setEditing({ id: l.id, draft: toDraft(l) }); }}
                        />
                    </div>
                );
            },
        },
    ];

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-fg">{schedule.template_name ?? 'Payment plan'}</h3>
                    <p className="text-xs text-fg-muted mt-1">{BILLING_MODE_LABELS[schedule.billing_mode]}</p>
                </div>
            </div>

            <CombGrid cols="trio">
                {([['Total', totals.total], ['Paid', totals.paid], ['Outstanding', totals.outstanding]] as const).map(([label, v]) => (
                    <div key={label} className="bg-surface-sunken border border-line rounded-nb-lg p-4" data-testid={`pp-total-${label.toLowerCase()}`}>
                        <p className="text-xs font-semibold text-fg-muted">{label}</p>
                        <p className="text-lg font-semibold text-fg mt-1">{fmt.formatCurrency(v)}</p>
                    </div>
                ))}
            </CombGrid>

            <DataTable<PaymentScheduleLine>
                name="pp-instalments"
                data-testid="pp-instalments"
                rows={lines}
                rowKey={(l) => l.id}
                getRowProps={(l) => ({ 'data-testid': `pp-line-${l.id}` })}
                columns={ppColumns}
            />
            {errorLine}
        </div>
    );
};

export default DealPaymentPlanPanel;
