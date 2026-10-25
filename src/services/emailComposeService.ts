import { crmApiClient } from './crmService';

/**
 * RE G9 — compose a tracked email from a lead / deal / contact via Inbox
 * outbound (crm-be proxies; crm-be has no /v1 prefix).
 *
 *  GET  /email-compose/templates                → Inbox email templates
 *  POST /email-compose/:entityType/:id/preview  → rendered subject/body
 *  POST /email-compose/:entityType/:id/send     → send + timeline activity
 */
export type ComposeEntityType = 'lead' | 'deal' | 'contact';

export const MERGE_FIELDS = [
    'lead_name', 'agent_name', 'project', 'unit', 'price', 'brochure_link',
] as const;

export interface ComposeTemplate {
    id: string;
    name: string;
    subject: string;
}

export interface ComposeEmailInput {
    template_id?: string;
    subject?: string;
    body_html?: string;
    to_email?: string;
}

export interface ComposePreview {
    to_email: string | null;
    to_name: string | null;
    subject: string;
    body_html: string;
    missing_fields: string[];
}

export interface ComposeSendResult {
    success: boolean;
    conversation_id: string | null;
    message_id: string | null;
    tracking_id: string | null;
    activity_id: string | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function normalizeTemplates(raw: unknown): ComposeTemplate[] {
    const rows = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : [];
    return rows
        .filter((r: any) => r && typeof r.id === 'string' && r.id)
        .map((r: any) => ({ id: r.id, name: str(r.name) || str(r.title) || 'Untitled', subject: str(r.subject) }));
}

export function normalizePreview(raw: any): ComposePreview {
    return {
        to_email: str(raw?.to_email) || null,
        to_name: str(raw?.to_name) || null,
        subject: str(raw?.subject),
        body_html: str(raw?.body_html),
        missing_fields: Array.isArray(raw?.missing_fields) ? raw.missing_fields.filter((f: unknown) => typeof f === 'string') : [],
    };
}

/** Only non-empty fields are sent, so the backend's template fallback applies. */
function compact(input: ComposeEmailInput): ComposeEmailInput {
    const out: ComposeEmailInput = {};
    (['template_id', 'subject', 'body_html', 'to_email'] as const).forEach((k) => {
        const v = input[k];
        if (typeof v === 'string' && v.trim()) out[k] = k === 'body_html' ? v : v.trim();
    });
    return out;
}

const target = (type: ComposeEntityType, id: string) =>
    `/email-compose/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

export const emailComposeService = {
    async listTemplates(): Promise<ComposeTemplate[]> {
        return normalizeTemplates(await crmApiClient.get<unknown>('/email-compose/templates'));
    },
    async preview(type: ComposeEntityType, id: string, input: ComposeEmailInput): Promise<ComposePreview> {
        return normalizePreview(await crmApiClient.post<any>(`${target(type, id)}/preview`, compact(input)));
    },
    async send(type: ComposeEntityType, id: string, input: ComposeEmailInput): Promise<ComposeSendResult> {
        const r: any = await crmApiClient.post<any>(`${target(type, id)}/send`, compact(input));
        return {
            success: r?.success === true,
            conversation_id: r?.conversation_id ?? null,
            message_id: r?.message_id ?? null,
            tracking_id: r?.tracking_id ?? null,
            activity_id: r?.activity_id ?? null,
        };
    },
};
