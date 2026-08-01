import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { meetingsApi } from '../../services/crmService';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                    <p className="text-xs font-black text-slate-50 uppercase tracking-widest">
                        {isEditing ? 'Edit Meeting' : 'Schedule Meeting'}
                    </p>
                    <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                    {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-3 py-2">{error}</div>}
                    <label className="block">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Title</span>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Date &amp; Time</span>
                            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none" />
                        </label>
                        <label className="block">
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Duration (min)</span>
                            <input type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none" />
                        </label>
                    </div>
                    <label className="block">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Location / Link</span>
                        <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none" />
                    </label>
                    <label className="block">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Agenda</span>
                        <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none" />
                    </label>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800">
                    <button onClick={onClose} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        {saving && <Loader2 size={12} className="animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Schedule'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MeetingModal;
