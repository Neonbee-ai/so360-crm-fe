import { crmApiClient } from './crmService';

/**
 * RE Phase D §25 — CRM campaigns + ROI roll-up (`submodule:crm:campaign_roi`).
 * Distinct from the storefront marketing campaigns (MarketingCampaignsPage).
 * crm-be has no /v1 prefix.
 *
 *  GET /crm-campaigns/roi?status=   → Array<{ campaign, roi }>
 *  GET /crm-campaigns/:id/roi       → { campaign, roi }
 *
 * A lead rolls up to a campaign via leads.crm_campaign_id, or by matching
 * leads.utm_campaign. Revenue = won deals of those leads.
 */
export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
    draft: 'Draft',
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
    archived: 'Archived',
};

export interface CrmCampaign {
    id: string;
    name: string;
    channel: string | null;
    status: CampaignStatus;
    budget: number | null;
    spend: number;
    currency: string | null;
    start_date: string | null;
    end_date: string | null;
    utm_campaign: string | null;
}

export interface CampaignRoi {
    leads: number;
    qualified: number;
    deals_won: number;
    revenue: number;
    spend: number;
    cpl: number | null;
    roi: number | null;
    conversion_rate: number | null;
}

export interface CampaignRoiRow {
    campaign: CrmCampaign;
    roi: CampaignRoi;
}

const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const zero = (v: unknown): number => toNum(v) ?? 0;

export function normalizeCampaign(raw: any): CrmCampaign {
    return {
        id: String(raw?.id ?? ''),
        name: String(raw?.name ?? 'Untitled campaign'),
        channel: raw?.channel ?? null,
        status: CAMPAIGN_STATUSES.includes(raw?.status) ? raw.status : 'draft',
        budget: toNum(raw?.budget),
        spend: zero(raw?.spend),
        currency: raw?.currency ?? null,
        start_date: raw?.start_date ?? null,
        end_date: raw?.end_date ?? null,
        utm_campaign: raw?.utm_campaign ?? null,
    };
}

export function normalizeRoi(raw: any): CampaignRoi {
    return {
        leads: zero(raw?.leads),
        qualified: zero(raw?.qualified),
        deals_won: zero(raw?.deals_won),
        revenue: zero(raw?.revenue),
        spend: zero(raw?.spend),
        cpl: toNum(raw?.cpl),
        roi: toNum(raw?.roi),
        conversion_rate: toNum(raw?.conversion_rate),
    };
}

export function normalizeRoiRow(raw: any): CampaignRoiRow {
    return { campaign: normalizeCampaign(raw?.campaign ?? {}), roi: normalizeRoi(raw?.roi ?? {}) };
}

/** Accept a bare array or a {data|rows|items} envelope. */
export function normalizeRoiList(raw: any): CampaignRoiRow[] {
    const list: any[] = Array.isArray(raw) ? raw
        : Array.isArray(raw?.data) ? raw.data
            : Array.isArray(raw?.rows) ? raw.rows
                : Array.isArray(raw?.items) ? raw.items : [];
    return list.map(normalizeRoiRow);
}

export interface RoiTotals {
    leads: number;
    qualified: number;
    deals_won: number;
    revenue: number;
    spend: number;
    /** Blended (revenue − spend) / spend; null when nothing was spent. */
    roi: number | null;
    cpl: number | null;
}

export function sumRoi(rows: CampaignRoiRow[]): RoiTotals {
    const t = rows.reduce(
        (a, r) => ({
            leads: a.leads + r.roi.leads,
            qualified: a.qualified + r.roi.qualified,
            deals_won: a.deals_won + r.roi.deals_won,
            revenue: a.revenue + r.roi.revenue,
            spend: a.spend + r.roi.spend,
        }),
        { leads: 0, qualified: 0, deals_won: 0, revenue: 0, spend: 0 },
    );
    return {
        ...t,
        roi: t.spend > 0 ? (t.revenue - t.spend) / t.spend : null,
        cpl: t.leads > 0 ? t.spend / t.leads : null,
    };
}

export const crmCampaignService = {
    async roiReport(status?: CampaignStatus | ''): Promise<CampaignRoiRow[]> {
        return normalizeRoiList(await crmApiClient.get<any>('/crm-campaigns/roi', status ? { status } : {}));
    },
    async campaignRoi(id: string): Promise<CampaignRoiRow> {
        return normalizeRoiRow(await crmApiClient.get<any>(`/crm-campaigns/${encodeURIComponent(id)}/roi`));
    },
};
