import { crmApiClient } from './crmService';

/**
 * Property matching (A9, flag `submodule:crm:property_matching`). crm-be has
 * no /v1 prefix.
 *
 *  GET /leads/:id/matching-units?limit=  → MatchingUnit[] (best score first)
 *  GET /deals/:id/matching-units?limit=  → same, via the deal's lead ([] when none)
 *
 * Only available, active units are returned; limit is 1–100 (crm-be default 20).
 */
export interface MatchingUnit {
    item_id: string;
    unit_number: string | null;
    project: string | null;
    tower: string | null;
    bedrooms: number | null;
    area_sqft: number | null;
    price: number | null;
    /** 0–100 */
    score: number;
    reasons: string[];
}

export type MatchingEntity = 'lead' | 'deal';

export const DEFAULT_MATCH_LIMIT = 10;

const path = (entity: MatchingEntity, id: string) =>
    `/${entity === 'lead' ? 'leads' : 'deals'}/${encodeURIComponent(id)}/matching-units`;

async function fetchMatches(entity: MatchingEntity, id: string, limit = DEFAULT_MATCH_LIMIT): Promise<MatchingUnit[]> {
    const clamped = Math.min(100, Math.max(1, Math.floor(limit)));
    const data = await crmApiClient.get<MatchingUnit[]>(path(entity, id), { limit: clamped });
    return Array.isArray(data) ? data : [];
}

/** The name a unit is attached under: "A-101 · Palm Heights" (falls back to the id). */
export function unitLabel(u: Pick<MatchingUnit, 'unit_number' | 'project' | 'item_id'>): string {
    const parts = [u.unit_number, u.project].filter((p): p is string => !!p && !!p.trim());
    return parts.length ? parts.join(' · ') : u.item_id;
}

/** Plain-text summary copied by Share, one fact per line. */
export function unitShareText(u: MatchingUnit, formatPrice: (n: number) => string): string {
    const lines = [
        `Unit ${u.unit_number ?? u.item_id}`,
        [u.project, u.tower ? `Tower ${u.tower}` : null].filter(Boolean).join(', '),
        [u.bedrooms != null ? `${u.bedrooms} BR` : null, u.area_sqft != null ? `${u.area_sqft} sq ft` : null].filter(Boolean).join(' · '),
        u.price != null ? `Price: ${formatPrice(u.price)}` : '',
    ];
    return lines.filter((l) => l.trim()).join('\n');
}

export const matchingUnitsService = {
    forLead: (leadId: string, limit?: number) => fetchMatches('lead', leadId, limit),
    forDeal: (dealId: string, limit?: number) => fetchMatches('deal', dealId, limit),
    for: (entity: MatchingEntity, id: string, limit?: number) => fetchMatches(entity, id, limit),
};
