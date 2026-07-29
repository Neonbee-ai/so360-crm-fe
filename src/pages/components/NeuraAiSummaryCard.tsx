import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { neuraAiService, inboxIntegrationApi, NeuraEntityRef } from '../../services/crmService';

interface Props {
    leadId: string;
    leadLabel: string;
    /** Org has the Inbox module enabled — gates the Inbox-communications fetch. */
    isInboxEnabled: boolean;
}

const conversationStorageKey = (leadId: string) => `neura_ai_conversation:${leadId}`;

const SUMMARY_PROMPT = 'Summarize this customer for me: background, current stage, active opportunities, recent activity, and any risks I should be aware of. Be concise.';

/**
 * Builds a short factual line about the lead's Inbox conversations to append
 * to the summary prompt — Neura's agent loop has no tool for the CRM↔Inbox
 * link, so this context has to be supplied inline rather than discovered by
 * the model itself. Fails silently (module disabled, RBAC denied, network
 * error) since the summary should never block on Inbox being unavailable.
 */
async function buildInboxContext(leadId: string): Promise<string | null> {
    try {
        const { data } = await inboxIntegrationApi.getConversationsForLead(leadId);
        if (!data.length) return null;
        const latest = [...data].sort(
            (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
        )[0];
        const platforms = Array.from(new Set(data.map(c => c.platform))).join(', ');
        return `Inbox context: ${data.length} conversation(s) via ${platforms}. Most recent: ${latest.platform}${latest.topic ? ` — "${latest.topic}"` : ''}, status ${latest.status}, last message ${latest.last_message_at}.`;
    } catch {
        return null;
    }
}

const NeuraAiSummaryCard: React.FC<Props> = ({ leadId, leadLabel, isInboxEnabled }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const entityRef: NeuraEntityRef = { module: 'crm', entity: 'leads', id: leadId, label: leadLabel };

    const fetchSummary = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            let conversationId = sessionStorage.getItem(conversationStorageKey(leadId));
            if (!conversationId) {
                const conversation = await neuraAiService.createConversation(`Neura AI · Lead ${leadLabel || leadId}`);
                conversationId = conversation.id;
                sessionStorage.setItem(conversationStorageKey(leadId), conversationId);
            }

            const inboxContext = isInboxEnabled ? await buildInboxContext(leadId) : null;
            const prompt = inboxContext ? `${SUMMARY_PROMPT}\n\n${inboxContext}` : SUMMARY_PROMPT;

            const result = await neuraAiService.sendMessage(conversationId, prompt, entityRef);
            setSummary(result.assistantMessage.content);
        } catch {
            setError('Could not generate a summary right now.');
        } finally {
            setIsLoading(false);
        }
    }, [leadId, leadLabel, isInboxEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchSummary();
        // Refetch only when the viewed lead changes, not on every render —
        // fetchSummary is intentionally excluded so a manual Refresh click
        // (which reruns the same callback) doesn't also retrigger this effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadId]);

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="bg-violet-500/10 text-violet-400 p-1.5 rounded-lg">
                        <Sparkles size={14} />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Neura AI Summary</h3>
                </div>
                <button
                    onClick={fetchSummary}
                    disabled={isLoading}
                    title="Refresh summary"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all disabled:opacity-40"
                >
                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {isLoading && !summary ? (
                <div className="flex items-center gap-2 text-slate-500 py-4">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Neura AI is reviewing this lead…</span>
                </div>
            ) : error && !summary ? (
                <div className="flex items-center gap-2 text-rose-400 py-2">
                    <AlertCircle size={12} />
                    <span className="text-[11px]">{error}</span>
                </div>
            ) : summary ? (
                <p className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{summary}</p>
            ) : null}
        </section>
    );
};

export default NeuraAiSummaryCard;
