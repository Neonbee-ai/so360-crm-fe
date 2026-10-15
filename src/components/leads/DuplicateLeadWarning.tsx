import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { DuplicateLeadInfo } from '../../services/leadDedupService';
import { Button } from '@so360/design-system';

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
        className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm"
        role="alert"
        data-testid="duplicate-lead-warning"
    >
        <AlertCircle size={18} className="shrink-0" />
        <div className="flex-1 space-y-2">
            <p>
                This lead already exists as <strong className="text-warning">{duplicate.name}</strong>
                {duplicate.owner_name ? <> (owned by {duplicate.owner_name})</> : null}.
            </p>
            <div className="flex gap-2">
                <a
                    href={`/crm/leads/${duplicate.id}`}
                    className="px-3 py-1.5 rounded-lg bg-warning/20 text-warning hover:bg-warning/30 font-medium"
                    data-testid="open-existing-lead"
                >
                    Open existing
                </a>
                <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </div>
    </div>
);

export default DuplicateLeadWarning;
