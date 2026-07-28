import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sparkles, Send, Loader2, AlertCircle } from 'lucide-react';
import { neuraAiService, NeuraAgentBlock } from '../../services/crmService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    leadLabel: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    blocks?: NeuraAgentBlock[];
}

const PREDEFINED_PROMPTS = [
    'Summarize this customer',
    'What happened in the last 30 days?',
    'What are the biggest risks?',
    'What should I do next?',
];

const conversationStorageKey = (leadId: string) => `neura_ai_conversation:${leadId}`;

const NeuraAiDrawer: React.FC<Props> = ({ isOpen, onClose, leadId, leadLabel }) => {
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const entityRef = { module: 'crm', entity: 'leads', id: leadId, label: leadLabel };

    const ensureConversation = useCallback(async (): Promise<string> => {
        const cached = sessionStorage.getItem(conversationStorageKey(leadId));
        if (cached) return cached;

        const conversation = await neuraAiService.createConversation(`Neura AI · Lead ${leadLabel || leadId}`);
        sessionStorage.setItem(conversationStorageKey(leadId), conversation.id);
        return conversation.id;
    }, [leadId, leadLabel]);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        if (conversationId) return;

        let cancelled = false;
        setIsInitializing(true);
        ensureConversation()
            .then(id => { if (!cancelled) setConversationId(id); })
            .catch(() => { if (!cancelled) setError('Could not start Neura AI — please try again.'); })
            .finally(() => { if (!cancelled) setIsInitializing(false); });

        return () => { cancelled = true; };
    }, [isOpen, conversationId, ensureConversation]);

    useEffect(() => {
        const el = scrollRef.current;
        if (el && typeof el.scrollTo === 'function') {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isSending]);

    const sendPrompt = useCallback(async (content: string) => {
        const trimmed = content.trim();
        if (!trimmed || isSending) return;

        setError(null);
        setInput('');
        const userMsg: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content: trimmed };
        setMessages(prev => [...prev, userMsg]);
        setIsSending(true);

        try {
            const convId = conversationId || await ensureConversation();
            if (!conversationId) setConversationId(convId);

            const result = await neuraAiService.sendMessage(convId, trimmed, entityRef);
            setMessages(prev => [...prev, {
                id: result.assistantMessage.id,
                role: 'assistant',
                content: result.assistantMessage.content,
                blocks: result.blocks,
            }]);
        } catch (err) {
            setError('Neura AI could not answer that — please try again.');
        } finally {
            setIsSending(false);
        }
    }, [conversationId, ensureConversation, isSending, entityRef]);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />

            <div className="fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-full sm:w-[480px] lg:w-[520px] bg-slate-950 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                            <Sparkles size={14} className="text-violet-400" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-50 uppercase tracking-widest">Neura AI</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[280px]">{leadLabel}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800">
                        <X size={16} />
                    </button>
                </div>

                {/* Predefined prompts */}
                <div className="px-4 py-3 border-b border-slate-800 shrink-0 flex flex-wrap gap-1.5">
                    {PREDEFINED_PROMPTS.map(prompt => (
                        <button
                            key={prompt}
                            onClick={() => sendPrompt(prompt)}
                            disabled={isSending || isInitializing}
                            className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>

                {/* Conversation */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {isInitializing ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-xs">Starting Neura AI…</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500 px-6 text-center">
                            <Sparkles size={28} className="mb-3 text-slate-700" />
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Ask Neura AI about this lead</p>
                            <p className="text-[11px] text-slate-600 mt-1">
                                Try a prompt above, or ask anything — deals, activity, risks, next steps.
                            </p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                                    msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-900 border border-slate-800 text-slate-200'
                                }`}>
                                    {msg.content}
                                    {msg.blocks?.map((block, idx) => (
                                        <div key={idx} className="mt-2">
                                            {block.type === 'kpi' && (
                                                <div className="inline-flex flex-col bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                                                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">{block.label}</span>
                                                    <span className="text-sm font-black text-slate-100">{block.value}</span>
                                                </div>
                                            )}
                                            {block.type === 'table' && Array.isArray(block.rows) && (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-[10px] border-collapse">
                                                        <thead>
                                                            <tr>
                                                                {block.columns?.map((col: string) => (
                                                                    <th key={col} className="text-left text-slate-500 uppercase tracking-widest font-black px-2 py-1 border-b border-slate-800">{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {block.rows.map((row: any[], rIdx: number) => (
                                                                <tr key={rIdx}>
                                                                    {row.map((cell, cIdx) => (
                                                                        <td key={cIdx} className="px-2 py-1 border-b border-slate-800/50 text-slate-300">{cell ?? '—'}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                    {isSending && (
                        <div className="flex justify-start">
                            <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 flex items-center gap-2 text-slate-500">
                                <Loader2 size={12} className="animate-spin" />
                                <span className="text-[11px]">Neura AI is thinking…</span>
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 text-rose-400 text-[11px] px-1">
                            <AlertCircle size={12} />
                            {error}
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-slate-800 shrink-0 flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendPrompt(input); }}
                        placeholder="Ask Neura AI anything about this lead…"
                        disabled={isSending || isInitializing}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors disabled:opacity-50"
                    />
                    <button
                        onClick={() => sendPrompt(input)}
                        disabled={isSending || isInitializing || !input.trim()}
                        className="p-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </>
    );
};

export default NeuraAiDrawer;
