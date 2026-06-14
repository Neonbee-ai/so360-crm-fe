import React, { useState, useEffect, useCallback } from 'react';
import {
    MessageSquare, Loader2, ChevronDown, X, ExternalLink,
    Calendar, Star, FileText, AlertCircle,
} from 'lucide-react';
import { crmService } from '../../services/crmService';

interface FeedbackSubmission {
    id: string;
    form_id: string;
    customer_id: string;
    customer_name: string | null;
    submitted_at: string;
    is_spam: boolean;
    routing_results: Record<string, unknown>;
    data: Record<string, unknown>;
    forms: {
        id: string;
        name: string;
        status: string;
        form_type: string;
    };
}

interface Props {
    leadId: string;
}

function extractRating(data: Record<string, unknown>): string | null {
    const ratingKeys = ['rating', 'score', 'nps', 'satisfaction', 'stars'];
    for (const key of ratingKeys) {
        const found = Object.entries(data).find(
            ([k]) => k.toLowerCase().includes(key),
        );
        if (found) return String(found[1]);
    }
    return null;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    });
}

const PAGE_SIZE = 20;

export default function CustomerFeedbackTab({ leadId }: Props) {
    const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [selected, setSelected] = useState<FeedbackSubmission | null>(null);

    const load = useCallback(async (pg: number, append = false) => {
        try {
            const result = await crmService.getCustomerFeedback(leadId, { page: pg, limit: PAGE_SIZE });
            if (append) {
                setSubmissions(prev => [...prev, ...(result.data || [])]);
            } else {
                setSubmissions(result.data || []);
            }
            setTotal(result.total || 0);
            setPage(pg);
        } catch {
            // fail silently — empty state is shown
        }
    }, [leadId]);

    useEffect(() => {
        setIsLoading(true);
        load(1).finally(() => setIsLoading(false));
    }, [load]);

    const loadMore = async () => {
        setIsLoadingMore(true);
        await load(page + 1, true);
        setIsLoadingMore(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-3">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-medium">Loading feedback...</span>
            </div>
        );
    }

    if (submissions.length === 0) {
        return (
            <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                <MessageSquare size={40} className="mx-auto mb-4 text-slate-700" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">No Feedback Yet</p>
                <p className="text-xs text-slate-600 lowercase italic">
                    Customer-linked feedback forms will appear here once responses are submitted.
                </p>
            </div>
        );
    }

    return (
        <>
            {/* Submission count */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Customer Feedback
                </p>
                <span className="text-[10px] font-bold text-slate-600">
                    {submissions.length} of {total}
                </span>
            </div>

            {/* Table */}
            <div className="space-y-3">
                {submissions.map((sub) => {
                    const rating = extractRating(sub.data);
                    const dataEntries = Object.entries(sub.data).slice(0, 2);

                    return (
                        <div
                            key={sub.id}
                            className="flex items-start gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all group"
                        >
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 flex-shrink-0">
                                <FileText size={18} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h4 className="text-sm font-bold text-slate-50 truncate">
                                        {sub.forms?.name || 'Feedback Form'}
                                    </h4>
                                    {rating && (
                                        <div className="flex items-center gap-1 text-amber-400 flex-shrink-0">
                                            <Star size={11} className="fill-amber-400" />
                                            <span className="text-[10px] font-black">{rating}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Response summary */}
                                {dataEntries.length > 0 && (
                                    <div className="space-y-0.5 mb-2">
                                        {dataEntries.map(([key, val]) => (
                                            <p key={key} className="text-xs text-slate-400 truncate">
                                                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mr-1">{key.replace(/_/g, ' ')}:</span>
                                                {String(val).slice(0, 80)}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={10} />
                                        {formatDate(sub.submitted_at)}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${
                                        sub.forms?.status === 'published'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-slate-800 text-slate-500 border-slate-700'
                                    }`}>
                                        {sub.forms?.status || 'unknown'}
                                    </span>
                                </div>
                            </div>

                            {/* View button */}
                            <button
                                onClick={() => setSelected(sub)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg flex-shrink-0"
                                title="View full response"
                            >
                                <ExternalLink size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Load more */}
            {submissions.length < total && (
                <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                >
                    {isLoadingMore
                        ? <><Loader2 size={12} className="animate-spin" /> Loading...</>
                        : <><ChevronDown size={12} /> Load More ({total - submissions.length} remaining)</>
                    }
                </button>
            )}

            {/* Response Detail Modal */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelected(null)}
                >
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
                    <div
                        className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-sm font-black text-slate-50 uppercase tracking-tight">
                                    {selected.forms?.name || 'Feedback Response'}
                                </h3>
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                    {formatDateTime(selected.submitted_at)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Response fields */}
                        <div className="overflow-y-auto p-6 space-y-4 flex-1">
                            {Object.keys(selected.data).length === 0 ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <AlertCircle size={14} />
                                    <span className="text-sm">No response data available.</span>
                                </div>
                            ) : (
                                Object.entries(selected.data).map(([key, value]) => (
                                    <div key={key} className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            {key.replace(/_/g, ' ')}
                                        </p>
                                        <p className="text-sm text-slate-200 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                                            {String(value) || '—'}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
