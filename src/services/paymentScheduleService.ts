import { crmApiClient, crmInventoryClient, crmService } from './crmService';

/**
 * RE Phase C — deal payment schedule (flag `submodule:crm:payment_plans`).
 * crm-be has no /v1 prefix.
 *
 *  GET   /deals/:id/payment-schedule                       → { schedule, lines[] } | { schedule:null, lines:[] }
 *  POST  /deals/:id/payment-schedule                       body { template_id? , lines? }
 *  PATCH /deals/:id/payment-schedule/lines/:lineId         body PaymentLinePatch
 *  POST  /deals/:id/payment-schedule/lines/:lineId/invoice (invoice_per_instalment only)
 *
 * Project templates live on Inventory `item_categories.metadata.payment_plan_templates`.
 */
export type BillingMode = 'full_invoice' | 'invoice_per_instalment' | 'schedule_only';
export type PaymentMode = 'cash' | 'cheque' | 'pdc' | 'bank_transfer' | 'mortgage' | 'card' | 'escrow';
export type InstalmentTrigger = 'booking' | 'fixed_date' | 'days_after_booking' | 'milestone' | 'handover' | 'months_after_handover';
export type ScheduleLineStatus = 'due' | 'invoiced' | 'paid' | 'bounced' | 'cancelled';

export const PAYMENT_MODES: ReadonlyArray<{ value: PaymentMode; label: string }> = [
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'pdc', label: 'PDC' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'mortgage', label: 'Mortgage' },
    { value: 'card', label: 'Card' },
    { value: 'escrow', label: 'Escrow' },
];

export const LINE_STATUSES: ReadonlyArray<{ value: ScheduleLineStatus; label: string }> = [
    { value: 'due', label: 'Due' },
    { value: 'invoiced', label: 'Invoiced' },
    { value: 'paid', label: 'Paid' },
    { value: 'bounced', label: 'Bounced' },
    { value: 'cancelled', label: 'Cancelled' },
];

export const TRIGGER_LABELS: Record<InstalmentTrigger, string> = {
    booking: 'On booking',
    fixed_date: 'Fixed date',
    days_after_booking: 'Days after booking',
    milestone: 'Milestone',
    handover: 'On handover',
    months_after_handover: 'Months after handover',
};

export interface PaymentSchedule {
    id?: string;
    template_id: string | null;
    template_name: string | null;
    billing_mode: BillingMode;
    currency: string | null;
    total_amount: number;
}

export interface PaymentScheduleLine {
    id: string;
    seq: number;
    label: string;
    amount: number;
    percent: number | null;
    trigger: InstalmentTrigger | null;
    due_date: string | null;
    payment_mode: PaymentMode | null;
    cheque_number: string | null;
    cheque_date: string | null;
    cheque_bank: string | null;
    status: ScheduleLineStatus;
    invoice_id: string | null;
    paid_at: string | null;
    reminded_days: number[];
}

export interface PaymentScheduleResponse {
    schedule: PaymentSchedule | null;
    lines: PaymentScheduleLine[];
}

export interface PaymentPlanTemplateLine {
    label: string;
    type: 'percent' | 'fixed';
    value: number;
    trigger: InstalmentTrigger;
    offset?: number | null;
    date?: string | null;
    milestone?: string | null;
}

export interface PaymentPlanTemplate {
    id: string;
    name: string;
    is_default?: boolean;
    billing_mode?: BillingMode | null;
    allowed_modes?: PaymentMode[] | null;
    lines: PaymentPlanTemplateLine[];
}

/** A manual line posted when no template is used. */
export interface ManualLineInput {
    label: string;
    amount: number;
    due_date?: string | null;
    payment_mode?: PaymentMode | null;
}

export interface PaymentLinePatch {
    amount?: number;
    due_date?: string | null;
    payment_mode?: PaymentMode | null;
    cheque_number?: string | null;
    cheque_date?: string | null;
    cheque_bank?: string | null;
    status?: ScheduleLineStatus;
    label?: string;
}

const BILLING_MODES: readonly BillingMode[] = ['full_invoice', 'invoice_per_instalment', 'schedule_only'];
const MODES: readonly string[] = PAYMENT_MODES.map((m) => m.value);
const STATUSES: readonly string[] = LINE_STATUSES.map((s) => s.value);
const TRIGGERS: readonly string[] = Object.keys(TRIGGER_LABELS);

const toNum = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

function normalizeLine(raw: any, i: number): PaymentScheduleLine {
    return {
        id: String(raw?.id ?? `line-${i}`),
        seq: toNum(raw?.seq) ?? i + 1,
        label: String(raw?.label ?? ''),
        amount: toNum(raw?.amount) ?? 0,
        percent: toNum(raw?.percent),
        trigger: TRIGGERS.includes(raw?.trigger) ? raw.trigger as InstalmentTrigger : null,
        due_date: raw?.due_date ?? null,
        payment_mode: MODES.includes(raw?.payment_mode) ? raw.payment_mode as PaymentMode : null,
        cheque_number: raw?.cheque_number ?? null,
        cheque_date: raw?.cheque_date ?? null,
        cheque_bank: raw?.cheque_bank ?? null,
        status: STATUSES.includes(raw?.status) ? raw.status as ScheduleLineStatus : 'due',
        invoice_id: raw?.invoice_id ?? null,
        paid_at: raw?.paid_at ?? null,
        reminded_days: Array.isArray(raw?.reminded_days) ? raw.reminded_days : [],
    };
}

export function normalizeSchedule(raw: any): PaymentScheduleResponse {
    const s = raw?.schedule;
    const lines = Array.isArray(raw?.lines) ? raw.lines.map(normalizeLine) : [];
    lines.sort((a: PaymentScheduleLine, b: PaymentScheduleLine) => a.seq - b.seq);
    if (!s) return { schedule: null, lines: [] };
    return {
        schedule: {
            ...(s.id ? { id: String(s.id) } : {}),
            template_id: s.template_id ?? null,
            template_name: s.template_name ?? null,
            billing_mode: BILLING_MODES.includes(s.billing_mode) ? s.billing_mode : 'full_invoice',
            currency: s.currency ?? null,
            total_amount: toNum(s.total_amount) ?? 0,
        },
        lines,
    };
}

export interface ScheduleTotals {
    total: number;
    paid: number;
    outstanding: number;
}

/** Cancelled lines don't count; paid lines count as paid; everything else is outstanding. */
export function scheduleTotals(lines: PaymentScheduleLine[]): ScheduleTotals {
    let total = 0;
    let paid = 0;
    for (const l of lines) {
        if (l.status === 'cancelled') continue;
        total += l.amount;
        if (l.status === 'paid') paid += l.amount;
    }
    return { total, paid, outstanding: total - paid };
}

/** "Raise invoice" is offered only per-instalment, and only for a line not yet invoiced/settled. */
export function canRaiseInvoice(mode: BillingMode | undefined | null, line: PaymentScheduleLine): boolean {
    return mode === 'invoice_per_instalment' && line.status === 'due' && !line.invoice_id;
}

/** Cheque fields apply to cheque and post-dated cheque lines only. */
export const isChequeMode = (m: PaymentMode | null | undefined): boolean => m === 'cheque' || m === 'pdc';

export function validateManualLines(lines: ManualLineInput[]): string | null {
    if (lines.length === 0) return 'Add at least one instalment.';
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].label.trim()) return `Instalment ${i + 1}: enter a label.`;
        if (!Number.isFinite(lines[i].amount) || lines[i].amount <= 0) return `Instalment ${i + 1}: amount must be greater than 0.`;
    }
    return null;
}

function templatesOf(meta: any): PaymentPlanTemplate[] {
    const list = meta?.payment_plan_templates;
    if (!Array.isArray(list)) return [];
    return list
        .filter((t: any) => t && t.id != null && t.name)
        .map((t: any) => ({ ...t, id: String(t.id), name: String(t.name), lines: Array.isArray(t.lines) ? t.lines : [] }));
}

/**
 * The deal's project templates. The backend GET may already carry them as
 * `templates`; otherwise they are resolved from the deal's first product
 * that sits in an Inventory category, walking up the category tree (tower →
 * project) to the nearest level that defines templates. The default template
 * sorts first. Any failure reads as "no templates" — manual lines stay open.
 */
export async function resolveDealTemplates(dealId: string, fromSchedule?: unknown): Promise<PaymentPlanTemplate[]> {
    const sortDefault = (ts: PaymentPlanTemplate[]) =>
        [...ts].sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default));
    if (Array.isArray(fromSchedule) && fromSchedule.length) {
        return sortDefault(templatesOf({ payment_plan_templates: fromSchedule }));
    }
    try {
        const [products, categories] = await Promise.all([
            crmService.getDealProducts(dealId),
            getCategoriesWithMetadata(),
        ]);
        const byId = new Map(categories.map((c) => [c.id, c]));
        for (const p of Array.isArray(products) ? products : []) {
            let cat = p?.category_id ? byId.get(p.category_id) : undefined;
            const guard = new Set<string>();
            while (cat && !guard.has(cat.id)) {
                guard.add(cat.id);
                const ts = templatesOf(cat.metadata);
                if (ts.length) return sortDefault(ts);
                cat = cat.parent_id ? byId.get(cat.parent_id) : undefined;
            }
        }
    } catch {
        /* fall through to manual lines */
    }
    return [];
}

interface CategoryRow { id: string; parent_id: string | null; metadata: any }

async function getCategoriesWithMetadata(): Promise<CategoryRow[]> {
    // Inventory's settings payload returns raw `item_categories` rows
    // (`select("*")`), so `metadata` is present — the shared
    // getProductCategories() mapper strips it, hence the direct call.
    const res = await crmInventoryClient.get<any>(`/v1/inventory/settings/${crmApiClient.getOrgId()}`);
    const rows: any[] = Array.isArray(res?.categories) ? res.categories : [];
    return rows.map((c: any) => ({ id: String(c.id), parent_id: c.parent_id ?? null, metadata: c.metadata ?? null }));
}

const base = (dealId: string) => `/deals/${encodeURIComponent(dealId)}/payment-schedule`;

export const paymentScheduleService = {
    async get(dealId: string): Promise<PaymentScheduleResponse & { templates?: unknown }> {
        const raw = await crmApiClient.get<any>(base(dealId));
        return { ...normalizeSchedule(raw), ...(raw && Array.isArray(raw.templates) ? { templates: raw.templates } : {}) };
    },
    async createFromTemplate(dealId: string, templateId: string): Promise<PaymentScheduleResponse> {
        return normalizeSchedule(await crmApiClient.post<any>(base(dealId), { template_id: templateId }));
    },
    async createManual(dealId: string, lines: ManualLineInput[]): Promise<PaymentScheduleResponse> {
        const body = lines.map((l) => ({
            label: l.label.trim(),
            amount: l.amount,
            ...(l.due_date ? { due_date: l.due_date } : {}),
            ...(l.payment_mode ? { payment_mode: l.payment_mode } : {}),
        }));
        return normalizeSchedule(await crmApiClient.post<any>(base(dealId), { lines: body }));
    },
    async updateLine(dealId: string, lineId: string, patch: PaymentLinePatch): Promise<void> {
        await crmApiClient.patch<any>(`${base(dealId)}/lines/${encodeURIComponent(lineId)}`, patch);
    },
    async raiseInvoice(dealId: string, lineId: string): Promise<{ invoice_id?: string | null }> {
        const res = await crmApiClient.post<any>(`${base(dealId)}/lines/${encodeURIComponent(lineId)}/invoice`, {});
        return { invoice_id: res?.invoice_id ?? res?.line?.invoice_id ?? null };
    },
};
