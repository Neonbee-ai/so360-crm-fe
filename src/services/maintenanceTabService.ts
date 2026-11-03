import type React from 'react';
import { crmMaintenanceClient } from './crmService';

/** Flag gating the Maintenance tab on customer and deal detail pages. */
export const MAINTENANCE_TAB_FLAG = 'submodule:crm:maintenance-tab';

export interface MaintenancePlanRow {
    id: string;
    name?: string | null;
    active?: boolean | null;
    interval_unit?: 'days' | 'months' | null;
    interval_value?: number | null;
    next_due_at?: string | null;
}

export interface MaintenanceRequestRow {
    id: string;
    number?: string | null;
    title?: string | null;
    /** 0 Low, 1 Normal, 2 High, 3 Critical. */
    priority?: number | null;
    scheduled_start?: string | null;
    is_scrap?: boolean | null;
    stage?: { name?: string | null; request_done?: boolean | null; is_scrap?: boolean | null } | null;
}

export const PRIORITY_LABEL: Record<number, string> = { 0: 'Low', 1: 'Normal', 2: 'High', 3: 'Critical' };

/** A request is open until its stage is a done/scrap stage. */
export const isOpenRequest = (r: MaintenanceRequestRow): boolean => !(r.stage?.request_done || r.stage?.is_scrap || r.is_scrap);

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
        return rows.filter(isOpenRequest);
    },
};

/** Appends the Maintenance tab to a detail tab list only when the flag is on. */
export function withMaintenanceTab<T extends { id: string; label: React.ReactNode }>(tabs: T[], enabled: boolean): Array<T | { id: 'maintenance'; label: string }> {
    return enabled ? [...tabs, { id: 'maintenance', label: 'Maintenance' }] : tabs;
}
