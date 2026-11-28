import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import type { PageAction } from '@so360/design-system';
import { RE_FLAGS, useCrmFeatureFlag } from '../../hooks/useCrmFeatureFlag';
import { EmailComposeModal } from './EmailComposeModal';
import type { ComposeEntityType } from '../../services/emailComposeService';

/**
 * Title-area v2 form of EmailComposeButton: a header PageAction plus the modal to render in the page body.
 * Same gating (RE compose flag AND activities.create; fail closed while flags/permissions load).
 */
export function useEmailComposeAction(entityType: ComposeEntityType, entityId: string, onSent?: () => void): { action: PageAction | null; modal: React.ReactNode } {
    const shell = useShellBridge() as any;
    const flagOn = useCrmFeatureFlag(RE_FLAGS.EMAIL_COMPOSE);
    const allowed = shell?.permissionsLoaded === true && (shell?.hasPermission?.('activities.create') ?? false);
    const [open, setOpen] = useState(false);
    if (!flagOn || !allowed || !entityId) return { action: null, modal: null };
    return {
        action: { id: 'compose-email', label: 'Compose email', icon: <Mail size={14} aria-hidden="true" />, onSelect: () => setOpen(true) },
        modal: open ? <EmailComposeModal entityType={entityType} entityId={entityId} onClose={() => setOpen(false)} onSent={onSent} /> : null,
    };
}
