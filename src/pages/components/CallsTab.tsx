import React, { useState, useEffect, useCallback } from 'react';
import {
    Phone, ArrowDownRight, ArrowUpRight, Loader2, Plus, X, Play,
    Trash2, FileText, Clock,
} from 'lucide-react';
import { crmService } from '../../services/crmService';
import { useConfirm, Button, Badge, EmptyState } from '@so360/design-system';

interface Props {
    leadId?: string;
    dealId?: string;
}

interface CallRecord {
    id: string;
    lead_id: string | null;
    deal_id: string | null;
    direction: 'inbound' | 'outbound';
    occurred_at: string;
    duration_seconds: number | null;
    phone_number: string | null;
    dms_document_id: string | null;
    transcript_text: string | null;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
    emotion_scores: Record<string, number> | null;
}

interface CallUploadFields {
    lead_id?: string;
    deal_id?: string;
    direction?: 'inbound' | 'outbound';
    occurred_at?: string;
    duration_seconds?: number;
    phone_number?: string;
    transcript_text?: string;
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
}

const SENTIMENT_TONE: Record<string, 'success' | 'danger' | 'neutral' | 'warning'> = {
    positive: 'success',
    negative: 'danger',
    neutral: 'neutral',
    mixed: 'warning',
};

function sentimentTone(sentiment?: string | null): 'success' | 'danger' | 'neutral' | 'warning' {
    return sentiment ? (SENTIMENT_TONE[sentiment] ?? 'neutral') : 'neutral';
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    });
}

function formatDuration(seconds?: number | null): string {
    if (!seconds || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function toDatetimeLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface UploadFormProps {
    onClose: () => void;
    onUpload: (file: File, fields: CallUploadFields) => Promise<void>;
}

export function UploadCallForm({ onClose, onUpload }: UploadFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
    const [occurredAt, setOccurredAt] = useState(() => toDatetimeLocal(new Date()));
    const [durationSeconds, setDurationSeconds] = useState<number | ''>('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [transcriptText, setTranscriptText] = useState('');
    const [sentiment, setSentiment] = useState<'' | 'positive' | 'neutral' | 'negative' | 'mixed'>('');
    const [submitting, setSubmitting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] ?? null;
        setFile(selectedFile);
        // Best-effort auto-fill of duration from audio metadata — not all
        // environments (or file types) support this, so failures are silent
        // and the user can still enter the duration manually.
        if (!selectedFile || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
        try {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
                if (isFinite(audio.duration)) {
                    setDurationSeconds(Math.round(audio.duration));
                }
                URL.revokeObjectURL(audio.src);
            };
            audio.src = URL.createObjectURL(selectedFile);
        } catch {
            // ignore — manual duration entry still works
        }
    };

    const handleSubmit = async () => {
        if (!file || submitting) return;
        setSubmitting(true);
        try {
            await onUpload(file, {
                direction,
                occurred_at: new Date(occurredAt).toISOString(),
                duration_seconds: durationSeconds === '' ? undefined : durationSeconds,
                phone_number: phoneNumber || undefined,
                transcript_text: transcriptText || undefined,
                sentiment: sentiment || undefined,
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="border-b border-line pb-nb-3 mb-nb-3 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-fg">Upload Call Recording</h3>
                <button onClick={onClose} className="text-fg-muted hover:text-fg-subtle transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div>
                <label className="block text-xs font-medium text-fg-muted mb-2">Audio File</label>
                <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-fg-subtle file:mr-3 file:py-2 file:px-4 file:rounded-nb file:border-0 file:text-xs file:font-medium file: file:st file:bg-surface-raised file:text-fg hover:file:bg-line"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-fg-muted mb-2">Direction</label>
                    <select
                        value={direction}
                        onChange={e => setDirection(e.target.value as 'inbound' | 'outbound')}
                        className="w-full bg-surface-raised border border-line rounded-nb px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                    >
                        <option value="outbound">Outbound</option>
                        <option value="inbound">Inbound</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-fg-muted mb-2">Occurred At</label>
                    <input
                        type="datetime-local"
                        value={occurredAt}
                        onChange={e => setOccurredAt(e.target.value)}
                        className="w-full bg-surface-raised border border-line rounded-nb px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-fg-muted mb-2">Duration (seconds)</label>
                    <input
                        type="number"
                        min={0}
                        value={durationSeconds}
                        onChange={e => setDurationSeconds(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        className="w-full bg-surface-raised border border-line rounded-nb px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-fg-muted mb-2">Phone Number</label>
                    <input
                        type="text"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        placeholder="+1 555 000 0000"
                        className="w-full bg-surface-raised border border-line rounded-nb px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-fg-muted mb-2">Transcript (optional)</label>
                <textarea
                    value={transcriptText}
                    onChange={e => setTranscriptText(e.target.value)}
                    rows={3}
                    placeholder="Paste or type the call transcript…"
                    className="w-full bg-surface-raised border border-line rounded-nb px-3 py-2 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-primary resize-none"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-fg-muted mb-2">Sentiment (optional)</label>
                <select
                    value={sentiment}
                    onChange={e => setSentiment(e.target.value as typeof sentiment)}
                    className="w-full bg-surface-raised border border-line rounded-nb px-3 py-2 text-xs text-fg focus:outline-none focus:border-primary"
                >
                    <option value="">Unspecified</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                    <option value="mixed">Mixed</option>
                </select>
            </div>

            <div className="flex justify-end gap-nb-2">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={!file || submitting}>
                    {submitting ? <><Loader2 size={12} className="animate-spin" /> Uploading…</> : 'Upload recording'}
                </Button>
            </div>
        </div>
    );
}

/**
 * "Log Call" as a quick action, without sending the reader anywhere.
 *
 * The upload form used to be reachable only by switching the workspace to the
 * Calls tab and scrolling to it — which read as a page jump, and silently did
 * nothing on the second click because the tab was already open. Rendered as an
 * overlay it opens the same way every time, from anywhere on the page.
 */
export function LogCallModal({ leadId, dealId, onClose, onSuccess }: {
    leadId?: string;
    dealId?: string;
    onClose: () => void;
    onSuccess?: () => void;
}) {
    const handleUpload = async (file: File, fields: CallUploadFields) => {
        await crmService.uploadCallRecording(file, { ...fields, lead_id: leadId, deal_id: dealId });
        onSuccess?.();
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <UploadCallForm onClose={onClose} onUpload={handleUpload} />
            </div>
        </div>
    );
}

export default function CallsTab({ leadId, dealId }: Props) {
    const [confirm, confirmDialog] = useConfirm();
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [selected, setSelected] = useState<CallRecord | null>(null);
    const [playbackUrls, setPlaybackUrls] = useState<Record<string, string>>({});
    const [playbackLoadingId, setPlaybackLoadingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = leadId
                ? await crmService.getCallsByLeadId(leadId)
                : dealId
                    ? await crmService.getCallsByDealId(dealId)
                    : [];
            setCalls(data);
        } catch {
            setCalls([]);
        }
    }, [leadId, dealId]);

    useEffect(() => {
        setIsLoading(true);
        load().finally(() => setIsLoading(false));
    }, [load]);


    const handleUpload = async (file: File, fields: CallUploadFields) => {
        const created = await crmService.uploadCallRecording(file, {
            ...fields,
            lead_id: leadId,
            deal_id: dealId,
        });
        setCalls(prev => [created, ...prev]);
        setShowUploadForm(false);
    };

    const handlePlay = async (call: CallRecord) => {
        if (playbackUrls[call.id]) return;
        setPlaybackLoadingId(call.id);
        try {
            const { url } = await crmService.getCallPlaybackUrl(call.id);
            setPlaybackUrls(prev => ({ ...prev, [call.id]: url }));
        } catch {
            // fail silently — Play button simply stays inert
        } finally {
            setPlaybackLoadingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ title: 'Delete?', message: 'Delete this call recording? This cannot be undone.', intent: 'danger', confirmLabel: 'Delete' })) return;
        setDeletingId(id);
        try {
            await crmService.deleteCallRecord(id);
            setCalls(prev => prev.filter(c => c.id !== id));
        } finally {
            setDeletingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-fg-muted gap-3">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-medium">Loading calls...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {confirmDialog}
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-fg-muted">
                    Calls ({calls.length})
                </p>
                <Button variant="primary" onClick={() => setShowUploadForm(v => !v)}>
                    <Plus size={12} /> Upload call recording
                </Button>
            </div>

            {showUploadForm && (
                <UploadCallForm onClose={() => setShowUploadForm(false)} onUpload={handleUpload} />
            )}

            {calls.length === 0 ? (
                <EmptyState icon={Phone} title="No calls logged yet" description="Upload a call recording to start tracking transcripts and sentiment here." />
            ) : (
                <div className="divide-y divide-line">
                    {calls.map(call => {
                        const DirectionIcon = call.direction === 'inbound' ? ArrowDownRight : ArrowUpRight;
                        const playbackUrl = playbackUrls[call.id];
                        return (
                            <div
                                key={call.id}
                                className="flex items-start gap-nb-3 py-nb-3 first:pt-0 last:pb-0 group"
                            >
                                <div className="w-10 h-10 rounded-nb bg-surface-raised flex items-center justify-center text-primary flex-shrink-0">
                                    <DirectionIcon size={18} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className="text-sm font-medium text-fg truncate">
                                            {call.phone_number || (call.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call')}
                                        </h4>
                                        {call.sentiment && (
                                            <Badge size="sm" tone={sentimentTone(call.sentiment)}>{call.sentiment}</Badge>
                                        )}
                                    </div>

                                    {call.transcript_text && (
                                        <p
                                            onClick={() => setSelected(call)}
                                            className="text-xs text-fg-subtle mb-2 line-clamp-2 cursor-pointer hover:text-fg-subtle transition-colors"
                                        >
                                            {call.transcript_text}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 text-xs font-medium text-fg-muted flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Clock size={10} />
                                            {formatDateTime(call.occurred_at)}
                                        </span>
                                        <span>{formatDuration(call.duration_seconds)}</span>
                                    </div>

                                    {call.dms_document_id && (
                                        <div className="mt-3">
                                            {playbackUrl ? (
                                                <audio controls src={playbackUrl} className="h-8 max-w-full" />
                                            ) : (
                                                <Button variant="secondary" onClick={() => handlePlay(call)} disabled={playbackLoadingId === call.id}>
                                                    {playbackLoadingId === call.id
                                                        ? <Loader2 size={11} className="animate-spin" />
                                                        : <Play size={11} />}
                                                    Play
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    {call.transcript_text && (
                                        <button
                                            onClick={() => setSelected(call)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-fg-muted hover:text-primary hover:bg-surface-raised rounded-nb"
                                            title="View full transcript"
                                        >
                                            <FileText size={14} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(call.id)}
                                        disabled={deletingId === call.id}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-fg-muted hover:text-danger hover:bg-surface-raised rounded-nb disabled:opacity-50"
                                        title="Delete call"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

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
                        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                            <div>
                                <h3 className="text-sm font-medium text-fg">
                                    Call Transcript
                                </h3>
                                <p className="text-xs text-fg-muted font-medium mt-0.5">
                                    {formatDateTime(selected.occurred_at)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 text-fg-muted hover:text-fg hover:bg-surface-raised rounded-nb transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 flex-1">
                            <p className="text-sm text-fg whitespace-pre-wrap leading-relaxed">
                                {selected.transcript_text || 'No transcript available.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
