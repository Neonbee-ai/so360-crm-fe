import React from 'react';
import { Alert, Button } from '@so360/design-system';
import type { DuplicateLeadInfo } from '../../services/leadDedupService';

interface Props {
    duplicate: DuplicateLeadInfo;
    onCancel: () => void;
    /** Why it matched, e.g. "phone number". Defaults to the plain "already exists" copy. */
    matchedOn?: string;
    /** Present only when the org's rule is "warn": resends the create with confirm_duplicates. */
    onCreateAnyway?: () => void;
}

/**
 * Shown when crm-be rejects a create/update with a duplicate 409.
 * One tap opens the existing lead; Cancel backs out. When the org's rule only
 * warns, "Create anyway" is offered too. Never stacks a modal.
 */
export const DuplicateLeadWarning: React.FC<Props> = ({ duplicate, onCancel, matchedOn, onCreateAnyway }) => (
    <div data-testid="duplicate-lead-warning" role="alert">
        <Alert variant={onCreateAnyway || !matchedOn ? 'warning' : 'error'}>
            <div className="space-y-nb-2">
                <p>
                    {matchedOn ? `A lead with the same ${matchedOn} already exists: ` : 'This lead already exists as '}
                    <strong>{duplicate.name}</strong>
                    {duplicate.owner_name ? <> (owned by {duplicate.owner_name})</> : null}.
                </p>
                <div className="flex gap-nb-2 items-center">
                    <a
                        href={`/crm/leads/${duplicate.id}`}
                        className="text-sm font-medium text-primary underline"
                        data-testid="open-existing-lead"
                    >
                        Open existing
                    </a>
                    {onCreateAnyway && (
                        <Button variant="primary" size="sm" type="button" onClick={onCreateAnyway} data-testid="create-anyway">
                            Create anyway
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" type="button" onClick={onCancel}>
                        Cancel
                    </Button>
                </div>
            </div>
        </Alert>
    </div>
);

export default DuplicateLeadWarning;
