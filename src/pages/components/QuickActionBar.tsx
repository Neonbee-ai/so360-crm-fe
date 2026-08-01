import React from 'react';
import { FileEdit, Mail, Phone, CalendarPlus, CheckSquare, UploadCloud } from 'lucide-react';

interface Props {
    onAddNote: () => void;
    onSendEmail: () => void;
    onLogCall: () => void;
    onScheduleMeeting: () => void;
    onCreateTask: () => void;
    onUploadDocument: () => void;
}

/**
 * Task 3 — Communication Quick Action bar. Every action delegates to an
 * existing tab/modal (setActiveTab, TaskModal, etc.) rather than building
 * new creation surfaces — see LeadDetailPage.tsx wiring.
 */
const QuickActionBar: React.FC<Props> = ({ onAddNote, onSendEmail, onLogCall, onScheduleMeeting, onCreateTask, onUploadDocument }) => {
    const actions = [
        { label: 'Add Note', icon: <FileEdit size={13} />, onClick: onAddNote },
        { label: 'Send Email', icon: <Mail size={13} />, onClick: onSendEmail },
        { label: 'Log Call', icon: <Phone size={13} />, onClick: onLogCall },
        { label: 'Schedule Meeting', icon: <CalendarPlus size={13} />, onClick: onScheduleMeeting },
        { label: 'Create Task', icon: <CheckSquare size={13} />, onClick: onCreateTask },
        { label: 'Add Document', icon: <UploadCloud size={13} />, onClick: onUploadDocument },
    ];

    return (
        <div className="flex flex-wrap items-center gap-2 mb-6">
            {actions.map((a) => (
                <button
                    key={a.label}
                    onClick={a.onClick}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    {a.icon} {a.label}
                </button>
            ))}
        </div>
    );
};

export default QuickActionBar;
