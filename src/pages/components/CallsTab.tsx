import React, { useState, useEffect, useCallback } from 'react';
import {
    Phone, ArrowDownRight, ArrowUpRight, Loader2, Plus, X, Play,
    Trash2, FileText, Clock,
} from 'lucide-react';
import { crmService } from '../../services/crmService';

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

const SENTIMENT_STYLE: Record<string, string> = {
    positive: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    negative: 'bg-red-500/10 text-red-400 border-red-500/20',
    neutral: 'bg-slate-800 text-slate-500 border-slate-700',
    mixed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

function sentimentStyle(sentiment?: string | null): string {
    return sentiment ? (SENTIMENT_STYLE[sentiment] ?? SENTIMENT_STYLE.neutral) : SENTIMENT_STYLE.neutral;
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

function UploadCallForm({ onClose, onUpload }: UploadFormProps) {
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
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-100 uppercase tracking-widest">Upload Call Recording</h3>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Audio File</label>
                <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Direction</label>
                    <select
                        value={direction}
                        onChange={e => setDirection(e.target.value as 'inbound' | 'outbound')}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                        <option value="outbound">Outbound</option>
                        <option value="inbound">Inbound</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Occurred At</label>
                    <input
                        type="datetime-local"
                        value={occurredAt}
                        onChange={e => setOccurredAt(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Duration (seconds)</label>
                    <input
                        type="number"
                        min={0}
                        value={durationSeconds}
                        onChange={e => setDurationSeconds(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Phone Number</label>
                    <input
                        type="text"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        placeholder="+1 555 000 0000"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Transcript (optional)</label>
                <textarea
                    value={transcriptText}
                    onChange={e => setTranscriptText(e.target.value)}
                    rows={3}
                    placeholder="Paste or type the call transcript…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
            </div>

            <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Sentiment (optional)</label>
                <select
                    value={sentiment}
                    onChange={e => setSentiment(e.target.value as typeof sentiment)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                    <option value="">Unspecified</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                    <option value="mixed">Mixed</option>
                </select>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={onClose}
                    className="flex-1 py-2.5 border border-slate-700 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-slate-500 transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!file || submitting}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all disabled:opacity-50"
                >
                    {submitting ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : 'Upload Recording'}
                </button>
            </div>
        </div>
    );
}

export default function CallsTab({ leadId, dealId }: Props) {
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
        if (!window.confirm('Delete this call recording? This cannot be undone.')) return;
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
            <div className="flex items-center justify-center py-12 text-slate-500 gap-3">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-medium">Loading calls...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Calls ({calls.length})
                </p>
                <button
                    onClick={() => setShowUploadForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    <Plus size={12} /> Upload Call Recording
                </button>
            </div>

            {showUploadForm && (
                <UploadCallForm onClose={() => setShowUploadForm(false)} onUpload={handleUpload} />
            )}

            {calls.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                    <Phone size={40} className="mx-auto mb-4 text-slate-700" />
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">No calls logged yet</p>
                    <p className="text-xs text-slate-600 lowercase italic">
                        Upload a call recording to start tracking transcripts and sentiment here.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {calls.map(call => {
                        const DirectionIcon = call.direction === 'inbound' ? ArrowDownRight : ArrowUpRight;
                        const playbackUrl = playbackUrls[call.id];
                        return (
                            <div
                                key={call.id}
                                className="flex items-start gap-4 p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 flex-shrink-0">
                                    <DirectionIcon size={18} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className="text-sm font-bold text-slate-50 truncate">
                                            {call.phone_number || (call.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call')}
                                        </h4>
                                        {call.sentiment && (
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border flex-shrink-0 ${sentimentStyle(call.sentiment)}`}>
                                                {call.sentiment}
                                            </span>
                                        )}
                                    </div>

                                    {call.transcript_text && (
                                        <p
                                            onClick={() => setSelected(call)}
                                            className="text-xs text-slate-400 mb-2 line-clamp-2 cursor-pointer hover:text-slate-300 transition-colors"
                                        >
                                            {call.transcript_text}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider flex-wrap">
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
                                                <button
                                                    onClick={() => handlePlay(call)}
                                                    disabled={playbackLoadingId === call.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                                                >
                                                    {playbackLoadingId === call.id
                                                        ? <Loader2 size={11} className="animate-spin" />
                                                        : <Play size={11} />}
                                                    Play
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    {call.transcript_text && (
                                        <button
                                            onClick={() => setSelected(call)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg"
                                            title="View full transcript"
                                        >
                                            <FileText size={14} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(call.id)}
                                        disabled={deletingId === call.id}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg disabled:opacity-50"
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
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
                    <div
                        className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-sm font-black text-slate-50 uppercase tracking-tight">
                                    Call Transcript
                                </h3>
                                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                    {formatDateTime(selected.occurred_at)}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 flex-1">
                            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {selected.transcript_text || 'No transcript available.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
