import React, { useState } from 'react';
import { stakeholderApi } from '../../services/crmService';
import { Deal } from '../../types/crm';

interface Props {
    stakeholderId: string;
    availableDeals: Deal[];
    linkedDealIds: string[];
    onLinked: () => void;
}

const INVOLVEMENT_ROLES = ['decision_maker', 'influencer', 'approver', 'user', 'other'];

const StakeholderDealLinker: React.FC<Props> = ({ stakeholderId, availableDeals, linkedDealIds, onLinked }) => {
    const [dealId, setDealId] = useState('');
    const [role, setRole] = useState('other');
    const [saving, setSaving] = useState(false);

    const unlinked = availableDeals.filter((d) => !linkedDealIds.includes(d.id));

    const handleLink = async () => {
        if (!dealId) return;
        setSaving(true);
        try {
            await stakeholderApi.linkDeal(stakeholderId, dealId, role);
            setDealId('');
            onLinked();
        } finally {
            setSaving(false);
        }
    };

    if (unlinked.length === 0) {
        return <p className="text-[10px] text-slate-600 italic">All deals on this lead are already linked.</p>;
    }

    return (
        <div className="flex items-center gap-2">
            <select value={dealId} onChange={(e) => setDealId(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 outline-none">
                <option value="">Select a deal…</option>
                {unlinked.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 outline-none">
                {INVOLVEMENT_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
            <button
                onClick={handleLink}
                disabled={!dealId || saving}
                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
                Link
            </button>
        </div>
    );
};

export default StakeholderDealLinker;
