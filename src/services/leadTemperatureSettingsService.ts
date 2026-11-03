import { crmApiClient } from './crmService';

/**
 * RE plan E §20 — per-org Hot/Warm/Cold thresholds and factor weights.
 * crm-be has no /v1 prefix.
 *
 *  GET /settings/lead-temperature → LeadTemperatureSettings (defaults when unset)
 *  PUT /settings/lead-temperature  body: any subset of
 *      { hot_min, warm_min, weights, source_quality, timeline }
 *
 * Saving re-bands every lead of the org server-side. The source-quality and
 * timeline point maps are API-editable; this UI edits thresholds + weights.
 */
export type TemperatureFactorKey = 'budget_fit' | 'timeline' | 'engagement' | 'source_quality';

export const TEMPERATURE_FACTORS: ReadonlyArray<{ key: TemperatureFactorKey; label: string; hint: string }> = [
    { key: 'budget_fit', label: 'Budget fit', hint: 'Stated budget vs. prices of available units' },
    { key: 'timeline', label: 'Timeline', hint: 'How soon the lead intends to buy' },
    { key: 'engagement', label: 'Engagement', hint: 'Days since the last human contact' },
    { key: 'source_quality', label: 'Source quality', hint: 'Where the lead came from' },
];

export interface LeadTemperatureSettings {
    hot_min: number;
    warm_min: number;
    weights: Record<TemperatureFactorKey, number>;
    source_quality: Record<string, number>;
    timeline: Record<string, number>;
    /** True when the org has saved nothing and the built-in defaults apply. */
    is_default: boolean;
}

export const DEFAULT_LEAD_TEMPERATURE_SETTINGS: LeadTemperatureSettings = {
    hot_min: 70,
    warm_min: 40,
    weights: { budget_fit: 30, timeline: 30, engagement: 25, source_quality: 15 },
    source_quality: {},
    timeline: {},
    is_default: true,
};

const num = (v: unknown, fallback: number): number => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

const pointsMap = (raw: unknown): Record<string, number> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
        const n = num(v, Number.NaN);
        if (Number.isFinite(n)) out[k] = n;
    }
    return out;
};

/** Fills gaps with the contract defaults; never throws. */
export function normalizeLeadTemperatureSettings(raw: any): LeadTemperatureSettings {
    const d = DEFAULT_LEAD_TEMPERATURE_SETTINGS;
    if (!raw || typeof raw !== 'object') return { ...d, weights: { ...d.weights } };
    const w = raw.weights && typeof raw.weights === 'object' ? raw.weights : {};
    return {
        hot_min: num(raw.hot_min, d.hot_min),
        warm_min: num(raw.warm_min, d.warm_min),
        weights: {
            budget_fit: num(w.budget_fit, d.weights.budget_fit),
            timeline: num(w.timeline, d.weights.timeline),
            engagement: num(w.engagement, d.weights.engagement),
            source_quality: num(w.source_quality, d.weights.source_quality),
        },
        source_quality: pointsMap(raw.source_quality),
        timeline: pointsMap(raw.timeline),
        is_default: raw.is_default === true,
    };
}

const inRange = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;

/** Mirrors the crm-be validation. First problem as a sentence, or null. */
export function validateLeadTemperatureSettings(s: LeadTemperatureSettings): string | null {
    if (!inRange(s.hot_min)) return 'Hot threshold must be between 0 and 100.';
    if (!inRange(s.warm_min)) return 'Warm threshold must be between 0 and 100.';
    if (s.hot_min <= s.warm_min) return 'Hot threshold must be greater than the Warm threshold.';
    for (const f of TEMPERATURE_FACTORS) {
        if (!inRange(s.weights[f.key])) return `${f.label} weight must be between 0 and 100.`;
    }
    const total = TEMPERATURE_FACTORS.reduce((a, f) => a + s.weights[f.key], 0);
    if (total <= 0) return 'At least one weight must be above 0.';
    return null;
}

/** PUT body: only what this UI edits — the point maps stay as stored. */
export function toLeadTemperatureBody(s: LeadTemperatureSettings) {
    return { hot_min: s.hot_min, warm_min: s.warm_min, weights: { ...s.weights } };
}

export const leadTemperatureSettingsService = {
    async get(): Promise<LeadTemperatureSettings> {
        return normalizeLeadTemperatureSettings(await crmApiClient.get<any>('/settings/lead-temperature'));
    },
    async save(s: LeadTemperatureSettings): Promise<LeadTemperatureSettings> {
        return normalizeLeadTemperatureSettings(
            await crmApiClient.put<any>('/settings/lead-temperature', toLeadTemperatureBody(s)),
        );
    },
};
