import { crmApiClient, crmNeuraClient, crmMarketingClient } from './crmService';

/**
 * Ideal Customer Profiles (LinkedIn fit scoring). crm-be has no /v1 prefix.
 *
 *  GET    /linkedin-sync/icps          -> active ICPs with criteria
 *  POST   /linkedin-sync/icps          -> create (criteria inline)
 *  PUT    /linkedin-sync/icps/:id      -> update (criteria, when sent, REPLACE the existing set)
 *  DELETE /linkedin-sync/icps/:id      -> archive
 *  POST   {neura}/linkedin-ai/draft-icp {description,name?} -> draft ICP
 */

export type IcpCategory = 'role' | 'company' | 'industry' | 'location' | 'headline_keywords' | 'about_keywords';

export const ICP_CATEGORIES: { value: IcpCategory; label: string }[] = [
    { value: 'role', label: 'Job title' },
    { value: 'company', label: 'Company' },
    { value: 'industry', label: 'Industry' },
    { value: 'location', label: 'Location' },
    { value: 'headline_keywords', label: 'Headline keywords' },
    { value: 'about_keywords', label: 'About keywords' },
];

export const DEFAULT_MIN_SCORE = 70;

export interface IcpCriterion {
    id?: string;
    category: IcpCategory | string;
    label: string;
    weight: number;
    match_config: { keywords: string[] };
    is_positive: boolean;
}

export interface Icp {
    id: string;
    name: string;
    description?: string | null;
    target_persona?: string | null;
    is_default: boolean;
    status?: string;
    auto_audience_id?: string | null;
    auto_segment_min_score?: number | null;
    icp_criteria?: IcpCriterion[];
}

export interface IcpFormValues {
    name: string;
    description: string;
    target_persona: string;
    is_default: boolean;
    criteria: IcpCriterion[];
    auto_audience_id: string | null;
    auto_segment_min_score: number | null;
}

export interface IcpDraft {
    name?: string;
    description?: string;
    target_persona?: string;
    criteria?: Partial<IcpCriterion>[];
}

export const emptyCriterion = (): IcpCriterion => ({
    category: 'role', label: '', weight: 50, match_config: { keywords: [] }, is_positive: true,
});

export const emptyIcpForm = (): IcpFormValues => ({
    name: '', description: '', target_persona: '', is_default: false,
    criteria: [emptyCriterion()], auto_audience_id: null, auto_segment_min_score: DEFAULT_MIN_SCORE,
});

export const categoryLabel = (c: string): string => ICP_CATEGORIES.find((x) => x.value === c)?.label ?? c;

const clampWeight = (n: unknown): number => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(100, Math.max(1, v)) : 50;
};

const normaliseCriterion = (c: Partial<IcpCriterion>): IcpCriterion => ({
    ...(c.id ? { id: c.id } : {}),
    category: c.category && ICP_CATEGORIES.some((x) => x.value === c.category) ? c.category : 'role',
    label: String(c.label ?? ''),
    weight: clampWeight(c.weight),
    match_config: { keywords: Array.isArray(c.match_config?.keywords) ? c.match_config!.keywords.map(String) : [] },
    is_positive: c.is_positive !== false,
});

/** Saved ICP -> form values (edit prefill). */
export function icpToForm(icp: Icp): IcpFormValues {
    return {
        name: icp.name ?? '',
        description: icp.description ?? '',
        target_persona: icp.target_persona ?? '',
        is_default: !!icp.is_default,
        criteria: (icp.icp_criteria ?? []).map(normaliseCriterion),
        auto_audience_id: icp.auto_audience_id ?? null,
        auto_segment_min_score: icp.auto_audience_id ? (icp.auto_segment_min_score ?? DEFAULT_MIN_SCORE) : (icp.auto_segment_min_score ?? DEFAULT_MIN_SCORE),
    };
}

/** Neura draft -> form values merged over the current ones (user reviews before saving). */
export function applyDraft(current: IcpFormValues, draft: IcpDraft): IcpFormValues {
    const criteria = (draft.criteria ?? []).map(normaliseCriterion);
    return {
        ...current,
        name: draft.name || current.name,
        description: draft.description ?? current.description,
        target_persona: draft.target_persona ?? current.target_persona,
        criteria: criteria.length ? criteria : current.criteria,
    };
}

export interface IcpErrors { name?: string; criteria?: string; weights?: string; }

export function validateIcp(v: IcpFormValues): IcpErrors {
    const e: IcpErrors = {};
    if (!v.name.trim()) e.name = 'Name is required';
    if (v.criteria.length < 1) e.criteria = 'Add at least one criterion';
    else if (v.criteria.some((c) => !c.label.trim())) e.criteria = 'Every criterion needs a label';
    if (v.criteria.some((c) => !Number.isFinite(c.weight) || c.weight < 1 || c.weight > 100)) {
        e.weights = 'Weight must be between 1 and 100';
    }
    return e;
}

/** Form values -> API body. Auto-list fields are sent only as a pair, score clamped 1..100. */
export function toIcpBody(v: IcpFormValues) {
    const hasAudience = !!v.auto_audience_id;
    const score = v.auto_segment_min_score == null ? DEFAULT_MIN_SCORE : Math.min(100, Math.max(1, Math.round(v.auto_segment_min_score)));
    return {
        name: v.name.trim(),
        description: v.description.trim() || undefined,
        target_persona: v.target_persona.trim() || undefined,
        is_default: v.is_default,
        auto_audience_id: hasAudience ? v.auto_audience_id : null,
        auto_segment_min_score: hasAudience ? score : null,
        criteria: v.criteria.map((c) => ({
            category: c.category,
            label: c.label.trim(),
            weight: c.weight,
            match_config: { keywords: c.match_config.keywords },
            is_positive: c.is_positive,
        })),
    };
}

export const icpService = {
    list: async (): Promise<Icp[]> => {
        const r = await crmApiClient.get<Icp[]>('/linkedin-sync/icps');
        return Array.isArray(r) ? r : [];
    },
    create: (v: IcpFormValues) => crmApiClient.post<Icp>('/linkedin-sync/icps', toIcpBody(v)),
    update: (id: string, v: IcpFormValues) => crmApiClient.put<Icp>(`/linkedin-sync/icps/${id}`, toIcpBody(v)),
    setDefault: (id: string) => crmApiClient.put<Icp>(`/linkedin-sync/icps/${id}`, { is_default: true }),
    archive: (id: string) => crmApiClient.delete<unknown>(`/linkedin-sync/icps/${id}`),
    /** Marketing audiences for the auto-list picker (marketing-be GET /v1/marketing/audiences). */
    audiences: async (): Promise<{ id: string; name: string }[]> => {
        const r = await crmMarketingClient.get<unknown>('/v1/marketing/audiences');
        const rows = Array.isArray(r) ? r : (r as any)?.data ?? (r as any)?.items;
        return Array.isArray(rows) ? rows : [];
    },
    draft: (description: string, name?: string) =>
        crmNeuraClient.post<IcpDraft>('/linkedin-ai/draft-icp', { description, ...(name?.trim() ? { name: name.trim() } : {}) }),
};
