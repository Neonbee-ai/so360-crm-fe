import { crmApiClient } from './crmService';

/**
 * RE Phase C — CRM sales & commission settings (one row per org).
 * crm-be has no /v1 prefix.
 *
 *  GET /sales-settings  → SalesSettings (defaults when the org has no row)
 *  PUT /sales-settings  body SalesSettings
 */
export type EarnTrigger = 'booking' | 'spa_signed' | 'developer_paid';
export type UnitVisibility = 'all' | 'assigned_only';
export type OverrideScope = 'role' | 'user';

export const EARN_TRIGGERS: ReadonlyArray<{ value: EarnTrigger; label: string }> = [
    { value: 'booking', label: 'On booking' },
    { value: 'spa_signed', label: 'On SPA signed' },
    { value: 'developer_paid', label: 'When developer pays' },
];

export interface SalesShareOverride {
    scope: OverrideScope;
    role_key?: string;
    user_id?: string;
    agent_share_percent: number;
    team_leader_override_percent: number;
}

export interface SalesSettings {
    earn_trigger: EarnTrigger;
    approval_required: boolean;
    vat_percent: number;
    default_agent_share_percent: number;
    team_leader_override_percent: number;
    overrides: SalesShareOverride[];
    unit_visibility: UnitVisibility;
}

export const DEFAULT_SALES_SETTINGS: SalesSettings = {
    earn_trigger: 'booking',
    approval_required: true,
    vat_percent: 5,
    default_agent_share_percent: 50,
    team_leader_override_percent: 0,
    overrides: [],
    unit_visibility: 'all',
};

const isEarnTrigger = (v: unknown): v is EarnTrigger =>
    v === 'booking' || v === 'spa_signed' || v === 'developer_paid';
const num = (v: unknown, fallback: number): number => {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

function normalizeOverride(raw: any): SalesShareOverride | null {
    if (!raw || (raw.scope !== 'role' && raw.scope !== 'user')) return null;
    const scope: OverrideScope = raw.scope;
    return {
        scope,
        ...(scope === 'role' ? { role_key: String(raw.role_key ?? '') } : { user_id: String(raw.user_id ?? '') }),
        agent_share_percent: num(raw.agent_share_percent, 0),
        team_leader_override_percent: num(raw.team_leader_override_percent, 0),
    };
}

/** Fills gaps with contract defaults; numeric columns may arrive as strings. */
export function normalizeSalesSettings(raw: any): SalesSettings {
    const d = DEFAULT_SALES_SETTINGS;
    if (!raw || typeof raw !== 'object') return { ...d, overrides: [] };
    return {
        earn_trigger: isEarnTrigger(raw.earn_trigger) ? raw.earn_trigger : d.earn_trigger,
        approval_required: typeof raw.approval_required === 'boolean' ? raw.approval_required : d.approval_required,
        vat_percent: num(raw.vat_percent, d.vat_percent),
        default_agent_share_percent: num(raw.default_agent_share_percent, d.default_agent_share_percent),
        team_leader_override_percent: num(raw.team_leader_override_percent, d.team_leader_override_percent),
        overrides: Array.isArray(raw.overrides)
            ? raw.overrides.map(normalizeOverride).filter((o: SalesShareOverride | null): o is SalesShareOverride => !!o)
            : [],
        unit_visibility: raw.unit_visibility === 'assigned_only' ? 'assigned_only' : 'all',
    };
}

const inPercent = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;

/**
 * Client-side validation mirroring what a sane backend enforces. Returns the
 * first problem as a sentence, or null when the settings can be saved.
 */
export function validateSalesSettings(s: SalesSettings): string | null {
    if (!inPercent(s.vat_percent)) return 'VAT must be between 0 and 100%.';
    if (!inPercent(s.default_agent_share_percent)) return 'Agent share must be between 0 and 100%.';
    if (!inPercent(s.team_leader_override_percent)) return 'Team-leader override must be between 0 and 100%.';
    if (s.default_agent_share_percent + s.team_leader_override_percent > 100) {
        return 'Agent share and team-leader override together cannot exceed 100%.';
    }
    const seen = new Set<string>();
    for (let i = 0; i < s.overrides.length; i++) {
        const o = s.overrides[i];
        const row = `Override ${i + 1}`;
        const key = o.scope === 'role' ? (o.role_key ?? '').trim() : (o.user_id ?? '').trim();
        if (!key) return `${row}: pick a ${o.scope === 'role' ? 'role' : 'user'}.`;
        const dedupe = `${o.scope}:${key}`;
        if (seen.has(dedupe)) return `${row}: this ${o.scope} already has an override.`;
        seen.add(dedupe);
        if (!inPercent(o.agent_share_percent) || !inPercent(o.team_leader_override_percent)) {
            return `${row}: percentages must be between 0 and 100.`;
        }
        if (o.agent_share_percent + o.team_leader_override_percent > 100) {
            return `${row}: agent share and override together cannot exceed 100%.`;
        }
    }
    return null;
}

/** Body sent on PUT: trims keys and drops the field that does not apply to the scope. */
export function toSalesSettingsBody(s: SalesSettings): SalesSettings {
    return {
        ...s,
        overrides: s.overrides.map((o) => o.scope === 'role'
            ? { scope: 'role', role_key: (o.role_key ?? '').trim(), agent_share_percent: o.agent_share_percent, team_leader_override_percent: o.team_leader_override_percent }
            : { scope: 'user', user_id: (o.user_id ?? '').trim(), agent_share_percent: o.agent_share_percent, team_leader_override_percent: o.team_leader_override_percent }),
    };
}

export const salesSettingsService = {
    async get(): Promise<SalesSettings> {
        return normalizeSalesSettings(await crmApiClient.get<any>('/sales-settings'));
    },
    async save(s: SalesSettings): Promise<SalesSettings> {
        return normalizeSalesSettings(await crmApiClient.put<any>('/sales-settings', toSalesSettingsBody(s)));
    },
};
