import React, { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, Briefcase, Calendar, ChevronDown } from 'lucide-react';
import { crmService, dealsApi } from '../../services/crmService';
import { Deal, DealStage, User } from '../../types/crm';
import { ToastContainer, useToast } from '../../components/common/Toast';
import { useActivity, usePeople } from '@so360/shell-context';

interface CreateDealModalProps {
    leadId?: string;
    leadName?: string;
    companyName?: string;
    onClose: () => void;
    onSuccess: (deal: Deal) => void;
}

const CreateDealModal: React.FC<CreateDealModalProps> = ({ leadId, leadName, companyName = '', onClose, onSuccess }) => {
    const { toasts, showError, dismissToast } = useToast();
    const { recordActivity } = useActivity();
    const { people } = usePeople();
    const [name, setName] = useState(companyName ? `${companyName} Deal` : '');
    const [value, setValue] = useState<string>('');
    const [stage, setStage] = useState<DealStage>('Lead');
    const [startDate, setStartDate] = useState<string>('');
    const [expectedClose, setExpectedClose] = useState<string>('');
    const [ownerId, setOwnerId] = useState<string>('');
    const [ownerPersonId, setOwnerPersonId] = useState<string>('');
    const [users, setUsers] = useState<User[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [settings, setSettings] = useState<{ id: string, name: string }[]>([]);

    useEffect(() => {
        const fetchDependencies = async () => {
            const [usersData, settingsData] = await Promise.all([
                crmService.getUsers(),
                crmService.getSettings()
            ]);
            setUsers(usersData);
            if (usersData.length > 0) {
                setOwnerId(usersData[0].id);
            }
            setSettings(settingsData.deal_stages);
            if (settingsData.deal_stages.length > 0) {
                setStage(settingsData.deal_stages[0].name as DealStage);
            }
        };
        fetchDependencies();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const deal = await dealsApi.create({
                name,
                company: companyName,
                value: parseFloat(value) || 0,
                stage_id: settings.find(s => s.name === stage)?.id || stage,
                owner_id: ownerId,
                owner_person_id: ownerPersonId || undefined,
                start_date: startDate ? new Date(startDate).toISOString() : undefined,
                expected_close: expectedClose ? new Date(expectedClose).toISOString() : undefined,
                lead_id: leadId || undefined,
            });
            recordActivity({ eventType: 'deal.created', eventCategory: 'crm', description: `Created deal "${name}" for ${companyName}`, resourceType: 'deal', resourceId: deal?.id }).catch(() => {});
            onSuccess(deal);
            onClose();
        } catch (error) {
            console.error('Failed to create deal', error);
            showError('Failed to create deal');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/20 flex items-center justify-between">
                        <h2 className="text-xl font-black text-slate-50 uppercase tracking-tight flex items-center gap-2">
                            <Briefcase className="text-blue-500" size={24} />
                            New Deal
                        </h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-50 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-8 space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deal Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all font-bold"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Value</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        type="number"
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-bold"
                                        required
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stage</label>
                                <div className="relative">
                                    <select
                                        value={stage}
                                        onChange={(e) => setStage(e.target.value as DealStage)}
                                        className="w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl pl-9 pr-10 py-3 outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                    >
                                        {settings.map(s => (
                                            <option key={s.id} value={s.name}>{s.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Start Date</label>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-bold cursor-pointer [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Close Date</label>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10" />
                                    <input
                                        type="date"
                                        value={expectedClose}
                                        onChange={(e) => setExpectedClose(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl pl-9 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-bold cursor-pointer [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Owner (User)</label>
                            <div className="relative">
                                <select
                                    value={ownerId}
                                    onChange={(e) => setOwnerId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-4 py-3 pr-10 outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                >
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.full_name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Sales Rep <span className="text-slate-700 normal-case font-bold tracking-normal">(optional)</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={ownerPersonId}
                                    onChange={(e) => setOwnerPersonId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-4 py-3 pr-10 outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                >
                                    <option value="">Select sales rep...</option>
                                    {people?.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.full_name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-slate-800 pt-5 mt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                            >
                                {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                                Create Deal
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default CreateDealModal;
