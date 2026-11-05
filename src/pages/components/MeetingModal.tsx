import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { meetingsApi } from '../../services/crmService';
import { Button, TextField, Textarea, NumberInput, DateTimePicker, Grid, GridItem, Select } from '@so360/design-system';
import { Modal } from '../../components/common/Modal';
import { Meeting, MeetingProviderAvailability, OnlineMeetingProvider } from '../../types/crm';
import { parseAttendeeEmails, providerOptionLabel, useOnlineMeetingsEnabled } from './onlineMeetingsFlag';

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
    // Pulse ab92e893: online meeting platform (create only — an existing
    // meeting keeps the link it was created with).
    const onlineEnabled = useOnlineMeetingsEnabled() && !isEditing;
    const [providers, setProviders] = useState<MeetingProviderAvailability[]>([]);
    const [provider, setProvider] = useState<OnlineMeetingProvider | ''>('');
    const [attendeeEmails, setAttendeeEmails] = useState('');

    useEffect(() => {
        if (!onlineEnabled) return;
        let alive = true;
        meetingsApi.providers()
            .then(list => { if (alive) setProviders(Array.isArray(list) ? list : []); })
            .catch(() => { if (alive) setProviders([]); });
        return () => { alive = false; };
    }, [onlineEnabled]);

    const selected = providers.find(p => p.provider === provider);
    const hasUnavailable = providers.some(p => !p.available);

    const handleSave = async () => {
        if (!title.trim()) { setError('Title is required'); return; }
        const { emails, invalid } = parseAttendeeEmails(attendeeEmails);
        if (provider && invalid.length > 0) { setError(`Not a valid email: ${invalid.join(', ')}`); return; }
        if (provider === 'google_meet' && emails.length === 0) { setError('Add at least one attendee email for Google Meet'); return; }
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
            const online = provider
                ? { meeting_provider: provider, attendees: emails.map(external_email => ({ external_email })) }
                : {};
            const result = isEditing && meeting
                ? await meetingsApi.update(meeting.id, payload)
                : await meetingsApi.create({ ...payload, ...online, lead_id: leadId, deal_id: dealId, stakeholder_id: stakeholderId });
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
                <Grid gap="md">
                    <GridItem span={{ md: 4, lg: 6 }}><DateTimePicker name="meeting-scheduled-at" label="Date & Time" value={scheduledAt} onChange={(v: string) => setScheduledAt(v)} /></GridItem>
                    <GridItem span={{ md: 4, lg: 6 }}><NumberInput name="meeting-duration" label="Duration (min)" min={5} value={durationMinutes} onChange={(v: number | null) => setDurationMinutes(v ?? 0)} /></GridItem>
                </Grid>
                {onlineEnabled && (
                    <Select
                        name="meeting-provider"
                        label="Meeting platform"
                        value={provider}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProvider(e.target.value as OnlineMeetingProvider | '')}
                        options={[
                            { value: '', label: 'In person or my own link' },
                            ...providers.map(p => ({ value: p.provider, label: providerOptionLabel(p), disabled: !p.available })),
                        ]}
                        hint={hasUnavailable ? 'Connect Google Calendar or Microsoft Outlook in Connect to create Meet or Teams links.' : undefined}
                    />
                )}
                {selected && (
                    <TextField
                        name="meeting-attendee-emails"
                        label="Attendee emails"
                        placeholder="name@company.com, other@company.com"
                        value={attendeeEmails}
                        required={provider === 'google_meet'}
                        hint={`${selected.label} sends the invite and the join link is saved on this meeting.`}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAttendeeEmails(e.target.value)}
                    />
                )}
                <TextField name="meeting-location" label={selected ? 'Location (optional)' : 'Location / Link'} value={location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)} />
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
