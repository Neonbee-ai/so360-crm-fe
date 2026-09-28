import { crmApiClient } from './crmService';

/**
 * Real-estate dashboard widgets (A10). crm-be has no /v1 prefix.
 *
 *  GET /dashboard/re-widgets → {
 *    inventory_by_project, pipeline_by_project, holds_expiring, source_performance
 *  }
 *
 * The payload is normalised defensively: a missing or malformed section reads
 * as an empty list, numbers default to 0, and rows with no label are dropped.
 */

export interface InventoryByProject {
    project: string;
    available: number;
    held: number;
    sold: number;
}

export interface PipelineByProject {
    project: string;
    value: number;
    count: number;
}

export interface ExpiringHold {
    item_id: string | null;
    unit_number: string;
    project: string | null;
    /** Whole hours until the hold lapses (never negative). */
    hours_left: number;
}

export interface SourcePerformance {
    source: string;
    leads: number;
    won: number;
    /** Lead → won conversion, 0–100. */
    rate: number;
}

export interface REWidgetsData {
    inventory_by_project: InventoryByProject[];
    pipeline_by_project: PipelineByProject[];
    holds_expiring: ExpiringHold[];
    source_performance: SourcePerformance[];
}

const num = (v: unknown): number => {
    const n = typeof v === 'string' ? Number(v) : (v as number);
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const list = (v: unknown): any[] => (Array.isArray(v) ? v.filter((r) => r && typeof r === 'object') : []);

/** Hours left, from `hours_left` or else `expires_at` measured against `now`. */
export function hoursLeft(row: { hours_left?: unknown; expires_at?: unknown }, now: Date = new Date()): number {
    if (row.hours_left != null && Number.isFinite(Number(row.hours_left))) {
        return Math.max(0, Math.round(Number(row.hours_left)));
    }
    const at = row.expires_at ? new Date(str(row.expires_at)).getTime() : NaN;
    if (Number.isNaN(at)) return 0;
    return Math.max(0, Math.round((at - now.getTime()) / 3_600_000));
}

/** Conversion %, from `rate` when sent, else won / leads. */
export function conversionRate(row: { rate?: unknown; leads?: unknown; won?: unknown }): number {
    if (row.rate != null && Number.isFinite(Number(row.rate))) return Math.round(Number(row.rate));
    const leads = num(row.leads);
    return leads > 0 ? Math.round((num(row.won) / leads) * 100) : 0;
}

export function normalizeREWidgets(raw: any, now: Date = new Date()): REWidgetsData {
    const d = raw && typeof raw === 'object' ? raw : {};
    return {
        inventory_by_project: list(d.inventory_by_project)
            .map((r) => ({ project: str(r.project), available: num(r.available), held: num(r.held), sold: num(r.sold) }))
            .filter((r) => r.project),
        pipeline_by_project: list(d.pipeline_by_project)
            .map((r) => ({ project: str(r.project), value: num(r.value), count: num(r.count) }))
            .filter((r) => r.project),
        holds_expiring: list(d.holds_expiring)
            .map((r) => ({
                item_id: r.item_id ? str(r.item_id) : null,
                unit_number: str(r.unit_number) || str(r.item_id),
                project: r.project ? str(r.project) : null,
                hours_left: hoursLeft(r, now),
            }))
            .filter((r) => r.unit_number)
            .sort((a, b) => a.hours_left - b.hours_left),
        source_performance: list(d.source_performance)
            .map((r) => ({ source: str(r.source), leads: num(r.leads), won: num(r.won), rate: conversionRate(r) }))
            .filter((r) => r.source)
            .sort((a, b) => b.rate - a.rate),
    };
}

export const isREWidgetsEmpty = (d: REWidgetsData): boolean =>
    !d.inventory_by_project.length && !d.pipeline_by_project.length
    && !d.holds_expiring.length && !d.source_performance.length;

export const reWidgetsService = {
    get: async (): Promise<REWidgetsData> =>
        normalizeREWidgets(await crmApiClient.get<any>('/dashboard/re-widgets')),
};
