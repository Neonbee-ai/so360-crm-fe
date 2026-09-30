import { leadsApi, dealsApi, partnersApi } from '../services/crmService';
import type { CrmDataLayerEntity, DlSaveResult } from './crmDataLayer';

/**
 * Class B save path (spec L2: "Who writes: the module").
 *
 * Custom-field values live in the entity row's own `custom_fields` JSONB and are
 * written through the NATIVE CRM API (PATCH /leads|/deals|/partners/:id), never
 * through Core / datasetsClient. Only the CHANGED keys are sent, plus the
 * optimistic-concurrency `version` (the row's `custom_fields_version`); the
 * backend merges them into the stored object (a null value removes a key).
 *
 * Errors:
 *  - 409 DATASET_VERSION_CONFLICT → `{ ok:false, conflict:true }` so the Shell's
 *    CustomFieldsPanel shows its conflict banner and asks the host to reload.
 *  - 400 DATASET_FIELD_* (and any other failure) → `{ ok:false, error }` with
 *    the backend message verbatim.
 *
 * Leads: FE `lead.custom_fields` is the legacy meta_data mapping, so the Class B
 * values are read from `lead.class_b_custom_fields` and sent raw via leadsApi
 * (crmService.updateLead would rewrite custom_fields → meta_data).
 */

export const VERSION_CONFLICT_CODE = 'DATASET_VERSION_CONFLICT';

export function currentClassBValues(entity: CrmDataLayerEntity, record: Record<string, any> | null | undefined): Record<string, unknown> {
    if (!record) return {};
    const raw = entity === 'crm.lead' ? record.class_b_custom_fields : record.custom_fields;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
}

export function classBRecordView(entity: CrmDataLayerEntity, record: Record<string, any> | null | undefined): Record<string, unknown> | null {
    if (!record) return null;
    return { ...record, custom_fields: currentClassBValues(entity, record) };
}

/** Integer `custom_fields_version`, or null when the row does not carry it. */
export function classBVersionOf(record: Record<string, any> | null | undefined): number | null {
    const v = record?.custom_fields_version;
    return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

/**
 * Concurrency token handed to the Shell `version` prop: the row's
 * `custom_fields_version`, falling back to `updated_at` when the column is absent.
 */
export function recordVersion(record: Record<string, any> | null | undefined): number | string | null {
    if (!record) return null;
    return classBVersionOf(record) ?? record.updated_at ?? null;
}

/**
 * The version to put in the PATCH body. Only an integer row version is sent —
 * an `updated_at` fallback is not a `custom_fields_version`, and the backend
 * skips the check when the row has no version column anyway.
 */
export function wireVersion(version: number | string | null | undefined): number | undefined {
    if (typeof version === 'number' && Number.isInteger(version)) return version;
    if (typeof version === 'string' && /^\d+$/.test(version)) return Number(version);
    return undefined;
}

function errorCodeOf(e: any): string | undefined {
    const b = e?.body ?? e?.response?.data;
    const code = e?.code ?? b?.code ?? b?.error;
    return typeof code === 'string' ? code : undefined;
}

function statusOf(e: any): number | undefined {
    const s = e?.status ?? e?.statusCode ?? e?.response?.status;
    return typeof s === 'number' ? s : undefined;
}

export function isVersionConflict(e: unknown): boolean {
    return statusOf(e) === 409 || errorCodeOf(e) === VERSION_CONFLICT_CODE;
}

function messageOf(e: any): string {
    const b = e?.body ?? e?.response?.data;
    const bm = Array.isArray(b?.message) ? b.message.join('; ') : b?.message;
    if (typeof bm === 'string' && bm.trim()) return bm;
    if (typeof e?.message === 'string' && e.message.trim()) return e.message;
    return 'Failed to save custom fields';
}

/** Local mirror of the backend merge (shallow; null removes the key). */
function mergeLocal(current: Record<string, unknown>, changed: Record<string, unknown>): Record<string, unknown> {
    const out = { ...current };
    Object.entries(changed).forEach(([k, v]) => {
        if (v === null) delete out[k];
        else out[k] = v;
    });
    return out;
}

export async function saveClassBCustomFields(
    entity: CrmDataLayerEntity,
    recordId: string,
    current: Record<string, any> | null | undefined,
    changed: Record<string, unknown>,
    version?: number | string | null,
): Promise<DlSaveResult> {
    const v = wireVersion(version !== undefined ? version : recordVersion(current));
    const body: Record<string, unknown> = { custom_fields: { ...changed } };
    if (v !== undefined) body.version = v;
    try {
        let saved: any;
        if (entity === 'crm.lead') saved = await leadsApi.update(recordId, body);
        else if (entity === 'crm.deal') saved = await dealsApi.update(recordId, body);
        else saved = await partnersApi.update(recordId, body);
        const fallback = mergeLocal(currentClassBValues(entity, current), changed);
        const hasSaved = saved && typeof saved === 'object'
            && (entity === 'crm.lead' ? saved.class_b_custom_fields : saved.custom_fields) !== undefined;
        const view = hasSaved
            ? classBRecordView(entity, saved)
            : { ...(current ?? {}), ...(saved && typeof saved === 'object' ? saved : {}), custom_fields: fallback };
        return { ok: true, record: view ?? undefined };
    } catch (e: any) {
        if (isVersionConflict(e)) return { ok: false, conflict: true, error: messageOf(e) };
        return { ok: false, error: messageOf(e) };
    }
}
