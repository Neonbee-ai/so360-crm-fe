import { leadsApi, dealsApi, partnersApi } from '../services/crmService';
import type { CrmDataLayerEntity, DlSaveResult } from './crmDataLayer';

/**
 * Class B save path (spec L2: "Who writes: the module").
 *
 * Custom-field values live in the entity row's own `custom_fields` JSONB and are
 * written through the NATIVE CRM API (PATCH /leads|/deals|/partners/:id), never
 * through datasetsClient. Changed keys are merged over the current values so a
 * renderer that saves one field never drops the others.
 *
 * Leads: FE `lead.custom_fields` is the legacy meta_data mapping, so the Class B
 * values are read from `lead.class_b_custom_fields` and sent raw via leadsApi
 * (crmService.updateLead would rewrite custom_fields → meta_data).
 */

export function currentClassBValues(entity: CrmDataLayerEntity, record: Record<string, any> | null | undefined): Record<string, unknown> {
    if (!record) return {};
    const raw = entity === 'crm.lead' ? record.class_b_custom_fields : record.custom_fields;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
}

export function classBRecordView(entity: CrmDataLayerEntity, record: Record<string, any> | null | undefined): Record<string, unknown> | null {
    if (!record) return null;
    return { ...record, custom_fields: currentClassBValues(entity, record) };
}

export function recordVersion(record: Record<string, any> | null | undefined): number | string | null {
    if (!record) return null;
    return record.version ?? record.updated_at ?? null;
}

export async function saveClassBCustomFields(
    entity: CrmDataLayerEntity,
    recordId: string,
    current: Record<string, any> | null | undefined,
    changed: Record<string, unknown>,
): Promise<DlSaveResult> {
    const custom_fields = { ...currentClassBValues(entity, current), ...changed };
    try {
        let saved: any;
        if (entity === 'crm.lead') saved = await leadsApi.update(recordId, { custom_fields });
        else if (entity === 'crm.deal') saved = await dealsApi.update(recordId, { custom_fields });
        else saved = await partnersApi.update(recordId, { custom_fields });
        return { ok: true, record: classBRecordView(entity, saved) ?? undefined };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'Failed to save custom fields' };
    }
}
