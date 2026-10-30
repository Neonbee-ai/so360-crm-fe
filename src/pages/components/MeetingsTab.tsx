import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Loader2, MapPin, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { meetingsApi } from '../../services/crmService';
import { Meeting } from '../../types/crm';
import MeetingModal from './MeetingModal';
import { PromptDialog } from '../../components/PromptDialog';
import { useConfirm, Button, Badge, EmptyState, IconButton } from '@so360/design-system';

interface Props {
    leadId?: string;
    dealId?: string;
}

const STATUS_TONE: Record<string, 'primary' | 'success' | 'neutral' | 'danger'> = {
    upcoming: 'primary',
    completed: 'success',
    cancelled: 'neutral',
    missed: 'danger',
};

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
}

const MeetingsTab: React.FC<Props> = ({ leadId, dealId }) => {
    const [confirm, confirmDialog] = useConfirm();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [completeTarget, setCompleteTarget] = useState<Meeting | null>(null);

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

    const handleCancel = async (meeting: Meeting) => {
        if (!await confirm({ title: 'Cancel?', message: `Cancel "${meeting.title}"?`, intent: 'danger', confirmLabel: 'Cancel meeting' })) return;
        await meetingsApi.cancel(meeting.id);
        load();
    };

    const handleComplete = async (meeting: Meeting, outcome?: string, nextSteps?: string) => {
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
            {confirmDialog}
            <PromptDialog
                open={!!completeTarget}
                title="Complete meeting"
                submitLabel="Complete"
                fields={[
                    { name: 'outcome', label: 'Meeting outcome', multiline: true },
                    { name: 'nextSteps', label: 'Next steps', multiline: true },
                ]}
                onSubmit={async (v) => {
                    const m = completeTarget;
                    setCompleteTarget(null);
                    if (m) await handleComplete(m, v.outcome || undefined, v.nextSteps || undefined);
                }}
                onClose={() => setCompleteTarget(null)}
            />
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-fg-muted">Meetings</p>
                <Button variant="primary" onClick={() => { setEditingMeeting(null); setShowModal(true); }}>
                    <Plus size={14} /> Schedule meeting
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10 text-fg-muted"><Loader2 size={20} className="animate-spin" /></div>
            ) : meetings.length === 0 ? (
                <EmptyState icon={Calendar} title="No meetings scheduled yet" />
            ) : (
                <div className="divide-y divide-line">
                    {meetings.map((m) => (
                        <div key={m.id} className="py-nb-3 first:pt-0 last:pb-0">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-fg">{m.title}</span>
                                        <Badge size="sm" tone={STATUS_TONE[m.status] ?? 'neutral'}>{m.status}</Badge>
                                    </div>
                                    <p className="text-xs text-fg-muted mt-1 flex items-center gap-1">
                                        <Clock size={11} /> {formatDateTime(m.scheduled_at)} · {m.duration_minutes} min
                                    </p>
                                    {m.location && <p className="text-xs text-fg-muted mt-0.5 flex items-center gap-1"><MapPin size={11} /> {m.location}</p>}
                                    {m.outcome && <p className="text-xs text-fg-subtle mt-1">Outcome: {m.outcome}</p>}
                                </div>
                                {m.status === 'upcoming' && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <IconButton label="Mark completed" title="Mark completed" icon={<CheckCircle2 size={14} />} onClick={() => setCompleteTarget(m)} disabled={completingId === m.id} />
                                        <IconButton label="Cancel" title="Cancel" icon={<XCircle size={14} />} onClick={() => handleCancel(m)} />
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
