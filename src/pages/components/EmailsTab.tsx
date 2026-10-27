import React, { useState, useEffect } from 'react';
import { Badge, EmptyState } from '@so360/design-system';
import { Mail, Loader2, ExternalLink, Smartphone, MessageSquare } from 'lucide-react';
import { inboxIntegrationApi, InboxConversationPreview } from '../../services/crmService';

interface Props {
    leadId: string;
}

const PLATFORM_ICON: Record<string, React.ReactNode> = {
    email: <Mail size={14} className="text-primary" />,
    whatsapp: <MessageSquare size={14} className="text-success" />,
    instagram: <Smartphone size={14} className="text-info" />,
    facebook: <Smartphone size={14} className="text-primary" />,
    web_chat: <MessageSquare size={14} className="text-fg-subtle" />,
};

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
}

/**
 * Task 3 — Email Workspace: embeds a read-only preview of Inbox conversations
 * linked to this lead (directly or via a resolved omnichannel contact
 * identity). Reply/compose/forward happens in Inbox's own UI — "Open in
 * Inbox" deep-links there rather than duplicating a second composer here.
 */
const EmailsTab: React.FC<Props> = ({ leadId }) => {
    const [conversations, setConversations] = useState<InboxConversationPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        inboxIntegrationApi.getConversationsForLead(leadId)
            .then((result) => { if (!cancelled) setConversations(result.data); })
            .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load conversations'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [leadId]);

    if (loading) {
        return <div className="flex justify-center py-10 text-fg-muted"><Loader2 size={20} className="animate-spin" /></div>;
    }

    if (error) {
        return <div className="bg-danger/10 border border-danger/20 text-danger text-xs rounded-nb px-4 py-3">{error}</div>;
    }

    if (conversations.length === 0) {
        return (
            <EmptyState icon={Mail} title="No email or messaging conversations linked to this lead yet" description="Conversations from Inbox will appear here automatically once linked." />
        );
    }

    return (
        <div className="divide-y divide-line">
            {conversations.map((c) => (
                <a
                    key={c.id}
                    // Cross-MFE navigation: Inbox is a separate remote with its own
                    // router, so this must be a full navigation (window.location),
                    // not a React Router <Link> resolved against CRM's own basename
                    // — matches the existing convention (see DealDetailPage.tsx).
                    href={`/inbox/conversations/${c.id}`}
                    onClick={(e) => { e.preventDefault(); window.location.href = `/inbox/conversations/${c.id}`; }}
                    className="flex items-center justify-between gap-nb-3 py-nb-3 first:pt-0 last:pb-0 group cursor-pointer"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        {PLATFORM_ICON[c.platform] || <Mail size={14} className="text-fg-subtle" />}
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-fg truncate">{c.customer_name || c.topic || 'Conversation'}</p>
                            <p className="text-xs text-fg-muted">{c.message_count} messages · {formatDateTime(c.last_message_at)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Badge size="sm">{c.status}</Badge>
                        <ExternalLink size={12} className="text-fg-muted group-hover:text-primary transition-colors" />
                    </div>
                </a>
            ))}
        </div>
    );
};

export default EmailsTab;
