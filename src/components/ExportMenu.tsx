import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import { Button, Menu } from '@so360/design-system';
import { EXPORT_FORMATS, EXPORT_FORMAT_LABELS, type ExportFormat } from '../services/exportService';
import { describeApiError } from '../utils/apiErrorMessage';

/**
 * RE §48 — may the user export here? Needs the RBAC permission (the API
 * enforces it too) and, when given, an effective feature flag. Both fail
 * closed until the shell has loaded them.
 */
export function useCanExport(permission: string, flagKey?: string): boolean {
    const shell = useShellBridge() as any;
    const allowed = shell?.permissionsLoaded === true && (shell?.hasPermission?.(permission) ?? false);
    if (!allowed) return false;
    if (!flagKey) return true;
    return shell?.effectiveFlagsLoaded !== false && (shell?.isFeatureEnabled?.(flagKey) ?? false);
}

interface ExportMenuProps {
    /** Accessible name, e.g. "Export leads". */
    label: string;
    onExport: (format: ExportFormat) => Promise<void>;
    className?: string;
}

/** Single "Export" button opening a CSV / Excel / PDF menu, with a busy state and an inline error. */
const ExportMenu: React.FC<ExportMenuProps> = ({ label, onExport, className }) => {
    const [busy, setBusy] = useState<ExportFormat | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async (format: ExportFormat) => {
        if (busy) return;
        setBusy(format);
        setError(null);
        try {
            await onExport(format);
        } catch (e) {
            setError(describeApiError(e, 'Export failed. Please try again.'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className={`flex items-center gap-nb-2 ${className ?? ''}`}>
            <Menu
                name="export"
                trigger={
                    <Button variant="secondary" aria-label={label} disabled={busy !== null}>
                        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                        Export
                    </Button>
                }
                items={EXPORT_FORMATS.map((f) => ({
                    label: EXPORT_FORMAT_LABELS[f],
                    onSelect: () => { void run(f); },
                    disabled: busy !== null,
                }))}
            />
            {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
        </div>
    );
};

export default ExportMenu;
