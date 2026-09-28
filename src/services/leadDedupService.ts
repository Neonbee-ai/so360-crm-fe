import { crmApiClient } from './crmService';
import type { Lead } from '../types/crm';

/**
 * Lead de-duplication + merge (A6).
 *
 * Assumed crm-be contracts (no /v1 prefix on crm-be):
 *  - POST /leads and PATCH /leads/:id may reject with
 *    409 { code: 'DUPLICATE_LEAD', existing: { id, name, owner_name } }
 *  - POST /leads/:keepId/merge { merge_id, field_choices } → merged Lead
 *    field_choices maps a field key to the lead id whose value wins.
 */

export interface DuplicateLeadInfo {
    id: string;
    name: string;
    owner_name: string | null;
}

/** Reads a DUPLICATE_LEAD rejection; null for any other error. */
export function parseDuplicateLead(err: unknown): DuplicateLeadInfo | null {
    const e = err as { status?: number; body?: any } | null | undefined;
    const body = e?.body;
    if (!body || body.code !== 'DUPLICATE_LEAD') return null;
    if (e?.status !== undefined && e.status !== 409) return null;
    const existing = body.existing;
    if (!existing || typeof existing.id !== 'string' || !existing.id) return null;
    return {
        id: existing.id,
        name: typeof existing.name === 'string' && existing.name ? existing.name : 'Existing lead',
        owner_name: typeof existing.owner_name === 'string' && existing.owner_name ? existing.owner_name : null,
    };
}

export interface MergeField {
    key: keyof Lead & string;
    label: string;
}

/** Fields the user chooses between when merging two leads. */
export const MERGE_FIELDS: MergeField[] = [
    { key: 'company_name', label: 'Company' },
    { key: 'first_name', label: 'First name' },
    { key: 'last_name', label: 'Last name' },
    { key: 'contact_email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'source', label: 'Source' },
    { key: 'owner', label: 'Owner' },
];

export type FieldChoices = Record<string, string>;

/** Default choices: every field keeps the value of the kept lead. */
export function defaultFieldChoices(keepId: string): FieldChoices {
    return Object.fromEntries(MERGE_FIELDS.map(f => [f.key, keepId]));
}

export function displayFieldValue(lead: Partial<Lead> | null | undefined, key: string): string {
    const v = (lead as any)?.[key];
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'object') return v.name ?? v.full_name ?? '—';
    return String(v);
}

export function leadDisplayName(lead: Partial<Lead> | null | undefined): string {
    if (!lead) return '';
    const person = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || (lead as any).contact_name || '';
    return lead.company_name || person || 'Untitled lead';
}

export const leadDedupService = {
    mergeLeads(keepId: string, mergeId: string, fieldChoices: FieldChoices): Promise<Lead> {
        return crmApiClient.post<Lead>(`/leads/${keepId}/merge`, {
            merge_id: mergeId,
            field_choices: fieldChoices,
        });
    },
};
