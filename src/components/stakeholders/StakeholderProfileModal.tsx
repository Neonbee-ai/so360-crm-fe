import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, TextField, Select, Checkbox } from '@so360/design-system';
import { Modal } from '../common/Modal';
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
        <Modal
            isOpen
            onClose={onClose}
            title={isEditing ? 'Edit Stakeholder' : 'Add Stakeholder'}
            size="2xl"
            dismissible={!saving}
            data-testid="stakeholder-profile-modal"
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 size={12} className="animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Add Stakeholder'}
                    </Button>
                </>
            )}
        >
                <div className="space-y-4">
                    {error && <div className="bg-danger/10 border border-danger/20 text-danger text-xs rounded-nb px-3 py-2">{error}</div>}

                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                        <TextField name="first_name" label="First Name" value={form.first_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('first_name', e.target.value)} />
                        <TextField name="last_name" label="Last Name" value={form.last_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('last_name', e.target.value)} />
                        <TextField name="job_title" label="Job Title" value={form.job_title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('job_title', e.target.value)} />
                        <TextField name="department" label="Department" value={form.department} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('department', e.target.value)} />
                        <TextField name="company_name" label="Company" value={form.company_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('company_name', e.target.value)} />
                        <TextField name="time_zone" label="Time Zone" value={form.time_zone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('time_zone', e.target.value)} />
                        <TextField name="email" label="Email" type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('email', e.target.value)} />
                        <TextField name="phone" label="Phone" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('phone', e.target.value)} />
                        <TextField name="mobile_phone" label="Mobile" value={form.mobile_phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('mobile_phone', e.target.value)} />
                        <TextField name="linkedin_url" label="LinkedIn URL" value={form.linkedin_url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('linkedin_url', e.target.value)} />
                    </div>

                    <Field label="Roles">
                        <StakeholderRolesEditor value={roles} onChange={setRoles} />
                    </Field>

                    <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                        <Select name="buying_committee_role" label="Buying Committee" value={form.buying_committee_role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('buying_committee_role', e.target.value as BuyingCommitteeRole)} options={COMMITTEE_OPTIONS.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))} />
                        <Select name="relationship_strength" label="Relationship Strength" value={form.relationship_strength} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('relationship_strength', e.target.value as RelationshipStrength)} options={STRENGTH_OPTIONS.map((o) => ({ value: o, label: o.replace(/_/g, ' ') }))} />
                        <Select name="preferred_communication_method" label="Preferred Contact Method" value={form.preferred_communication_method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('preferred_communication_method', e.target.value)} options={[{ value: '', label: '—' }, ...['email', 'phone', 'mobile', 'linkedin', 'sms', 'other'].map((o) => ({ value: o, label: o }))]} />
                        <TextField name="preferred_contact_time" label="Preferred Contact Time" value={form.preferred_contact_time} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('preferred_contact_time', e.target.value)} />
                        <TextField name="preferred_language" label="Preferred Language" value={form.preferred_language} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('preferred_language', e.target.value)} />
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                        <Checkbox name="is_active" label="Active" checked={form.is_active} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('is_active', e.target.checked)} />
                        <Checkbox name="is_primary_contact" label="Primary Contact" checked={form.is_primary_contact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('is_primary_contact', e.target.checked)} />
                        <Checkbox name="do_not_contact" label="Do Not Contact" checked={form.do_not_contact} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('do_not_contact', e.target.checked)} />
                        <Checkbox name="marketing_opt_out" label="Marketing Opt-Out" checked={form.marketing_opt_out} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('marketing_opt_out', e.target.checked)} />
                    </div>
                </div>

        </Modal>
    );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <label className="block">
        <span className="block text-xs font-medium text-fg-muted mb-1">{label}</span>
        {children}
    </label>
);

export default StakeholderProfileModal;
