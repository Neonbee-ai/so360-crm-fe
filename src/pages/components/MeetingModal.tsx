import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { meetingsApi } from '../../services/crmService';
import { Button, TextField, Textarea, NumberInput, DateTimePicker } from '@so360/design-system';
import { Modal } from '../../components/common/Modal';
import { Meeting } from '../../types/crm';
import { CombGrid } from './CombGrid';

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
                <TextField name="meeting-title" label="Title" value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} />
                <CombGrid cols="pair">
                    <DateTimePicker name="meeting-scheduled-at" label="Date & Time" value={scheduledAt} onChange={(v: string) => setScheduledAt(v)} />
                    <NumberInput name="meeting-duration" label="Duration (min)" min={5} value={durationMinutes} onChange={(v: number | null) => setDurationMinutes(v ?? 0)} />
                </CombGrid>
                <TextField name="meeting-location" label="Location / Link" value={location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)} />
                <Textarea name="meeting-agenda" label="Agenda" value={agenda} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAgenda(e.target.value)} rows={3} />
            </div>
            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-line">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    {isEditing ? 'Save Changes' : 'Schedule'}
                </Button>
            </div>
        </Modal>
    );
};

export default MeetingModal;
