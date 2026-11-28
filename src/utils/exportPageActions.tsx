import React from 'react';
import { Download } from 'lucide-react';
import { toast, type PageAction } from '@so360/design-system';
import { EXPORT_FORMATS, EXPORT_FORMAT_LABELS, type ExportFormat } from '../services/exportService';
import { describeApiError } from './apiErrorMessage';

/**
 * Title-area v2: the old ExportMenu (CSV / Excel / PDF) becomes ⋯ menu items so the page stays on DS slots.
 * Failures surface as a toast (the old menu showed an inline error).
 */
export function exportPageActions(
    label: string,
    onExport: (format: ExportFormat) => Promise<void> | void,
    formats: readonly ExportFormat[] = EXPORT_FORMATS,
): PageAction[] {
    return formats.map((f) => ({
        id: `export-${f}`,
        label: `${label} as ${EXPORT_FORMAT_LABELS[f]}`,
        icon: <Download size={16} aria-hidden="true" />,
        onSelect: () => {
            void Promise.resolve(onExport(f)).catch((e) => toast.error(describeApiError(e, 'Export failed. Please try again.')));
        },
    }));
}
