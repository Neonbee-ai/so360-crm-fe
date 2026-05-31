import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { crmService, settingsApi } from '../../services/crmService';
import { AlertCircle } from 'lucide-react';
import { CustomFieldDefinition, User, Lead, SourceTypeOption } from '../../types/crm';
import { useNotify, useActivity, useIdentity } from '@so360/shell-context';

interface CreateLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    existingLeads: string[]; // List of company names to detect duplicates
}

export const CreateLeadModal = ({ isOpen, onClose, onSuccess, existingLeads }: CreateLeadModalProps) => {
    const { emitNotification } = useNotify();
    const { recordActivity } = useActivity();
    const { user: currentUser } = useIdentity();
    const [formData, setFormData] = useState({
        company_name: '',
        contact_name: '',
        contact_email: '',
        phone: '',
        alt_phone: '',
        address: '',
        city: '',
        pin_code: '',
        source: '',
        status: 'New' as any,
        owner_id: '',
        referred_by: '',
        custom_fields: {} as Record<string, any>
    });

    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [leadStages, setLeadStages] = useState<{ id: string, name: string }[]>([]);
    const [sourceTypes, setSourceTypes] = useState<SourceTypeOption[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [partners, setPartners] = useState<Lead[]>([]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const [settings, fetchedUsers, fetchedPartners, fetchedSourceTypes] = await Promise.all([
                    crmService.getSettings(),
                    crmService.getUsers(),
                    crmService.getPartners(),
                    settingsApi.sourceTypes.getAll().catch(() => [] as any[]),
                ]);
                setCustomFieldDefs(settings.lead_custom_fields);
                setLeadStages(settings.lead_stages);
                setSourceTypes(fetchedSourceTypes);
                setUsers(fetchedUsers);
                setPartners(fetchedPartners);
                setFormData(prev => ({
                    ...prev,
                    ...(settings.lead_stages.length > 0 && !prev.status ? { status: settings.lead_stages[0].name } : {}),
                    ...(fetchedSourceTypes.length > 0 && !prev.source ? { source: fetchedSourceTypes[0].value } : {}),
                    owner_id: prev.owner_id || currentUser?.id || fetchedUsers[0]?.id || '',
                }));
            } catch (error) {
                console.error('Failed to fetch lead settings', error);
            }
        };
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isDuplicate = existingLeads.some(
        name => name && (name as string).toLowerCase() === (formData.company_name || '').toLowerCase() && (formData.company_name || '').length > 0
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const newLead = await crmService.createLead({
                ...formData,
                activities: [],
                notes: [],
                owner_id: formData.owner_id,
                referred_by: formData.referred_by || undefined,
            } as any);
            // Fire-and-forget notification + activity
            recordActivity({ eventType: 'lead.created', eventCategory: 'crm', description: `Created lead "${formData.company_name}"`, resourceType: 'lead', resourceId: newLead?.id }).catch(() => {});
            onSuccess();
            onClose();
        } catch (err) {
            setError('Failed to create lead. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Lead" size="xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                {isDuplicate && (
                    <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
                        <AlertCircle size={18} className="shrink-0" />
                        <p>Potential duplicate detected. A lead with this company name already exists.</p>
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        <AlertCircle size={18} className="shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Company Name *</label>
                    <input
                        required
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                        placeholder="e.g. Acme Corp"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Contact Name *</label>
                        <input
                            required
                            type="text"
                            value={formData.contact_name}
                            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Contact Email *</label>
                        <input
                            required
                            type="email"
                            value={formData.contact_email}
                            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Phone</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                            placeholder="+91 98765 43210"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Alt. Phone</label>
                        <input
                            type="tel"
                            value={formData.alt_phone}
                            onChange={(e) => setFormData({ ...formData, alt_phone: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                            placeholder="+91 98765 43211"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Address</label>
                    <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                        placeholder="Street / area"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">City</label>
                        <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                            placeholder="Bangalore"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Pin Code</label>
                        <input
                            type="text"
                            value={formData.pin_code}
                            onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                            placeholder="560001"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Lead Source</label>
                        <select
                            value={formData.source}
                            onChange={(e) => setFormData({ ...formData, source: e.target.value, referred_by: '' })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50"
                        >
                            <option value="">— Select source —</option>
                            {sourceTypes.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Lead Stage</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50"
                        >
                            {leadStages.map(stage => (
                                <option key={stage.id} value={stage.name}>{stage.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {(formData.source === 'customer_referral' || formData.source === 'architect_referral') && (
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Referred By (Partner)</label>
                        <select
                            value={formData.referred_by}
                            onChange={(e) => setFormData({ ...formData, referred_by: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50"
                        >
                            <option value="">— Select partner —</option>
                            {partners.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.company_name}{p.contact_name ? ` (${p.contact_name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-400">Owner</label>
                    <select
                        value={formData.owner_id}
                        onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50"
                    >
                        {users.length === 0 && (
                            <option value="">Loading...</option>
                        )}
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                    </select>
                </div>

                {customFieldDefs.length > 0 && (
                    <div className="pt-4 border-t border-slate-800 space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Additional Details</p>
                        <div className="grid grid-cols-2 gap-4">
                            {customFieldDefs.map(field => (
                                <div key={field.id} className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-400">{field.label} {field.required ? '*' : ''}</label>
                                    {field.type === 'boolean' ? (
                                        <div className="flex items-center h-10">
                                            <input
                                                type="checkbox"
                                                checked={formData.custom_fields[field.id] || false}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    custom_fields: { ...formData.custom_fields, [field.id]: e.target.checked }
                                                })}
                                                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-blue-500/50"
                                            />
                                        </div>
                                    ) : field.type === 'SELECT' || field.field_type === 'SELECT' ? (
                                        <select
                                            required={field.required}
                                            value={formData.custom_fields[field.id] || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                custom_fields: { ...formData.custom_fields, [field.id]: e.target.value }
                                            })}
                                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50"
                                        >
                                            <option value="">— Select —</option>
                                            {(field.options || []).map((opt: string) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            required={field.required}
                                            type={field.type === 'number' || field.field_type === 'NUMBER' ? 'number' : field.type === 'date' || field.field_type === 'DATE' ? 'date' : 'text'}
                                            value={formData.custom_fields[field.id] || ''}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                custom_fields: { ...formData.custom_fields, [field.id]: e.target.value }
                                            })}
                                            className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-50 placeholder:text-slate-500"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Lead'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
