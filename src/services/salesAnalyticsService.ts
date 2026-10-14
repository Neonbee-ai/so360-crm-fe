import { crmApiClient } from './crmService';
import { toQuery, type SalesFilters } from './salesReportService';
import { downloadExport, type ExportFormat } from './exportService';

/**
 * RE §30 — sales analytics (`submodule:crm:re_reports`). crm-be has no /v1.
 *
 *  GET /reports/sales-analytics         ?project_id&agent_id&developer_id&from&to&period
 *  GET /reports/sales-analytics/export  … &section&format   (needs deals.export)
 *
 * Project / developer filters narrow the sales sections only; lead, source and
 * agent-performance figures follow the date range and agent.
 */
export const REPORT_PERIODS = ['month', 'quarter', 'year'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const ANALYTICS_SECTIONS = [
    'by_agent',
    'by_project',
    'by_developer',
    'by_period',
    'by_source',
    'lost_reasons',
    'reservations',
    'agent_performance',
] as const;
export type AnalyticsSection = (typeof ANALYTICS_SECTIONS)[number];

export interface SalesBucket {
    key: string;
    label: string;
    deals: number;
    sale_value: number;
}

export interface SourceRow {
    source: string;
    campaign: string;
    leads: number;
    converted: number;
    won_deals: number;
    won_value: number;
}

export interface LostReasonRow {
    key: string;
    label: string;
    count: number;
    lost_value: number;
}

export interface AgentPerformanceRow {
    key: string;
    name: string;
    leads: number;
    calls: number;
    converted: number;
    deals_won: number;
    won_value: number;
    conversion_rate: number;
}

export interface SalesAnalytics {
    period: ReportPeriod;
    totals: {
        bookings: number;
        booking_value: number;
        avg_deal_value: number;
        leads: number;
        converted_leads: number;
        lost_deals: number;
        lost_value: number;
    };
    by_agent: SalesBucket[];
    by_project: SalesBucket[];
    by_developer: SalesBucket[];
    by_period: SalesBucket[];
    by_source: SourceRow[];
    reservations: { active: number; committed: number; released: number; total: number };
    lost_reasons: LostReasonRow[];
    agent_performance: AgentPerformanceRow[];
}

const num = (v: unknown): number => {
    const n = Number(v);
    return v == null || v === '' || !Number.isFinite(n) ? 0 : n;
};
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.trim() ? v : fallback;

function bucket(raw: any, idField: string, nameField: string, fallback: string): SalesBucket {
    const key = raw?.[idField] == null ? '' : String(raw[idField]);
    return { key, label: text(raw?.[nameField], fallback), deals: num(raw?.deals), sale_value: num(raw?.sale_value) };
}

/** Accepts any partial / malformed payload and always returns a full shape. */
export function normalizeSalesAnalytics(raw: any): SalesAnalytics {
    const t = raw?.totals ?? {};
    const r = raw?.reservations ?? {};
    const period = (REPORT_PERIODS as readonly string[]).includes(raw?.period) ? raw.period as ReportPeriod : 'month';
    return {
        period,
        totals: {
            bookings: num(t.bookings),
            booking_value: num(t.booking_value),
            avg_deal_value: num(t.avg_deal_value),
            leads: num(t.leads),
            converted_leads: num(t.converted_leads),
            lost_deals: num(t.lost_deals),
            lost_value: num(t.lost_value),
        },
        by_agent: arr(raw?.by_agent).map((b) => bucket(b, 'agent_id', 'agent_name', 'Unassigned')),
        by_project: arr(raw?.by_project).map((b) => bucket(b, 'project_id', 'project_name', 'No project')),
        by_developer: arr(raw?.by_developer).map((b) => bucket(b, 'developer_id', 'developer_name', 'No developer')),
        by_period: arr(raw?.by_period).map((b) => bucket(b, 'period', 'period', '—')),
        by_source: arr(raw?.by_source).map((s) => ({
            source: text(s?.source, 'Unknown'),
            campaign: text(s?.campaign, '—'),
            leads: num(s?.leads),
            converted: num(s?.converted),
            won_deals: num(s?.won_deals),
            won_value: num(s?.won_value),
        })),
        reservations: { active: num(r.active), committed: num(r.committed), released: num(r.released), total: num(r.total) },
        lost_reasons: arr(raw?.lost_reasons).map((l) => ({
            key: String(l?.key ?? ''),
            label: text(l?.label, 'Unspecified'),
            count: num(l?.count),
            lost_value: num(l?.lost_value),
        })),
        agent_performance: arr(raw?.agent_performance).map((a) => ({
            key: String(a?.person_id ?? a?.user_id ?? ''),
            name: text(a?.name, 'Unknown agent'),
            leads: num(a?.leads),
            calls: num(a?.calls),
            converted: num(a?.converted),
            deals_won: num(a?.deals_won),
            won_value: num(a?.won_value),
            conversion_rate: num(a?.conversion_rate),
        })),
    };
}

export const salesAnalyticsService = {
    async get(filters: SalesFilters, period: ReportPeriod): Promise<SalesAnalytics> {
        return normalizeSalesAnalytics(
            await crmApiClient.get<any>('/reports/sales-analytics', { ...toQuery(filters), period }),
        );
    },
    exportSection(filters: SalesFilters, period: ReportPeriod, section: AnalyticsSection, format: ExportFormat): Promise<void> {
        return downloadExport(
            '/reports/sales-analytics/export',
            { ...toQuery(filters), period, section },
            `sales_${section}`,
            format,
        );
    },
};
