import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Loader2, MapPin, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { meetingsApi } from '../../services/crmService';
import { Meeting } from '../../types/crm';
import MeetingModal from './MeetingModal';

interface Props {
    leadId?: string;
    dealId?: string;
    autoOpenForm?: boolean;
}

const STATUS_STYLE: Record<string, string> = {
    upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-slate-800 text-slate-500 border-slate-700',
    missed: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
}

const MeetingsTab: React.FC<Props> = ({ leadId, dealId, autoOpenForm }) => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(Boolean(autoOpenForm));
    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
    const [completingId, setCompletingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = leadId ? await meetingsApi.getByLead(leadId) : dealId ? await meetingsApi.getByDeal(dealId) : [];
            setMeetings(data);
        } finally {
            setLoading(false);
        }
    }, [leadId, dealId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (autoOpenForm) setShowModal(true); }, [autoOpenForm]);

    const handleCancel = async (meeting: Meeting) => {
        if (!confirm(`Cancel "${meeting.title}"?`)) return;
        await meetingsApi.cancel(meeting.id);
        load();
    };

    const handleComplete = async (meeting: Meeting) => {
        const outcome = prompt('Meeting outcome:') || undefined;
        const nextSteps = prompt('Next steps:') || undefined;
        setCompletingId(meeting.id);
        try {
            await meetingsApi.complete(meeting.id, outcome, nextSteps);
            load();
        } finally {
            setCompletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meetings</p>
                <button
                    onClick={() => { setEditingMeeting(null); setShowModal(true); }}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest"
                >
                    <Plus size={14} /> Schedule Meeting
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10 text-slate-500"><Loader2 size={20} className="animate-spin" /></div>
            ) : meetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                    <Calendar size={24} className="mb-2" />
                    <p className="text-xs">No meetings scheduled yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {meetings.map((m) => (
                        <div key={m.id} className="bg-slate-950/50 border border-slate-800/60 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-200">{m.title}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full border font-black uppercase tracking-widest ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                        <Clock size={11} /> {formatDateTime(m.scheduled_at)} · {m.duration_minutes} min
                                    </p>
                                    {m.location && <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1"><MapPin size={11} /> {m.location}</p>}
                                    {m.outcome && <p className="text-[10px] text-slate-400 mt-1">Outcome: {m.outcome}</p>}
                                </div>
                                {m.status === 'upcoming' && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => handleComplete(m)} disabled={completingId === m.id} className="p-1.5 text-slate-500 hover:text-emerald-400 transition-colors" title="Mark completed">
                                            <CheckCircle2 size={14} />
                                        </button>
                                        <button onClick={() => handleCancel(m)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" title="Cancel">
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <MeetingModal
                    leadId={leadId}
                    dealId={dealId}
                    meeting={editingMeeting}
                    onClose={() => setShowModal(false)}
                    onSuccess={load}
                />
            )}
        </div>
    );
};

export default MeetingsTab;
