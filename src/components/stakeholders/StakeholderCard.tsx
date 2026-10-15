import React from 'react';
import { Star, Mail, Phone, Link2, XCircle, MailX, Edit2, Trash2 } from 'lucide-react';
import { IconButton, Button } from '@so360/design-system';
import { Stakeholder } from '../../types/crm';
import { ROLE_LABELS } from './StakeholderRolesEditor';

const STRENGTH_STYLE: Record<string, string> = {
    very_strong: 'bg-success/10 text-success border-success/20',
    strong: 'bg-primary/10 text-primary border-primary/20',
    moderate: 'bg-surface-raised text-fg-subtle border-line',
    weak: 'bg-warning/10 text-warning border-warning/20',
    no_relationship: 'bg-surface text-fg-muted border-line',
};

const COMMITTEE_STYLE: Record<string, string> = {
    primary_decision_maker: 'bg-info/10 text-info border-info/20',
    strong_supporter: 'bg-success/10 text-success border-success/20',
    neutral: 'bg-surface-raised text-fg-subtle border-line',
    opposed: 'bg-danger/10 text-danger border-danger/20',
    unknown: 'bg-surface text-fg-muted border-line',
};

interface Props {
    stakeholder: Stakeholder;
    onEdit: (stakeholder: Stakeholder) => void;
    onDelete: (stakeholder: Stakeholder) => void;
    onOpenQuickActions: (stakeholder: Stakeholder) => void;
}

const StakeholderCard: React.FC<Props> = ({ stakeholder, onEdit, onDelete, onOpenQuickActions }) => {
    return (
        <div className="bg-surface border border-line rounded-nb p-4 hover:border-line transition-all group">
            <div className="flex items-start justify-between gap-2">
                <Button variant="secondary" size="sm" className="text-left w-full h-auto justify-start" onClick={() => onOpenQuickActions(stakeholder)}>
                    <div className="size-9 rounded-full bg-surface-raised flex items-center justify-center text-xs font-medium text-fg-subtle shrink-0">
                        {(stakeholder.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-medium text-fg text-xs">{stakeholder.full_name || 'Unnamed'}</span>
                            {stakeholder.is_primary_contact && <Star size={12} className="text-warning fill-warning" />}
                            {!stakeholder.is_active && <span className="text-xs bg-surface-raised text-fg-muted px-1.5 py-0.5 rounded font-medium">Inactive</span>}
                        </div>
                        <p className="text-xs text-fg-muted">
                            {[stakeholder.job_title, stakeholder.department].filter(Boolean).join(' · ') || '—'}
                        </p>
                    </div>
                </Button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <IconButton label="Edit stakeholder" size="sm" icon={<Edit2 size={12} />} onClick={() => onEdit(stakeholder)} />
                    <IconButton label="Delete stakeholder" size="sm" variant="danger" icon={<Trash2 size={12} />} onClick={() => onDelete(stakeholder)} />
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {stakeholder.roles.map((role) => (
                    <span key={role} className="text-xs bg-surface-raised text-fg-subtle px-1.5 py-0.5 rounded font-medium">
                        {ROLE_LABELS[role] || role}
                    </span>
                ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${COMMITTEE_STYLE[stakeholder.buying_committee_role]}`}>
                    {stakeholder.buying_committee_role.replace(/_/g, ' ')}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STRENGTH_STYLE[stakeholder.relationship_strength]}`}>
                    {stakeholder.relationship_strength.replace(/_/g, ' ')}
                </span>
                {stakeholder.do_not_contact && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-danger/20 bg-danger/10 text-danger font-medium flex items-center gap-1">
                        <XCircle size={9} /> Do Not Contact
                    </span>
                )}
                {stakeholder.marketing_opt_out && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-warning/20 bg-warning/10 text-warning font-medium flex items-center gap-1">
                        <MailX size={9} /> Opted Out
                    </span>
                )}
            </div>

            <div className="mt-3 flex items-center gap-3 text-xs text-fg-muted">
                {stakeholder.email && <span className="flex items-center gap-1"><Mail size={11} /> {stakeholder.email}</span>}
                {stakeholder.phone && <span className="flex items-center gap-1"><Phone size={11} /> {stakeholder.phone}</span>}
                {stakeholder.linkedin_url && (
                    <a href={stakeholder.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                        <Link2 size={11} /> LinkedIn
                    </a>
                )}
            </div>
        </div>
    );
};

export default StakeholderCard;
