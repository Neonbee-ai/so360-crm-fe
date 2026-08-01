import React, { useState, useEffect } from 'react';
import { Mail, Loader2, ExternalLink, Smartphone, MessageSquare } from 'lucide-react';
import { inboxIntegrationApi, InboxConversationPreview } from '../../services/crmService';

interface Props {
    leadId: string;
}

const PLATFORM_ICON: Record<string, React.ReactNode> = {
    email: <Mail size={14} className="text-blue-400" />,
    whatsapp: <MessageSquare size={14} className="text-emerald-400" />,
    instagram: <Smartphone size={14} className="text-pink-400" />,
    facebook: <Smartphone size={14} className="text-blue-500" />,
    web_chat: <MessageSquare size={14} className="text-slate-400" />,
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
        return <div className="flex justify-center py-10 text-slate-500"><Loader2 size={20} className="animate-spin" /></div>;
    }

    if (error) {
        return <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-4 py-3">{error}</div>;
    }

    if (conversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                <Mail size={24} className="mb-2" />
                <p className="text-xs">No email or messaging conversations linked to this lead yet.</p>
                <p className="text-[10px] text-slate-700 mt-1">Conversations from Inbox will appear here automatically once linked.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {conversations.map((c) => (
                <a
                    key={c.id}
                    // Cross-MFE navigation: Inbox is a separate remote with its own
                    // router, so this must be a full navigation (window.location),
                    // not a React Router <Link> resolved against CRM's own basename
                    // — matches the existing convention (see DealDetailPage.tsx).
                    href={`/inbox/conversations/${c.id}`}
                    onClick={(e) => { e.preventDefault(); window.location.href = `/inbox/conversations/${c.id}`; }}
                    className="flex items-center justify-between gap-3 bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-3 hover:border-slate-700 transition-all group cursor-pointer"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        {PLATFORM_ICON[c.platform] || <Mail size={14} className="text-slate-400" />}
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-200 truncate">{c.customer_name || c.topic || 'Conversation'}</p>
                            <p className="text-[10px] text-slate-500">{c.message_count} messages · {formatDateTime(c.last_message_at)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">{c.status}</span>
                        <ExternalLink size={12} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                    </div>
                </a>
            ))}
        </div>
    );
};

export default EmailsTab;
