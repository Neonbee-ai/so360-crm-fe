import React, { useState, useEffect, useCallback } from 'react';
import { Button, Badge, EmptyState } from '@so360/design-system';
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
            <div className="flex items-center justify-center py-12 text-fg-muted gap-3">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-medium">Loading feedback...</span>
            </div>
        );
    }

    if (submissions.length === 0) {
        return (
            <EmptyState icon={MessageSquare} title="No feedback yet" description="Customer-linked feedback forms will appear here once responses are submitted." />
        );
    }

    return (
        <>
            {/* Submission count */}
            <div className="flex items-center justify-end mb-nb-3">
                <span className="text-xs font-medium text-fg-muted">
                    {submissions.length} of {total}
                </span>
            </div>

            {/* Table */}
            <div className="divide-y divide-line">
                {submissions.map((sub) => {
                    const rating = extractRating(sub.data);
                    const dataEntries = Object.entries(sub.data).slice(0, 2);

                    return (
                        <div
                            key={sub.id}
                            className="flex items-start gap-nb-3 py-nb-3 first:pt-0 last:pb-0 group"
                        >
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-primary flex-shrink-0">
                                <FileText size={18} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h4 className="text-sm font-medium text-fg truncate">
                                        {sub.forms?.name || 'Feedback Form'}
                                    </h4>
                                    {rating && (
                                        <div className="flex items-center gap-1 text-warning flex-shrink-0">
                                            <Star size={11} className="fill-warning" />
                                            <span className="text-xs font-medium">{rating}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Response summary */}
                                {dataEntries.length > 0 && (
                                    <div className="space-y-0.5 mb-2">
                                        {dataEntries.map(([key, val]) => (
                                            <p key={key} className="text-xs text-fg-subtle truncate">
                                                <span className="text-fg-muted text-xs font-medium mr-1">{key.replace(/_/g, ' ')}:</span>
                                                {String(val).slice(0, 80)}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-3 text-xs font-medium text-fg-muted">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={10} />
                                        {formatDate(sub.submitted_at)}
                                    </span>
                                    <Badge size="sm" tone={sub.forms?.status === 'published' ? 'success' : 'neutral'}>{sub.forms?.status || 'unknown'}</Badge>
                                </div>
                            </div>

                            {/* View button */}
                            <button
                                onClick={() => setSelected(sub)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-fg-muted hover:text-primary hover:bg-surface-raised rounded-nb flex-shrink-0"
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
                <Button variant="secondary" onClick={loadMore} disabled={isLoadingMore}>
                    {isLoadingMore
                        ? <><Loader2 size={12} className="animate-spin" /> Loading…</>
                        : <><ChevronDown size={12} /> Load more ({total - submissions.length} remaining)</>
                    }
                </Button>
            )}

            {/* Response Detail Modal */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelected(null)}
                >
                    <div className="absolute inset-0 bg-surface-sunken backdrop-blur-sm" />
                    <div
                        className="relative bg-surface border border-line rounded-nb-lg w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                            <div>
                                <h3 className="text-sm font-medium text-fg">
                                    {selected.forms?.name || 'Feedback Response'}
                                </h3>
                                <p className="text-xs text-fg-muted font-medium mt-0.5">
                                    {formatDateTime(selected.submitted_at)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 text-fg-muted hover:text-fg hover:bg-surface-raised rounded-nb transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Response fields */}
                        <div className="overflow-y-auto p-6 space-y-4 flex-1">
                            {Object.keys(selected.data).length === 0 ? (
                                <div className="flex items-center gap-2 text-fg-muted">
                                    <AlertCircle size={14} />
                                    <span className="text-sm">No response data available.</span>
                                </div>
                            ) : (
                                Object.entries(selected.data).map(([key, value]) => (
                                    <div key={key} className="space-y-1">
                                        <p className="text-xs font-medium text-fg-muted">
                                            {key.replace(/_/g, ' ')}
                                        </p>
                                        <p className="text-sm text-fg bg-bg border border-line rounded-nb px-4 py-3">
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
