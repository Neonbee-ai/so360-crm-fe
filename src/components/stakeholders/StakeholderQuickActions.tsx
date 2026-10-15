import React, { useState } from 'react';
import { Phone, Mail, CalendarPlus, CheckSquare, FileEdit, Users } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Stakeholder } from '../../types/crm';
import TaskModal from '../../pages/components/TaskModal';
import { Button } from '@so360/design-system';

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
        <Modal isOpen onClose={onClose} title={stakeholder.full_name || 'Stakeholder'} size="sm" data-testid="stakeholder-quick-actions">
                <div className="space-y-1.5">
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
                    <ActionButton icon={<Users size={14} />} label="Open Contact Profile" onClick={() => onOpenProfile(stakeholder)} />
                    {blocked && <p className="text-xs text-danger px-2 pt-1">This stakeholder is marked Do Not Contact.</p>}
                </div>

            {showTaskModal && (
                <TaskModal
                    leadId={leadId}
                    stakeholderId={stakeholder.id}
                    onClose={() => setShowTaskModal(false)}
                    onSuccess={() => { setShowTaskModal(false); onTaskCreated?.(); onClose(); }}
                />
            )}
        </Modal>
    );
};

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; disabled?: boolean; href?: string; onClick?: () => void }> = ({ icon, label, disabled, href, onClick }) => {
    const className = `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-nb text-xs font-medium text-fg-subtle transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-raised'}`;
    if (href && !disabled) {
        return <a href={href} className={className}>{icon}{label}</a>;
    }
    return <Button variant="secondary" size="sm" className="w-full justify-start" onClick={onClick} disabled={disabled}>{icon}{label}</Button>;
};

export default StakeholderQuickActions;
