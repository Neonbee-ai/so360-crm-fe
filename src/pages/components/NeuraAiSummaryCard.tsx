import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, IconButton, Skeleton } from '@so360/design-system';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { neuraAiService, inboxIntegrationApi, NeuraEntityRef } from '../../services/crmService';

interface Props {
    leadId: string;
    leadLabel: string;
    /** Org has the Inbox module enabled — gates the Inbox-communications fetch. */
    isInboxEnabled: boolean;
    /** CRM entity being summarised. Defaults to a lead; a deal reuses the same card. */
    entity?: 'leads' | 'deals' | 'partners';
}

const conversationStorageKey = (leadId: string) => `neura_ai_conversation:${leadId}`;
const summaryCacheKey = (leadId: string) => `neura_ai_summary:${leadId}`;
const PARTNER_SUMMARY_PROMPT = 'Summarize this partner for me: type, status, contact details, linked deals and commissions, recent activity, and any risks or next steps I should be aware of. Be concise.';
const DEAL_SUMMARY_PROMPT = 'Summarize this deal for me: current stage, value, linked customer, recent activity, and any risks or next steps I should be aware of. Be concise.';
/** A summary is reused for this long on revisits — every page mount used to
 *  fire a fresh identical LLM call (audited: 11 byte-identical asks in 5h). */
const SUMMARY_TTL_MS = 10 * 60 * 1000;

// "this lead" (not only "customer"): the retrieval layer keys tools off these
// words — see the summary-roulette entry in the Neura issue audit.
const SUMMARY_PROMPT = 'Summarize this lead/customer for me: background, current stage, active opportunities, recent activity, and any risks I should be aware of. Be concise.';

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

const NeuraAiSummaryCard: React.FC<Props> = ({ leadId, leadLabel, isInboxEnabled, entity = 'leads' }) => {
    const isDeal = entity === 'deals';
    const isPartner = entity === 'partners';
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const entityRef: NeuraEntityRef = { module: 'crm', entity, id: leadId, label: leadLabel };
    // Ref (not state): two rapid mounts (StrictMode / remount) both saw
    // isLoading=false and double-fired identical LLM calls.
    const inFlightRef = useRef(false);

    const fetchSummary = useCallback(async (force = false) => {
        if (inFlightRef.current) return;

        // Revisits within the TTL reuse the cached summary — no LLM call.
        if (!force) {
            try {
                const cached = JSON.parse(sessionStorage.getItem(summaryCacheKey(leadId)) || 'null');
                if (cached?.text && Date.now() - cached.at < SUMMARY_TTL_MS) {
                    setSummary(cached.text);
                    return;
                }
            } catch { /* cache unreadable — fetch fresh */ }
        }

        inFlightRef.current = true;
        setIsLoading(true);
        setError(null);
        try {
            // localStorage: ONE conversation per lead across sessions — each
            // quick-action click used to spawn a new conversation (6 for one
            // lead in the audit), fragmenting history.
            let conversationId =
                localStorage.getItem(conversationStorageKey(leadId)) ||
                sessionStorage.getItem(conversationStorageKey(leadId));
            if (!conversationId) {
                const conversation = await neuraAiService.createConversation(`Neura AI · ${isDeal ? 'Deal' : isPartner ? 'Partner' : 'Lead'} ${leadLabel || leadId}`);
                conversationId = conversation.id;
                localStorage.setItem(conversationStorageKey(leadId), conversationId);
            }

            const inboxContext = isInboxEnabled && !isDeal && !isPartner ? await buildInboxContext(leadId) : null;
            const basePrompt = isDeal ? DEAL_SUMMARY_PROMPT : isPartner ? PARTNER_SUMMARY_PROMPT : SUMMARY_PROMPT;
            const prompt = inboxContext ? `${basePrompt}\n\n${inboxContext}` : basePrompt;

            const result = await neuraAiService.sendMessage(conversationId, prompt, entityRef);
            setSummary(result.assistantMessage.content);
            try {
                sessionStorage.setItem(
                    summaryCacheKey(leadId),
                    JSON.stringify({ text: result.assistantMessage.content, at: Date.now() }),
                );
            } catch { /* quota — skip caching */ }
        } catch {
            setError('Could not generate a summary right now.');
        } finally {
            inFlightRef.current = false;
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
        <Card
            padding="sm"
            title="Neura AI summary"
            actions={
                <IconButton label="Refresh summary" title="Refresh summary" icon={<RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />} onClick={() => fetchSummary(true)} disabled={isLoading} />
            }
        >
            {isLoading && !summary ? (
                <div role="status" aria-busy="true" className="space-y-nb-2 text-fg-muted py-4">
                    <Skeleton variant="text" lines={3} />
                    <span className="text-xs">Neura AI is reviewing this {isDeal ? 'deal' : isPartner ? 'partner' : 'lead'}…</span>
                </div>
            ) : error && !summary ? (
                <div className="flex items-center gap-2 text-danger py-2">
                    <AlertCircle size={12} />
                    <span className="text-xs">{error}</span>
                </div>
            ) : summary ? (
                <p className="text-xs text-fg-subtle leading-relaxed whitespace-pre-wrap">{summary}</p>
            ) : null}
        </Card>
    );
};

export default NeuraAiSummaryCard;
