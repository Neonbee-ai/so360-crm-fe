import { crmApiClient } from './crmService';

/**
 * RE Phase C — Sales register (§27) and Commission report (§28).
 * crm-be has no /v1 prefix.
 *
 *  GET /sales               ?project_id&agent_id&developer_id&from&to&page&limit
 *  GET /reports/commission  ?project_id&agent_id&developer_id&from&to
 *
 * Without crm.commission.view the /sales commission columns come back null
 * and /reports/commission answers 403.
 */
export type SalePaymentStatus = 'none' | 'pending' | 'partial' | 'paid' | 'overdue';

export const PAYMENT_STATUS_LABELS: Record<SalePaymentStatus, string> = {
    none: 'No plan',
    pending: 'Pending',
    partial: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
};

export interface SalesFilters {
    project_id?: string;
    agent_id?: string;
    developer_id?: string;
    from?: string;
    to?: string;
}

export interface SaleRow {
    deal_id: string;
    developer_id: string | null;
    developer_name: string | null;
    project_id: string | null;
    project_name: string | null;
    unit_id: string | null;
    unit_number: string | null;
    client_name: string | null;
    agent_id: string | null;
    agent_name: string | null;
    sale_price: number | null;
    sale_date: string | null;
    payment_status: SalePaymentStatus;
    agent_commission: number | null;
    company_commission: number | null;
}

export interface SalesPage {
    rows: SaleRow[];
    total: number;
}

export interface CommissionTotals {
    gross: number;
    agent: number;
    company: number;
    pending: number;
    approved: number;
    payable: number;
    paid: number;
}

export interface CommissionBucket {
    key: string;
    label: string;
    gross: number;
    agent: number;
    company: number;
    count: number | null;
}

export interface CommissionReport {
    totals: CommissionTotals;
    by_project: CommissionBucket[];
    by_agent: CommissionBucket[];
    by_month: CommissionBucket[];
}

const STATUSES: readonly string[] = Object.keys(PAYMENT_STATUS_LABELS);

const toNum = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const zero = (v: unknown): number => toNum(v) ?? 0;

function normalizeSaleRow(raw: any): SaleRow {
    return {
        deal_id: String(raw?.deal_id ?? ''),
        developer_id: raw?.developer_id ?? null,
        developer_name: raw?.developer_name ?? null,
        project_id: raw?.project_id ?? null,
        project_name: raw?.project_name ?? null,
        unit_id: raw?.unit_id ?? null,
        unit_number: raw?.unit_number ?? null,
        client_name: raw?.client_name ?? null,
        agent_id: raw?.agent_id ?? null,
        agent_name: raw?.agent_name ?? null,
        sale_price: toNum(raw?.sale_price),
        sale_date: raw?.sale_date ?? null,
        payment_status: STATUSES.includes(raw?.payment_status) ? raw.payment_status as SalePaymentStatus : 'none',
        agent_commission: toNum(raw?.agent_commission),
        company_commission: toNum(raw?.company_commission),
    };
}

/** The contract leaves the envelope open — accept a bare array, {rows|data|items, total}. */
export function normalizeSalesPage(raw: any): SalesPage {
    const list: any[] = Array.isArray(raw) ? raw
        : Array.isArray(raw?.rows) ? raw.rows
            : Array.isArray(raw?.data) ? raw.data
                : Array.isArray(raw?.items) ? raw.items : [];
    const rows = list.map(normalizeSaleRow);
    const total = toNum(raw?.total) ?? toNum(raw?.meta?.total) ?? rows.length;
    return { rows, total };
}

function normalizeBucket(raw: any, keyField: string, labelFields: string[]): CommissionBucket {
    const key = String(raw?.[keyField] ?? raw?.key ?? raw?.id ?? '');
    const labelSrc = labelFields.map((f) => raw?.[f]).find((v) => v != null && v !== '');
    return {
        key,
        label: String(labelSrc ?? (key || 'Unassigned')),
        gross: zero(raw?.gross),
        agent: zero(raw?.agent),
        company: zero(raw?.company),
        count: toNum(raw?.count ?? raw?.deals),
    };
}

export function normalizeCommissionReport(raw: any): CommissionReport {
    const t = raw?.totals ?? {};
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    return {
        totals: {
            gross: zero(t.gross), agent: zero(t.agent), company: zero(t.company),
            pending: zero(t.pending), approved: zero(t.approved), payable: zero(t.payable), paid: zero(t.paid),
        },
        by_project: arr(raw?.by_project).map((b) => normalizeBucket(b, 'project_id', ['project_name', 'name', 'label'])),
        by_agent: arr(raw?.by_agent).map((b) => normalizeBucket(b, 'agent_id', ['agent_name', 'name', 'label'])),
        by_month: arr(raw?.by_month).map((b) => normalizeBucket(b, 'month', ['month', 'label'])),
    };
}

/** Drops blank filters so the query string only carries what the user chose. */
export function toQuery(f: SalesFilters, extra: Record<string, number> = {}): Record<string, string | number> {
    const q: Record<string, string | number> = {};
    (Object.keys(f) as Array<keyof SalesFilters>).forEach((k) => {
        const v = f[k];
        if (v) q[k] = v;
    });
    return { ...q, ...extra };
}

export function validateDateRange(f: SalesFilters): string | null {
    if (f.from && f.to && f.from > f.to) return 'The start date must be on or before the end date.';
    return null;
}

export const salesReportService = {
    async listSales(filters: SalesFilters, page: number, limit: number): Promise<SalesPage> {
        return normalizeSalesPage(await crmApiClient.get<any>('/sales', toQuery(filters, { page, limit })));
    },
    async commissionReport(filters: SalesFilters): Promise<CommissionReport> {
        return normalizeCommissionReport(await crmApiClient.get<any>('/reports/commission', toQuery(filters)));
    },
};
