import React, { useState } from 'react';
import { Phone, Mail, CalendarPlus, CheckSquare, FileEdit, UserCog, X } from 'lucide-react';
import { Stakeholder } from '../../types/crm';
import TaskModal from '../../pages/components/TaskModal';

interface Props {
    leadId: string;
    stakeholder: Stakeholder;
    onClose: () => void;
    onLogCall?: (stakeholder: Stakeholder) => void;
    onScheduleMeeting?: (stakeholder: Stakeholder) => void;
    onAddNote?: (stakeholder: Stakeholder) => void;
    onOpenProfile: (stakeholder: Stakeholder) => void;
    onTaskCreated?: () => void;
}

/**
 * Reuses existing creation surfaces (TaskModal) instead of building a second
 * task-creation UI. Call/Meeting quick actions delegate to parent callbacks
 * so they can switch to the existing Calls tab / future Meetings tab (Task 3)
 * rather than duplicating that logic here.
 */
const StakeholderQuickActions: React.FC<Props> = ({ leadId, stakeholder, onClose, onLogCall, onScheduleMeeting, onAddNote, onOpenProfile, onTaskCreated }) => {
    const [showTaskModal, setShowTaskModal] = useState(false);
    const blocked = stakeholder.do_not_contact;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                    <p className="text-xs font-black text-slate-50 uppercase tracking-widest">{stakeholder.full_name || 'Stakeholder'}</p>
                    <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800"><X size={16} /></button>
                </div>
                <div className="p-3 space-y-1.5">
                    <ActionButton
                        icon={<Phone size={14} />}
                        label="Call"
                        disabled={blocked || !stakeholder.phone}
                        href={stakeholder.phone ? `tel:${stakeholder.phone}` : undefined}
                        onClick={() => onLogCall?.(stakeholder)}
                    />
                    <ActionButton
                        icon={<Mail size={14} />}
                        label="Send Email"
                        disabled={blocked || stakeholder.marketing_opt_out || !stakeholder.email}
                        href={stakeholder.email ? `mailto:${stakeholder.email}` : undefined}
                    />
                    <ActionButton icon={<CalendarPlus size={14} />} label="Schedule Meeting" onClick={() => onScheduleMeeting?.(stakeholder)} />
                    <ActionButton icon={<CheckSquare size={14} />} label="Create Task" onClick={() => setShowTaskModal(true)} />
                    <ActionButton icon={<FileEdit size={14} />} label="Add Note" onClick={() => onAddNote?.(stakeholder)} />
                    <ActionButton icon={<UserCog size={14} />} label="Open Contact Profile" onClick={() => onOpenProfile(stakeholder)} />
                    {blocked && <p className="text-[9px] text-red-400 px-2 pt-1">This stakeholder is marked Do Not Contact.</p>}
                </div>
            </div>

            {showTaskModal && (
                <TaskModal
                    leadId={leadId}
                    stakeholderId={stakeholder.id}
                    onClose={() => setShowTaskModal(false)}
                    onSuccess={() => { setShowTaskModal(false); onTaskCreated?.(); onClose(); }}
                />
            )}
        </div>
    );
};

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; disabled?: boolean; href?: string; onClick?: () => void }> = ({ icon, label, disabled, href, onClick }) => {
    const className = `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold text-slate-300 transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}`;
    if (href && !disabled) {
        return <a href={href} className={className}>{icon}{label}</a>;
    }
    return <button onClick={onClick} disabled={disabled} className={className}>{icon}{label}</button>;
};

export default StakeholderQuickActions;
