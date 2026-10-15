import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { meetingsApi } from '../../services/crmService';
import { Modal } from '../../components/common/Modal';
import { Meeting } from '../../types/crm';

interface Props {
    leadId?: string;
    dealId?: string;
    stakeholderId?: string;
    meeting?: Meeting | null;
    onClose: () => void;
    onSuccess: (meeting: Meeting) => void;
}

function toDatetimeLocal(iso?: string): string {
    const date = iso ? new Date(iso) : new Date(Date.now() + 30 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const MeetingModal: React.FC<Props> = ({ leadId, dealId, stakeholderId, meeting, onClose, onSuccess }) => {
    const isEditing = Boolean(meeting);
    const [title, setTitle] = useState(meeting?.title || '');
    const [scheduledAt, setScheduledAt] = useState(toDatetimeLocal(meeting?.scheduled_at));
    const [durationMinutes, setDurationMinutes] = useState(meeting?.duration_minutes ?? 30);
    const [location, setLocation] = useState(meeting?.location || '');
    const [agenda, setAgenda] = useState(meeting?.agenda || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!title.trim()) { setError('Title is required'); return; }
        setSaving(true);
        setError(null);
        try {
            const payload = {
                title,
                scheduled_at: new Date(scheduledAt).toISOString(),
                duration_minutes: durationMinutes,
                location: location || undefined,
                agenda: agenda || undefined,
            };
            const result = isEditing && meeting
                ? await meetingsApi.update(meeting.id, payload)
                : await meetingsApi.create({ ...payload, lead_id: leadId, deal_id: dealId, stakeholder_id: stakeholderId });
            onSuccess(result);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save meeting');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title={isEditing ? 'Edit Meeting' : 'Schedule Meeting'} size="md">
            <div className="space-y-3">
                {error && <div className="bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg px-3 py-2">{error}</div>}
                <label className="block">
                    <span className="block text-xs font-semibold text-fg-muted mb-1">Title</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none" />
                </label>
                <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                    <label className="block">
                        <span className="block text-xs font-semibold text-fg-muted mb-1">Date &amp; Time</span>
                        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none" />
                    </label>
                    <label className="block">
                        <span className="block text-xs font-semibold text-fg-muted mb-1">Duration (min)</span>
                        <input type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none" />
                    </label>
                </div>
                <label className="block">
                    <span className="block text-xs font-semibold text-fg-muted mb-1">Location / Link</span>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none" />
                </label>
                <label className="block">
                    <span className="block text-xs font-semibold text-fg-muted mb-1">Agenda</span>
                    <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-xs text-fg outline-none" />
                </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-line">
                <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-fg-subtle hover:text-fg">Cancel</button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-fg px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    {isEditing ? 'Save Changes' : 'Schedule'}
                </button>
            </div>
        </Modal>
    );
};

export default MeetingModal;
