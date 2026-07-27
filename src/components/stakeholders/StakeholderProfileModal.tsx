import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { stakeholderApi } from '../../services/crmService';
import { Stakeholder, StakeholderRole, BuyingCommitteeRole, RelationshipStrength } from '../../types/crm';
import StakeholderRolesEditor from './StakeholderRolesEditor';

interface Props {
    leadId: string;
    stakeholder?: Stakeholder | null;
    onClose: () => void;
    onSaved: () => void;
}

const COMMITTEE_OPTIONS: BuyingCommitteeRole[] = ['primary_decision_maker', 'strong_supporter', 'neutral', 'opposed', 'unknown'];
const STRENGTH_OPTIONS: RelationshipStrength[] = ['very_strong', 'strong', 'moderate', 'weak', 'no_relationship'];

const StakeholderProfileModal: React.FC<Props> = ({ leadId, stakeholder, onClose, onSaved }) => {
    const isEditing = Boolean(stakeholder);
    const [form, setForm] = useState({
        first_name: stakeholder?.first_name || '',
        last_name: stakeholder?.last_name || '',
        job_title: stakeholder?.job_title || '',
        department: stakeholder?.department || '',
        company_name: stakeholder?.company_name || '',
        email: stakeholder?.email || '',
        phone: stakeholder?.phone || '',
        mobile_phone: stakeholder?.mobile_phone || '',
        linkedin_url: stakeholder?.linkedin_url || '',
        preferred_communication_method: stakeholder?.preferred_communication_method || '',
        time_zone: stakeholder?.time_zone || '',
        is_active: stakeholder?.is_active ?? true,
        is_primary_contact: stakeholder?.is_primary_contact ?? false,
        buying_committee_role: stakeholder?.buying_committee_role || 'unknown',
        relationship_strength: stakeholder?.relationship_strength || 'no_relationship',
        relationship_confidence_score: stakeholder?.relationship_confidence_score ?? undefined,
        preferred_language: stakeholder?.preferred_language || '',
        preferred_contact_time: stakeholder?.preferred_contact_time || '',
        do_not_contact: stakeholder?.do_not_contact ?? false,
        marketing_opt_out: stakeholder?.marketing_opt_out ?? false,
    });
    const [roles, setRoles] = useState<StakeholderRole[]>(stakeholder?.roles || []);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const payload = { ...form, role_names: roles };
            if (isEditing && stakeholder) {
                await stakeholderApi.update(stakeholder.id, payload as any);
            } else {
                await stakeholderApi.create(leadId, payload as any);
            }
            onSaved();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save stakeholder');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
                    <p className="text-xs font-black text-slate-50 uppercase tracking-widest">
                        {isEditing ? 'Edit Stakeholder' : 'Add Stakeholder'}
                    </p>
                    <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 rounded-lg hover:bg-slate-800">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg px-3 py-2">{error}</div>}

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="First Name"><input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className="input" /></Field>
                        <Field label="Last Name"><input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className="input" /></Field>
                        <Field label="Job Title"><input value={form.job_title} onChange={(e) => set('job_title', e.target.value)} className="input" /></Field>
                        <Field label="Department"><input value={form.department} onChange={(e) => set('department', e.target.value)} className="input" /></Field>
                        <Field label="Company"><input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} className="input" /></Field>
                        <Field label="Time Zone"><input value={form.time_zone} onChange={(e) => set('time_zone', e.target.value)} className="input" /></Field>
                        <Field label="Email"><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input" /></Field>
                        <Field label="Phone"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input" /></Field>
                        <Field label="Mobile"><input value={form.mobile_phone} onChange={(e) => set('mobile_phone', e.target.value)} className="input" /></Field>
                        <Field label="LinkedIn URL"><input value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} className="input" /></Field>
                    </div>

                    <Field label="Roles">
                        <StakeholderRolesEditor value={roles} onChange={setRoles} />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Buying Committee">
                            <select value={form.buying_committee_role} onChange={(e) => set('buying_committee_role', e.target.value as BuyingCommitteeRole)} className="input">
                                {COMMITTEE_OPTIONS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                            </select>
                        </Field>
                        <Field label="Relationship Strength">
                            <select value={form.relationship_strength} onChange={(e) => set('relationship_strength', e.target.value as RelationshipStrength)} className="input">
                                {STRENGTH_OPTIONS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                            </select>
                        </Field>
                        <Field label="Preferred Contact Method">
                            <select value={form.preferred_communication_method} onChange={(e) => set('preferred_communication_method', e.target.value)} className="input">
                                <option value="">—</option>
                                {['email', 'phone', 'mobile', 'linkedin', 'sms', 'other'].map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </Field>
                        <Field label="Preferred Contact Time"><input value={form.preferred_contact_time} onChange={(e) => set('preferred_contact_time', e.target.value)} className="input" /></Field>
                        <Field label="Preferred Language"><input value={form.preferred_language} onChange={(e) => set('preferred_language', e.target.value)} className="input" /></Field>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                        <Checkbox label="Active" checked={form.is_active} onChange={(v) => set('is_active', v)} />
                        <Checkbox label="Primary Contact" checked={form.is_primary_contact} onChange={(v) => set('is_primary_contact', v)} />
                        <Checkbox label="Do Not Contact" checked={form.do_not_contact} onChange={(v) => set('do_not_contact', v)} />
                        <Checkbox label="Marketing Opt-Out" checked={form.marketing_opt_out} onChange={(v) => set('marketing_opt_out', v)} />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800 sticky bottom-0 bg-slate-950">
                    <button onClick={onClose} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                        {saving && <Loader2 size={12} className="animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Add Stakeholder'}
                    </button>
                </div>
            </div>

            <style>{`.input { background: rgb(15 23 42 / 0.6); border: 1px solid rgb(51 65 85); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.75rem; color: rgb(226 232 240); outline: none; width: 100%; }`}</style>
        </div>
    );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <label className="block">
        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</span>
        {children}
    </label>
);

const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
        {label}
    </label>
);

export default StakeholderProfileModal;
