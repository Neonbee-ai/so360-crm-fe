import React from 'react';
import { Link } from 'react-router-dom';
import {
    Phone, Users, AtSign, FileText, CheckCircle2, File, Briefcase,
    TrendingUp, Info, Edit2, Trash2, Bookmark, MessageCircle, MessageSquare, Home, ShoppingBag,
} from 'lucide-react';
import { EntityTimelineEvent } from '../../../services/crmService';
import { useCRMFormatters } from '../../../utils/formatters';
import { Badge, IconButton } from '@so360/design-system';

interface Props {
    event: EntityTimelineEvent;
    isPinned?: boolean;
    onTogglePin?: (id: string) => void;
    onEdit?: (event: EntityTimelineEvent) => void;
    onDelete?: (event: EntityTimelineEvent) => void;
}

function getEventIcon(event: EntityTimelineEvent) {
    switch (event.icon) {
        case 'edit': return <TrendingUp size={13} className="text-primary" />;
        case 'note': return <FileText size={13} className="text-warning" />;
        case 'task': return <CheckCircle2 size={13} className="text-primary" />;
        case 'document': return <File size={13} className="text-primary" />;
        case 'deal': return <Briefcase size={13} className="text-success" />;
        case 'call': return <Phone size={13} className="text-primary" />;
        // G8 Client 360: meetings, bookings and Inbox-sourced conversations
        case 'meeting': return <Users size={13} className="text-info" />;
        case 'email': return <AtSign size={13} className="text-success" />;
        case 'whatsapp': return <MessageCircle size={13} className="text-success" />;
        case 'message': return <MessageSquare size={13} className="text-primary" />;
        case 'enquiry': return <ShoppingBag size={13} className="text-primary" />;
        case 'booking': return <Home size={13} className="text-danger" />;
        case 'activity':
            if (event.group_key.includes('MEETING')) return <Users size={13} className="text-info" />;
            if (event.group_key.includes('ENQUIRY')) return <ShoppingBag size={13} className="text-primary" />;
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

/** Inbox threads are shown by reference; open them in Inbox, a different app from CRM. */
export function inboxThreadHref(event: EntityTimelineEvent): string | null {
    return event.module === 'inbox' && event.related_type === 'conversation' && event.related_id
        ? `/inbox/conversations/${event.related_id}`
        : null;
}

/** Only http(s) URLs become links; anything else (javascript:, data:) stays text. */
export function safeHttpUrl(u?: string): string | null {
    if (!u) return null;
    try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
        return null;
    }
}

const EnquiryProduct: React.FC<{ meta?: Record<string, string> }> = ({ meta }) => {
    const name = meta?.product_name;
    if (!name) return null;
    const href = safeHttpUrl(meta?.page_url);
    const detail = [meta?.variant_name, meta?.sku ? `SKU ${meta.sku}` : ''].filter(Boolean).join(' · ');
    return (
        <p className="mt-1 text-xs text-fg" data-testid="enquiry-product">
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid="enquiry-product-link">{name}</a>
            ) : (
                <span className="font-medium">{name}</span>
            )}
            {detail && <span className="text-fg-muted"> · {detail}</span>}
        </p>
    );
};

const TimelineEventCard: React.FC<Props> = ({ event, isPinned, onTogglePin, onEdit, onDelete }) => {
    const formatters = useCRMFormatters();
    const link = relatedLink(event);
    const inboxHref = inboxThreadHref(event);
    const canManage = event.related_type === 'activity' && (onEdit || onDelete);

    const body = (
        <>
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-fg leading-tight">{event.title}</span>
                    <Badge size="sm" tone="neutral">{event.module}</Badge>
                </div>
                <span className="text-xs text-fg-muted font-mono shrink-0">{formatters.formatDateTime(event.created_at)}</span>
            </div>
            {event.description && (
                <p className="text-xs text-fg-subtle leading-relaxed whitespace-pre-line">{event.description}</p>
            )}
            {event.type === 'enquiry' && <EnquiryProduct meta={event.metadata} />}
            <div className="mt-2 flex items-center justify-between">
                {event.actor_name && (
                    <span className="text-xs text-fg-muted font-medium">{event.actor_name}</span>
                )}
                {event.status_badge && (
                    <Badge size="sm" tone="neutral">{event.status_badge}</Badge>
                )}
            </div>
        </>
    );

    return (
        <div className="relative pl-9 group">
            <div className="absolute left-0 top-1.5 w-7 h-7 rounded-full bg-surface-raised border border-line flex items-center justify-center">
                {getEventIcon(event)}
            </div>
            <div className="bg-surface border border-line p-3 rounded-nb hover:border-line transition-colors">
                {link ? <Link to={link} className="block">{body}</Link> : inboxHref ? (
                    <a
                        href={inboxHref}
                        className="block"
                        data-testid="timeline-inbox-link"
                        onClick={(e) => { e.preventDefault(); window.location.href = inboxHref; }}
                    >{body}</a>
                ) : body}
                {(onTogglePin || canManage) && (
                    <div className="mt-2 pt-2 border-t border-line flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onTogglePin && (
                            <IconButton label={isPinned ? 'Unpin' : 'Pin'} title={isPinned ? 'Unpin' : 'Pin'} icon={<Bookmark size={12} fill={isPinned ? 'currentColor' : 'none'} />} onClick={() => onTogglePin(event.id)} />
                        )}
                        {canManage && onEdit && (
                            <IconButton label="Edit" title="Edit" icon={<Edit2 size={12} />} onClick={() => onEdit(event)} />
                        )}
                        {canManage && onDelete && (
                            <IconButton label="Delete" title="Delete" icon={<Trash2 size={12} />} onClick={() => onDelete(event)} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimelineEventCard;
