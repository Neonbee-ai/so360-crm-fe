import React, { useCallback, useEffect, useState } from 'react';
import { Banner } from '@so360/design-system';
import { partnersApi } from '../../services/crmService';
import { DlCustomFieldsPanel } from './DlCustomFieldsPanel';

/**
 * Data Layer custom fields for a CRM partner, bound to Core dataset
 * `core.partner`. Values live on the Core partner master row, reached through
 * the CRM partner's `core_partner_id`. Writes use Core's partner update
 * (PATCH /v1/partners/:id with custom_fields + version). A partner without a
 * Core link has nothing to store against, so the panel renders read-only notice.
 */
export function PartnerDlCustomFields({ corePartnerId }: { corePartnerId?: string | null }) {
    const [row, setRow] = useState<any>(null);
    const [failed, setFailed] = useState(false);

    const load = useCallback(async () => {
        if (!corePartnerId) return;
        try {
            setRow(await partnersApi.getCore(corePartnerId));
            setFailed(false);
        } catch {
            setFailed(true);
        }
    }, [corePartnerId]);

    useEffect(() => { void load(); }, [load]);

    if (!corePartnerId) {
        return <p className="text-nb-caption text-fg-subtle" data-testid="partner-dl-cf-unlinked">Custom fields are available once this partner is linked to the partner master.</p>;
    }
    if (failed) {
        return <Banner variant="danger" data-testid="partner-dl-cf-load-error">Could not load custom fields. Reload the page to try again.</Banner>;
    }
    if (!row) return <p className="text-nb-caption text-fg-subtle" data-testid="partner-dl-cf-loading">Loading custom fields…</p>;

    return (
        <DlCustomFieldsPanel
            entity="partner"
            recordId={corePartnerId}
            values={row.custom_fields}
            version={row.custom_fields_version}
            save={(values, version) => partnersApi.updateCoreCustomFields(corePartnerId, values, version)}
            reload={load}
        />
    );
}

export default PartnerDlCustomFields;
