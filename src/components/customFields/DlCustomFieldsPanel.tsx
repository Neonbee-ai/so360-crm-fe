import React, { useMemo } from 'react';
import { CustomFieldsPanel, Banner } from '@so360/design-system';
import { useDatasetSchema } from '@so360/shell-context';

/** Feature flag that moves CRM custom fields onto the Core data layer. */
export const DL_CUSTOM_FIELDS_FLAG = 'submodule:crm:dl_custom_fields';

export type DlEntity = 'lead' | 'deal' | 'partner';

/** Core dataset code for a CRM entity (partners are Core's `core.partner`). */
export const datasetCodeFor = (entity: DlEntity) => (entity === 'partner' ? 'core.partner' : `crm.${entity}`);

export interface DlCustomFieldsPanelProps {
    entity: DlEntity;
    /** Omitted in create mode (no record yet). */
    recordId?: string;
    /** Values keyed by field_key (the record's `custom_fields` column). */
    values: Record<string, unknown> | null | undefined;
    /** `custom_fields_version` read with the record (optimistic concurrency). */
    version: number | null | undefined;
    /** Persist changed values + version; throws an Error carrying `.status`. */
    save?: (customFields: Record<string, unknown>, version: number | null) => Promise<unknown>;
    /** Refetch the record (after a save, or to resolve a 409). */
    reload?: () => void | Promise<unknown>;
    canEdit?: boolean;
    /** Controlled create form: inputs always editable, host sends `values` in its create body. */
    mode?: 'create' | 'edit';
    onValuesChange?: (next: Record<string, unknown>) => void;
}

export const VALIDATION_UNAVAILABLE_MSG = 'Custom field validation is unavailable right now. Please try again.';

/**
 * Comb custom-fields card for a CRM lead or deal, bound to Core dataset
 * `crm.lead` / `crm.deal`. 409 -> the design-system panel shows its conflict
 * banner and `reload` refetches; 503 -> "validation unavailable, try again".
 */
export function DlCustomFieldsPanel({ entity, recordId, values, version, save, reload, canEdit = true, mode, onValuesChange }: DlCustomFieldsPanelProps) {
    const { fields, isLoading, error } = useDatasetSchema(datasetCodeFor(entity));
    const dlFields = useMemo(() => (fields as any[]).filter((f) => !f.is_system), [fields]);
    const record = useMemo(
        () => ({ id: recordId ?? null, custom_fields: values ?? {}, version: version ?? null }) as any,
        [recordId, values, version],
    );

    if (isLoading) return <p className="text-nb-caption text-fg-subtle" data-testid="dl-cf-loading">Loading custom fields…</p>;
    if (error) {
        return (
            <Banner variant="danger" data-testid="dl-cf-schema-error">
                Could not load custom fields. Reload the page to try again.
            </Banner>
        );
    }

    return (
        <CustomFieldsPanel
            title="Custom fields"
            fields={dlFields}
            record={record}
            valuesKey="custom_fields"
            version={version ?? null}
            canEdit={canEdit}
            {...(mode ? { mode, values: values ?? {}, onValuesChange } : {})}
            onReloadRequest={() => { void reload?.(); }}
            onSaved={() => { void reload?.(); }}
            onSave={async (changed, ver) => {
                try {
                    await save?.(changed, typeof ver === 'number' ? ver : ver == null ? null : Number(ver));
                    return { ok: true as const };
                } catch (e: any) {
                    const status = e?.status ?? e?.statusCode;
                    if (status === 409) return { ok: false as const, conflict: true as const, error: e };
                    if (status === 503) return { ok: false as const, error: new Error(VALIDATION_UNAVAILABLE_MSG) };
                    return { ok: false as const, error: e };
                }
            }}
        />
    );
}

export default DlCustomFieldsPanel;
