import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { DuplicateLeadInfo } from '../../services/leadDedupService';

interface Props {
    duplicate: DuplicateLeadInfo;
    onCancel: () => void;
}

/**
 * Shown when crm-be rejects a create/update with 409 DUPLICATE_LEAD.
 * One tap opens the existing lead; Cancel backs out. Never stacks a modal.
 */
export const DuplicateLeadWarning: React.FC<Props> = ({ duplicate, onCancel }) => (
    <div
        className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm"
        role="alert"
        data-testid="duplicate-lead-warning"
    >
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1 space-y-2">
            <p>
                This lead already exists as <strong className="text-amber-300">{duplicate.name}</strong>
                {duplicate.owner_name ? <> (owned by {duplicate.owner_name})</> : null}.
            </p>
            <div className="flex gap-2">
                <a
                    href={`/crm/leads/${duplicate.id}`}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 font-medium"
                    data-testid="open-existing-lead"
                >
                    Open existing
                </a>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 font-medium"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
);

export default DuplicateLeadWarning;
