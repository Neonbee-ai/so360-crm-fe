import React from 'react';
import { Star, Mail, Phone, Link2, XCircle, MailX, Edit2, Trash2 } from 'lucide-react';
import { Badge, IconButton, Button, type BadgeTone } from '@so360/design-system';
import { Stakeholder } from '../../types/crm';
import { ROLE_LABELS } from './StakeholderRolesEditor';

const STRENGTH_TONE: Record<string, BadgeTone> = {
    very_strong: 'success',
    strong: 'primary',
    moderate: 'neutral',
    weak: 'warning',
    no_relationship: 'neutral',
};

const COMMITTEE_TONE: Record<string, BadgeTone> = {
    primary_decision_maker: 'info',
    strong_supporter: 'success',
    neutral: 'neutral',
    opposed: 'danger',
    unknown: 'neutral',
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
                <Button variant="secondary" size="sm" className="!text-left w-full !h-auto !justify-start" onClick={() => onOpenQuickActions(stakeholder)}>
                    <div className="size-9 rounded-full bg-surface-raised flex items-center justify-center text-xs font-medium text-fg-subtle shrink-0">
                        {(stakeholder.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-medium text-fg text-xs">{stakeholder.full_name || 'Unnamed'}</span>
                            {stakeholder.is_primary_contact && <Star size={12} className="text-warning fill-warning" />}
                            {!stakeholder.is_active && <Badge size="sm" tone="neutral">Inactive</Badge>}
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
                    <Badge key={role} size="sm" tone="neutral">
                        {ROLE_LABELS[role] || role}
                    </Badge>
                ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge size="sm" tone={COMMITTEE_TONE[stakeholder.buying_committee_role] ?? 'neutral'}>
                    {stakeholder.buying_committee_role.replace(/_/g, ' ')}
                </Badge>
                <Badge size="sm" tone={STRENGTH_TONE[stakeholder.relationship_strength] ?? 'neutral'}>
                    {stakeholder.relationship_strength.replace(/_/g, ' ')}
                </Badge>
                {stakeholder.do_not_contact && (
                    <Badge size="sm" tone="danger">
                        <XCircle size={9} /> Do Not Contact
                    </Badge>
                )}
                {stakeholder.marketing_opt_out && (
                    <Badge size="sm" tone="warning">
                        <MailX size={9} /> Opted Out
                    </Badge>
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
