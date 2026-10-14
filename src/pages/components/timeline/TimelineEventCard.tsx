import React from 'react';
import { Link } from 'react-router-dom';
import {
    Phone, Users, AtSign, FileText, CheckCircle2, File, Briefcase,
    TrendingUp, Info, Edit2, Trash2, Bookmark, MessageCircle, MessageSquare, Home,
} from 'lucide-react';
import { EntityTimelineEvent } from '../../../services/crmService';
import { useCRMFormatters } from '../../../utils/formatters';

interface Props {
    event: EntityTimelineEvent;
    isPinned?: boolean;
    onTogglePin?: (id: string) => void;
    onEdit?: (event: EntityTimelineEvent) => void;
    onDelete?: (event: EntityTimelineEvent) => void;
}

function getEventIcon(event: EntityTimelineEvent) {
    switch (event.icon) {
        case 'edit': return <TrendingUp size={13} className="text-blue-400" />;
        case 'note': return <FileText size={13} className="text-warning" />;
        case 'task': return <CheckCircle2 size={13} className="text-primary" />;
        case 'document': return <File size={13} className="text-indigo-400" />;
        case 'deal': return <Briefcase size={13} className="text-success" />;
        case 'call': return <Phone size={13} className="text-blue-400" />;
        // G8 Client 360: meetings, bookings and Inbox-sourced conversations
        case 'meeting': return <Users size={13} className="text-purple-400" />;
        case 'email': return <AtSign size={13} className="text-success" />;
        case 'whatsapp': return <MessageCircle size={13} className="text-success" />;
        case 'message': return <MessageSquare size={13} className="text-sky-400" />;
        case 'booking': return <Home size={13} className="text-danger" />;
        case 'activity':
            if (event.group_key.includes('MEETING')) return <Users size={13} className="text-purple-400" />;
            if (event.group_key.includes('EMAIL')) return <AtSign size={13} className="text-success" />;
            return <FileText size={13} className="text-warning" />;
        default: return <Info size={13} className="text-fg-subtle" />;
    }
}

function relatedLink(event: EntityTimelineEvent): string | null {
    if (event.related_type === 'task' && event.related_id) return `/crm/tasks/${event.related_id}`;
    if (event.related_type === 'deal' && event.related_id) return `/crm/deals/${event.related_id}`;
    return null;
}

const TimelineEventCard: React.FC<Props> = ({ event, isPinned, onTogglePin, onEdit, onDelete }) => {
    const formatters = useCRMFormatters();
    const link = relatedLink(event);
    const canManage = event.related_type === 'activity' && (onEdit || onDelete);

    const body = (
        <>
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-fg uppercase tracking-tight leading-tight">{event.title}</span>
                    <span className="text-[8px] bg-surface-raised text-fg-muted px-1.5 py-0.5 rounded font-black uppercase tracking-widest">{event.module}</span>
                </div>
                <span className="text-[9px] text-fg-muted font-mono shrink-0">{formatters.formatDateTime(event.created_at)}</span>
            </div>
            {event.description && (
                <p className="text-[11px] text-fg-subtle leading-relaxed">{event.description}</p>
            )}
            <div className="mt-2 flex items-center justify-between">
                {event.actor_name && (
                    <span className="text-[9px] text-fg-muted font-bold uppercase tracking-widest">{event.actor_name}</span>
                )}
                {event.status_badge && (
                    <span className="text-[9px] bg-surface-raised text-fg-muted px-1.5 py-0.5 rounded font-black uppercase tracking-widest">{event.status_badge}</span>
                )}
            </div>
        </>
    );

    return (
        <div className="relative pl-9 group">
            <div className="absolute left-0 top-1.5 w-7 h-7 rounded-full bg-surface-raised border border-line flex items-center justify-center z-10">
                {getEventIcon(event)}
            </div>
            <div className="bg-surface border border-slate-800/50 p-3 rounded-lg hover:border-line transition-colors">
                {link ? <Link to={link} className="block">{body}</Link> : body}
                {(onTogglePin || canManage) && (
                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onTogglePin && (
                            <button
                                onClick={() => onTogglePin(event.id)}
                                className="p-1 text-fg-muted hover:text-warning transition-colors"
                                title={isPinned ? 'Unpin' : 'Pin'}
                            >
                                <Bookmark size={12} fill={isPinned ? 'currentColor' : 'none'} />
                            </button>
                        )}
                        {canManage && onEdit && (
                            <button onClick={() => onEdit(event)} className="p-1 text-fg-muted hover:text-blue-400 transition-colors" title="Edit">
                                <Edit2 size={12} />
                            </button>
                        )}
                        {canManage && onDelete && (
                            <button onClick={() => onDelete(event)} className="p-1 text-fg-muted hover:text-danger transition-colors" title="Delete">
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimelineEventCard;
