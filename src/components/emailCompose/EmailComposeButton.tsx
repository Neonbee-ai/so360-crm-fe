import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import { RE_FLAGS, useCrmFeatureFlag } from '../../hooks/useCrmFeatureFlag';
import { EmailComposeModal } from './EmailComposeModal';
import type { ComposeEntityType } from '../../services/emailComposeService';

export interface EmailComposeButtonProps {
    entityType: ComposeEntityType;
    entityId: string;
    onSent?: () => void;
}

/**
 * RE G9 — "Compose Email" header action. Renders nothing unless the RE
 * compose flag is on AND activities.create is granted; both fail closed
 * (flags/permissions not yet loaded → hidden), matching crm-be's guards.
 */
export const EmailComposeButton: React.FC<EmailComposeButtonProps> = ({ entityType, entityId, onSent }) => {
    const shell = useShellBridge() as any;
    const flagOn = useCrmFeatureFlag(RE_FLAGS.EMAIL_COMPOSE);
    const allowed = shell?.permissionsLoaded === true && (shell?.hasPermission?.('activities.create') ?? false);
    const [open, setOpen] = useState(false);

    if (!flagOn || !allowed || !entityId) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Compose Email"
                title="Compose a tracked email"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
                <Mail size={14} /> Compose Email
            </button>
            {open && (
                <EmailComposeModal entityType={entityType} entityId={entityId} onClose={() => setOpen(false)} onSent={onSent} />
            )}
        </>
    );
};

export default EmailComposeButton;
