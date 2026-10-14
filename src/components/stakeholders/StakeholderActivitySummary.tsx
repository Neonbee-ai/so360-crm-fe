import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { stakeholderApi } from '../../services/crmService';
import { StakeholderActivitySummary as SummaryType } from '../../types/crm';

interface Props {
    stakeholderId: string;
}

function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString();
}

const StakeholderActivitySummary: React.FC<Props> = ({ stakeholderId }) => {
    const [summary, setSummary] = useState<SummaryType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        stakeholderApi.getActivitySummary(stakeholderId)
            .then((data) => { if (!cancelled) setSummary(data); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [stakeholderId]);

    if (loading) {
        return <div className="flex justify-center py-6 text-fg-muted"><Loader2 size={16} className="animate-spin" /></div>;
    }

    if (!summary) return null;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-surface-sunken border border-line rounded-lg p-2.5">
                    <p className="text-fg-muted uppercase tracking-widest font-black">Last Call</p>
                    <p className="text-fg mt-0.5">{formatDate(summary.last_call)}</p>
                </div>
                <div className="bg-surface-sunken border border-line rounded-lg p-2.5">
                    <p className="text-fg-muted uppercase tracking-widest font-black">Last Email</p>
                    <p className="text-fg mt-0.5">{formatDate(summary.last_email)}</p>
                </div>
                <div className="bg-surface-sunken border border-line rounded-lg p-2.5">
                    <p className="text-fg-muted uppercase tracking-widest font-black">Last Meeting</p>
                    <p className="text-fg mt-0.5">{formatDate(summary.last_meeting)}</p>
                </div>
                <div className="bg-surface-sunken border border-line rounded-lg p-2.5">
                    <p className="text-fg-muted uppercase tracking-widest font-black">Open Tasks</p>
                    <p className="text-fg mt-0.5">{summary.open_tasks}</p>
                </div>
            </div>

            {summary.associated_deals.length > 0 && (
                <div>
                    <p className="text-[10px] text-fg-muted uppercase tracking-widest font-black mb-1.5">Associated Deals</p>
                    <div className="space-y-1">
                        {summary.associated_deals.map((d) => (
                            <div key={d.deal_id} className="flex items-center justify-between text-[10px] bg-surface-sunken border border-line rounded-lg px-2.5 py-1.5">
                                <span className="text-fg-subtle">{d.deal?.name || d.deal_id}</span>
                                <span className="text-fg-muted uppercase tracking-widest">{d.involvement_role}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StakeholderActivitySummary;
