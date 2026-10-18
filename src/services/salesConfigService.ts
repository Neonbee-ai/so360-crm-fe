import { crmApiClient } from './crmService';

/**
 * Per-org sales configuration: loss reasons, lead rating labels, duplicate
 * rules, and the deal win/lose actions. crm-be has no /v1 prefix.
 *
 *  GET/POST/PATCH/DELETE /settings/loss-reasons[/:id]
 *  POST/DELETE           /settings/score-categories[/:id]   (GET + PATCH live in crmService)
 *  GET/PUT               /settings/duplicate-rules
 *  POST                  /deals/:id/win | /deals/:id/lose
 */

export const COLOR_TOKENS = ['neutral', 'info', 'success', 'warning', 'danger', 'primary'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export const DUPLICATE_FIELDS = ['email', 'phone', 'company_name'] as const;
export type DuplicateField = (typeof DUPLICATE_FIELDS)[number];
export type DuplicateAction = 'warn' | 'block';

export const DUPLICATE_FIELD_LABELS: Record<DuplicateField, string> = {
    email: 'Email',
    phone: 'Phone',
    company_name: 'Company name',
};

export interface LossReason {
    id: string;
    label: string;
    value?: string;
    requires_competitor?: boolean;
    is_active?: boolean;
    sort_order?: number;
}

export interface RatingCategory {
    id: string;
    label: string;
    min_score: number;
    max_score: number | null;
    color_token?: ColorToken | null;
    is_active?: boolean;
    sort_order?: number;
}

export interface DuplicateRule {
    field: DuplicateField;
    action: DuplicateAction;
    is_active: boolean;
}

export interface WinDealBody {
    won_reason?: string;
    final_value?: number;
    create_project?: boolean;
}

export interface LoseDealBody {
    lost_reason?: string;
    lost_reason_id?: string;
    competitor?: string;
    feedback?: string;
}

const list = <T,>(rows: unknown): T[] => (Array.isArray(rows) ? (rows as T[]) : []);

export const lossReasonsService = {
    list: async (): Promise<LossReason[]> => list<LossReason>(await crmApiClient.get('/settings/loss-reasons')),
    create: (body: { label: string; requires_competitor?: boolean }) =>
        crmApiClient.post<LossReason>('/settings/loss-reasons', body),
    update: (id: string, body: Partial<Pick<LossReason, 'label' | 'requires_competitor' | 'is_active'>>) =>
        crmApiClient.patch<LossReason>(`/settings/loss-reasons/${id}`, body),
    remove: (id: string) => crmApiClient.delete<unknown>(`/settings/loss-reasons/${id}`),
};

export const ratingService = {
    list: async (): Promise<RatingCategory[]> => list<RatingCategory>(await crmApiClient.get('/settings/score-categories')),
    create: (body: { label: string; min_score: number; max_score: number | null; color_token: ColorToken }) =>
        crmApiClient.post<RatingCategory>('/settings/score-categories', body),
    update: (id: string, body: Partial<Omit<RatingCategory, 'id'>>) =>
        crmApiClient.patch<RatingCategory>(`/settings/score-categories/${id}`, body),
    remove: (id: string) => crmApiClient.delete<unknown>(`/settings/score-categories/${id}`),
};

export const duplicateRulesService = {
    get: async (): Promise<DuplicateRule[]> => list<DuplicateRule>(await crmApiClient.get('/settings/duplicate-rules')),
    put: async (rules: DuplicateRule[]): Promise<DuplicateRule[]> =>
        list<DuplicateRule>(await crmApiClient.put('/settings/duplicate-rules', { rules })),
};

export const dealCloseService = {
    win: (dealId: string, body: WinDealBody) => crmApiClient.post<unknown>(`/deals/${dealId}/win`, body),
    lose: (dealId: string, body: LoseDealBody) => crmApiClient.post<unknown>(`/deals/${dealId}/lose`, body),
};

/** Stage kind from an explicit type, falling back to the stage name. */
export function stageKind(stage: { name?: string; type?: string } | undefined | null): 'won' | 'lost' | 'open' {
    const type = stage?.type?.toUpperCase();
    if (type === 'WON') return 'won';
    if (type === 'LOST') return 'lost';
    const name = (stage?.name ?? '').toLowerCase();
    if (name.includes('won')) return 'won';
    if (name.includes('lost')) return 'lost';
    return 'open';
}

/** Which rating band a score falls in (highest min wins; max null = open). */
export function ratingForScore(bands: RatingCategory[], score: number | null | undefined): RatingCategory | null {
    if (score == null) return null;
    const hit = bands
        .filter((b) => b.is_active !== false && score >= b.min_score && (b.max_score == null || score <= b.max_score))
        .sort((a, b) => b.min_score - a.min_score);
    return hit[0] ?? null;
}

export type QuoteApprovalTrigger = 'submit' | 'send' | 'both';

export interface QuoteApprovalSettings {
    enabled: boolean;
    discount_percent_above: number | null;
    total_above: number | null;
    margin_percent_below: number | null;
    approver_role: string | null;
    approver_user_ids: string[];
    apply_on: QuoteApprovalTrigger;
}

export interface QuoteApprovalReason {
    rule: 'discount' | 'total' | 'margin';
    actual: number;
    threshold: number;
}

export const DEFAULT_QUOTE_APPROVAL: QuoteApprovalSettings = {
    enabled: false,
    discount_percent_above: null,
    total_above: null,
    margin_percent_below: null,
    approver_role: null,
    approver_user_ids: [],
    apply_on: 'both',
};

/** GET/PUT /settings/quote-approval; GET /quotes/:id/approval-check?trigger= */
export const quoteApprovalService = {
    get: async (): Promise<QuoteApprovalSettings> => ({ ...DEFAULT_QUOTE_APPROVAL, ...((await crmApiClient.get('/settings/quote-approval')) as Partial<QuoteApprovalSettings> | null) }),
    put: (body: QuoteApprovalSettings) => crmApiClient.put<QuoteApprovalSettings>('/settings/quote-approval', body),
    check: (quoteId: string, trigger: 'submit' | 'send') =>
        crmApiClient.get<{ required: boolean; reasons: QuoteApprovalReason[] }>(`/quotes/${quoteId}/approval-check?trigger=${trigger}`),
};

export interface TaskReminderSettings { enabled: boolean; default_offset_minutes: number }

/** GET/PUT /settings/task-reminders */
export const taskReminderService = {
    get: async (): Promise<TaskReminderSettings> => ({ enabled: true, default_offset_minutes: 30, ...((await crmApiClient.get('/settings/task-reminders')) as Partial<TaskReminderSettings> | null) }),
    put: (body: TaskReminderSettings) => crmApiClient.put<TaskReminderSettings>('/settings/task-reminders', body),
};

export const describeReason = (r: QuoteApprovalReason): string =>
    r.rule === 'discount' ? `Discount ${r.actual}% exceeds ${r.threshold}%`
        : r.rule === 'total' ? `Total ${r.actual} exceeds ${r.threshold}`
            : `Margin ${r.actual}% is below ${r.threshold}%`;
