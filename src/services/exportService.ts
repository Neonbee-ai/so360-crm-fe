import { crmApiClient } from './crmService';
import { toQuery, type SalesFilters } from './salesReportService';

/**
 * RE §48 — file exports (CSV / XLSX / PDF). The server builds the file with
 * the same filters and RBAC record scope as the screen it came from, so an
 * export can never hold more than the user can already see; this module only
 * asks for it and hands the file to the browser.
 */
export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
    csv: 'CSV',
    xlsx: 'Excel',
    pdf: 'PDF',
};

/** Saves a Blob as a download (same pattern as the audit-trail export). */
export function saveBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

/** GETs a file endpoint and saves it, preferring the server's filename. */
export async function downloadExport(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    fallbackName: string,
    format: ExportFormat,
): Promise<void> {
    const { blob, filename } = await crmApiClient.getBlob(endpoint, { ...params, format });
    saveBlob(blob, filename || `${fallbackName}.${format}`);
}

/** Lead list filters the export endpoint understands. */
export interface LeadExportFilters {
    /** Stage display name; 'All' or empty means every stage. */
    status?: string;
    source?: string;
}

/** Deal list filters the export endpoint understands (a subset of DealFilters). */
export interface DealExportFilters {
    date_range?: string;
    start_date?: string;
    end_date?: string;
    owner_id?: string;
    stage_id?: string;
    status?: 'open' | 'won' | 'lost';
}

export const exportService = {
    sales: (filters: SalesFilters, format: ExportFormat) =>
        downloadExport('/sales/export', toQuery(filters), 'sales_register', format),

    commission: (filters: SalesFilters, format: ExportFormat) =>
        downloadExport('/reports/commission/export', toQuery(filters), 'commission_report', format),

    leads: (filters: LeadExportFilters, format: ExportFormat) =>
        downloadExport('/leads/export', {
            status: filters.status && filters.status !== 'All' ? filters.status : undefined,
            source: filters.source || undefined,
        }, 'leads', format),

    deals: (filters: DealExportFilters, format: ExportFormat) =>
        downloadExport('/deals/export', {
            // Only the fields the export DTO accepts — anything else is dropped
            // so a list-only filter can never make the request fail validation.
            date_range: filters.date_range || undefined,
            start_date: filters.date_range === 'custom' ? filters.start_date : undefined,
            end_date: filters.date_range === 'custom' ? filters.end_date : undefined,
            owner_id: filters.owner_id || undefined,
            stage_id: filters.stage_id || undefined,
            status: filters.status || undefined,
        }, 'deals', format),
};
