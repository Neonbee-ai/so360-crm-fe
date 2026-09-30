import { useCallback, useMemo } from 'react';
import type { CrmDataLayerState, CrmRecordContext, DlSaveResult } from './crmDataLayer';
import { classBRecordView, recordVersion, saveClassBCustomFields } from './classBSave';

/**
 * Builds the entity + record + version context handed to every Shell renderer
 * on a CRM record page. `onSaved` receives the saved Class B values so the host
 * page can merge them into its own record state (without touching legacy fields).
 */
export function useCrmRecordContext(
    dl: CrmDataLayerState,
    recordId: string | undefined,
    record: Record<string, any> | null | undefined,
    opts: { canEdit: boolean; onChanged?: () => void; onSaved?: (classBValues: Record<string, unknown>) => void },
): CrmRecordContext {
    const { canEdit, onChanged, onSaved } = opts;
    const onSave = useCallback(
        async (changed: Record<string, unknown>): Promise<DlSaveResult> => {
            if (!recordId) return { ok: false, error: 'Record not loaded' };
            const res = await saveClassBCustomFields(dl.entity, recordId, record, changed);
            if (res.ok) onSaved?.(((res.record?.custom_fields as Record<string, unknown>) ?? { ...(changed) }));
            return res;
        },
        [dl.entity, recordId, record, onSaved],
    );
    return useMemo(
        () => ({
            recordId: recordId ?? '',
            record: classBRecordView(dl.entity, record),
            version: recordVersion(record),
            onChanged,
            onSave,
            canEdit,
        }),
        [dl.entity, recordId, record, onChanged, onSave, canEdit],
    );
}
