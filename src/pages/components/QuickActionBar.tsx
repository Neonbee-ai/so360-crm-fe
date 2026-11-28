import React, { useRef } from 'react';
import { FileEdit, Mail, Phone, CalendarPlus, CheckSquare, UploadCloud, ChevronDown } from 'lucide-react';
import { Button, Menu, type PageAction } from '@so360/design-system';

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
 * Communication actions, shown as a single header menu.
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

    // One "Log activity" menu in the page header (Comb: page actions live in the header, never a body row).
    return (
        <Menu
            name="Log activity"
            placement="bottom-end"
            trigger={
                <Button variant="secondary" type="button">
                    Log activity <ChevronDown size={14} />
                </Button>
            }
            items={actions.map((a) => ({ label: a.label, icon: a.icon, onSelect: guard(a.label, a.onClick) }))}
        />
    );
};

export default QuickActionBar;

const lastFiredByLabel: Record<string, number> = {};

/**
 * Title-area v2: the same six communication actions as header PageActions (⋯ menu), same RBAC gates and
 * double-click guard as the QuickActionBar menu.
 */
export function buildQuickActions(p: Props): PageAction[] {
    const all = [
        { id: 'add-note', label: 'Add note', icon: <FileEdit size={13} />, onSelect: p.onAddNote, visible: p.canAddNote ?? true },
        { id: 'send-email', label: 'Send email', icon: <Mail size={13} />, onSelect: p.onSendEmail, visible: p.canSendEmail ?? true },
        { id: 'log-call', label: 'Log call', icon: <Phone size={13} />, onSelect: p.onLogCall, visible: p.canLogCall ?? true },
        { id: 'schedule-meeting', label: 'Schedule meeting', icon: <CalendarPlus size={13} />, onSelect: p.onScheduleMeeting, visible: p.canScheduleMeeting ?? true },
        { id: 'create-task', label: 'Create task', icon: <CheckSquare size={13} />, onSelect: p.onCreateTask, visible: p.canCreateTask ?? true },
        { id: 'add-document', label: 'Add document', icon: <UploadCloud size={13} />, onSelect: p.onUploadDocument, visible: p.canUploadDocument ?? true },
    ];
    return all.filter((a) => a.visible).map(({ visible: _v, ...a }) => ({
        ...a,
        onSelect: () => {
            const now = Date.now();
            if (now - (lastFiredByLabel[a.id] ?? 0) < DOUBLE_CLICK_GUARD_MS) return;
            lastFiredByLabel[a.id] = now;
            a.onSelect();
        },
    }));
}
