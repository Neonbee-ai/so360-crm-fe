import React, { useRef } from 'react';
import { FileEdit, Mail, Phone, CalendarPlus, CheckSquare, UploadCloud } from 'lucide-react';

interface Props {
    onAddNote: () => void;
    onSendEmail: () => void;
    onLogCall: () => void;
    onScheduleMeeting: () => void;
    onCreateTask: () => void;
    onUploadDocument: () => void;
    /**
     * Per-action RBAC gates. Each defaults to `true` when omitted so existing
     * callers that haven't wired permissions yet keep their current behavior;
     * Lead Detail passes real `shell.hasPermission(...)` results for all six.
     */
    canAddNote?: boolean;
    canSendEmail?: boolean;
    canLogCall?: boolean;
    canScheduleMeeting?: boolean;
    canCreateTask?: boolean;
    canUploadDocument?: boolean;
}

/** Window, in ms, during which a repeat click on the same action is ignored. */
export const DOUBLE_CLICK_GUARD_MS = 400;

/**
 * Communication quick actions.
 *
 * Each one opens its creation surface *in place* — a modal, or the composer
 * already on the page. None of them changes the route or switches the workspace
 * tab: doing so read as an unexplained page jump, and left the outcome
 * depending on which tab happened to be open already.
 *
 * Rapid repeat clicks are swallowed. Without that, an impatient double click on
 * an action that navigates could fire the handler twice and race two openings
 * against each other.
 */
const QuickActionBar: React.FC<Props> = ({
    onAddNote, onSendEmail, onLogCall, onScheduleMeeting, onCreateTask, onUploadDocument,
    canAddNote = true, canSendEmail = true, canLogCall = true, canScheduleMeeting = true, canCreateTask = true, canUploadDocument = true,
}) => {
    const lastFiredAt = useRef<Record<string, number>>({});

    const guard = (label: string, handler: () => void) => () => {
        const now = Date.now();
        if (now - (lastFiredAt.current[label] ?? 0) < DOUBLE_CLICK_GUARD_MS) return;
        lastFiredAt.current[label] = now;
        handler();
    };

    const actions = [
        { label: 'Add Note', icon: <FileEdit size={13} />, onClick: onAddNote, visible: canAddNote },
        { label: 'Send Email', icon: <Mail size={13} />, onClick: onSendEmail, visible: canSendEmail },
        { label: 'Log Call', icon: <Phone size={13} />, onClick: onLogCall, visible: canLogCall },
        { label: 'Schedule Meeting', icon: <CalendarPlus size={13} />, onClick: onScheduleMeeting, visible: canScheduleMeeting },
        { label: 'Create Task', icon: <CheckSquare size={13} />, onClick: onCreateTask, visible: canCreateTask },
        { label: 'Add Document', icon: <UploadCloud size={13} />, onClick: onUploadDocument, visible: canUploadDocument },
    ].filter(a => a.visible);

    if (actions.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 mb-6">
            {actions.map((a) => (
                <button
                    key={a.label}
                    type="button"
                    onClick={guard(a.label, a.onClick)}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    {a.icon} {a.label}
                </button>
            ))}
        </div>
    );
};

export default QuickActionBar;
