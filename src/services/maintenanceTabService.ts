import type React from 'react';
import { crmMaintenanceClient } from './crmService';

/** Flag gating the Maintenance tab on customer and deal detail pages. */
export const MAINTENANCE_TAB_FLAG = 'submodule:crm:maintenance-tab';

export interface MaintenancePlanRow {
    id: string;
    name?: string | null;
    status?: string | null;
    interval_days?: number | null;
    next_due_at?: string | null;
}

export interface MaintenanceRequestRow {
    id: string;
    request_number?: string | null;
    title?: string | null;
    status?: string | null;
    priority?: string | null;
    due_date?: string | null;
}

export interface MaintenanceScope {
    customerPartnerId?: string | null;
    dealId?: string | null;
}

const LIMIT = 50;

/** Unwraps `[]`, `{ data: [] }` and `{ items: [] }` list envelopes. */
export function unwrapList<T>(body: unknown): T[] {
    if (Array.isArray(body)) return body as T[];
    const b = body as { data?: unknown; items?: unknown } | null;
    if (b && Array.isArray(b.data)) return b.data as T[];
    if (b && Array.isArray(b.items)) return b.items as T[];
    return [];
}

const scopeParams = (s: MaintenanceScope) => ({
    customer_partner_id: s.customerPartnerId || undefined,
    deal_id: s.dealId || undefined,
    limit: LIMIT,
});

export const maintenanceTabService = {
    async listPlans(scope: MaintenanceScope): Promise<MaintenancePlanRow[]> {
        return unwrapList<MaintenancePlanRow>(
            await crmMaintenanceClient.get<unknown>('/v1/maintenance/plans', scopeParams(scope)),
        );
    },
    async listOpenRequests(scope: MaintenanceScope): Promise<MaintenanceRequestRow[]> {
        const rows = unwrapList<MaintenanceRequestRow>(
            await crmMaintenanceClient.get<unknown>('/v1/maintenance/requests', { ...scopeParams(scope), archived: false }),
        );
        return rows.filter((r) => !['completed', 'closed', 'cancelled'].includes(String(r.status ?? '').toLowerCase()));
    },
};

/** Appends the Maintenance tab to a detail tab list only when the flag is on. */
export function withMaintenanceTab<T extends { id: string; label: React.ReactNode }>(tabs: T[], enabled: boolean): Array<T | { id: 'maintenance'; label: string }> {
    return enabled ? [...tabs, { id: 'maintenance', label: 'Maintenance' }] : tabs;
}
