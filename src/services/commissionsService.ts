import { crmApiClient } from './crmService';

/**
 * RE Phase C — deal commission lines (flag `submodule:crm:commissions`).
 * crm-be has no /v1 prefix.
 *
 *  GET   /deals/:id/commissions                         → lines (own lines only without crm.commission.view)
 *  POST  /deals/:id/commissions/generate                → regenerate pending lines from sales settings
 *  POST  /deals/:id/commissions                         → add a manual line
 *  PATCH /deals/:id/commissions/:lineId                 → amount/percent changes need override_reason
 *  POST  /deals/:id/commissions/:lineId/transition      body { to, note? }
 */
export type CommissionStatus = 'pending' | 'approved' | 'payable' | 'paid' | 'cancelled';
export type ParticipantType = 'agent' | 'team_leader' | 'co_broker' | 'referral' | 'company';

export const PARTICIPANT_LABELS: Record<ParticipantType, string> = {
    agent: 'Agent',
    team_leader: 'Team leader',
    co_broker: 'Co-broker',
    referral: 'Referral',
    company: 'Company',
};

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    payable: 'Payable',
    paid: 'Paid',
    cancelled: 'Cancelled',
};

export interface CommissionAuditEntry {
    at: string | null;
    by: string | null;
    from: string | null;
    to: string | null;
    note: string | null;
}

export interface CommissionLine {
    id: string;
    participant_type: ParticipantType;
    user_id: string | null;
    partner_id: string | null;
    name: string;
    /** null = masked for this caller (no crm.commission.view). */
    basis_amount: number | null;
    percent: number | null;
    amount: number | null;
    vat_amount: number | null;
    status: CommissionStatus;
    override_reason: string | null;
    approved_by: string | null;
    approved_at: string | null;
    paid_at: string | null;
    audit: CommissionAuditEntry[];
}

export interface CommissionLinePatch {
    amount?: number;
    percent?: number;
    override_reason?: string;
}

export interface NewCommissionLine {
    participant_type: ParticipantType;
    name: string;
    user_id?: string;
    partner_id?: string;
    percent?: number;
    amount?: number;
    override_reason?: string;
}

const STATUSES: readonly string[] = Object.keys(COMMISSION_STATUS_LABELS);
const PARTICIPANTS: readonly string[] = Object.keys(PARTICIPANT_LABELS);

const toNum = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

function normalizeAudit(raw: any): CommissionAuditEntry {
    return {
        at: raw?.at ?? null,
        by: raw?.by ?? null,
        from: raw?.from ?? null,
        to: raw?.to ?? null,
        note: raw?.note ?? null,
    };
}

export function normalizeCommissionLine(raw: any, i = 0): CommissionLine {
    return {
        id: String(raw?.id ?? `line-${i}`),
        participant_type: PARTICIPANTS.includes(raw?.participant_type) ? raw.participant_type as ParticipantType : 'agent',
        user_id: raw?.user_id ?? null,
        partner_id: raw?.partner_id ?? null,
        name: String(raw?.name ?? ''),
        basis_amount: toNum(raw?.basis_amount),
        percent: toNum(raw?.percent),
        amount: toNum(raw?.amount),
        vat_amount: toNum(raw?.vat_amount),
        status: STATUSES.includes(raw?.status) ? raw.status as CommissionStatus : 'pending',
        override_reason: raw?.override_reason ?? null,
        approved_by: raw?.approved_by ?? null,
        approved_at: raw?.approved_at ?? null,
        paid_at: raw?.paid_at ?? null,
        audit: Array.isArray(raw?.audit) ? raw.audit.map(normalizeAudit) : [],
    };
}

/** Accepts a bare array or a `{ lines }` / `{ data }` envelope. */
export function normalizeCommissionLines(raw: any): CommissionLine[] {
    const list = Array.isArray(raw) ? raw
        : Array.isArray(raw?.lines) ? raw.lines
            : Array.isArray(raw?.data) ? raw.data : [];
    return list.map(normalizeCommissionLine);
}

/**
 * The only moves the backend accepts:
 *   pending  → approved (approval on) | payable (approval off) | cancelled
 *   approved → payable | cancelled
 *   payable  → paid | cancelled
 *   paid, cancelled → terminal
 */
export function legalTransitions(status: CommissionStatus, approvalRequired: boolean): CommissionStatus[] {
    switch (status) {
        case 'pending': return approvalRequired ? ['approved', 'cancelled'] : ['payable', 'cancelled'];
        case 'approved': return ['payable', 'cancelled'];
        case 'payable': return ['paid', 'cancelled'];
        default: return [];
    }
}

export const TRANSITION_LABELS: Record<CommissionStatus, string> = {
    pending: 'Reopen',
    approved: 'Approve',
    payable: 'Mark payable',
    paid: 'Mark paid',
    cancelled: 'Cancel',
};

/** Only pending lines can be re-priced; once approved the amount is locked. */
export const canOverride = (line: CommissionLine): boolean => line.status === 'pending' && line.amount !== null;

export function validateOverride(patch: { amount: number | null; reason: string }, original: CommissionLine): string | null {
    if (patch.amount === null || !Number.isFinite(patch.amount) || patch.amount < 0) return 'Enter an amount of 0 or more.';
    if (patch.amount === original.amount) return 'The amount has not changed.';
    if (!patch.reason.trim()) return 'A reason is required to override a commission.';
    return null;
}

/** "—" when the backend masked the value for this caller. */
export function maskedMoney(v: number | null | undefined, fmt: (n: number) => string): string {
    return v === null || v === undefined ? '—' : fmt(v);
}

const base = (dealId: string) => `/deals/${encodeURIComponent(dealId)}/commissions`;

export const commissionsService = {
    async list(dealId: string): Promise<CommissionLine[]> {
        return normalizeCommissionLines(await crmApiClient.get<any>(base(dealId)));
    },
    async generate(dealId: string): Promise<CommissionLine[]> {
        return normalizeCommissionLines(await crmApiClient.post<any>(`${base(dealId)}/generate`, {}));
    },
    async add(dealId: string, line: NewCommissionLine): Promise<void> {
        await crmApiClient.post<any>(base(dealId), line);
    },
    async update(dealId: string, lineId: string, patch: CommissionLinePatch): Promise<void> {
        await crmApiClient.patch<any>(`${base(dealId)}/${encodeURIComponent(lineId)}`, patch);
    },
    async transition(dealId: string, lineId: string, to: CommissionStatus, note?: string): Promise<void> {
        const body: { to: CommissionStatus; note?: string } = { to };
        if (note && note.trim()) body.note = note.trim();
        await crmApiClient.post<any>(`${base(dealId)}/${encodeURIComponent(lineId)}/transition`, body);
    },
};
