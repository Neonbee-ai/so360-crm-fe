import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
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
    /** Accessible name, e.g. "Export leads". Also prefixes each format button. */
    label: string;
    onExport: (format: ExportFormat) => Promise<void>;
    className?: string;
}

/** CSV / Excel / PDF download buttons with a busy state and an inline error. */
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
        <div className={`flex flex-col items-end gap-1 ${className ?? ''}`}>
            <div role="group" aria-label={label} className="flex items-center gap-1">
                <Download size={14} className="text-slate-500" aria-hidden="true" />
                {EXPORT_FORMATS.map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => { void run(f); }}
                        disabled={busy !== null}
                        aria-label={`${label} as ${EXPORT_FORMAT_LABELS[f]}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                    >
                        {busy === f ? <Loader2 size={12} className="animate-spin" /> : null}
                        {EXPORT_FORMAT_LABELS[f]}
                    </button>
                ))}
            </div>
            {error ? <p role="alert" className="text-[11px] font-bold text-rose-300">{error}</p> : null}
        </div>
    );
};

export default ExportMenu;
