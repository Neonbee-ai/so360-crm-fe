import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { stakeholderApi } from '../../services/crmService';
import { StakeholderActivitySummary as SummaryType } from '../../types/crm';
import { CountUp, Grid } from '@so360/design-system';

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
            <Grid columns={2} gap="md" className="text-xs">
                <div className="bg-surface-sunken border border-line rounded-nb p-2.5">
                    <p className="text-fg-muted font-medium">Last Call</p>
                    <p className="text-fg mt-0.5">{formatDate(summary.last_call)}</p>
                </div>
                <div className="bg-surface-sunken border border-line rounded-nb p-2.5">
                    <p className="text-fg-muted font-medium">Last Email</p>
                    <p className="text-fg mt-0.5">{formatDate(summary.last_email)}</p>
                </div>
                <div className="bg-surface-sunken border border-line rounded-nb p-2.5">
                    <p className="text-fg-muted font-medium">Last Meeting</p>
                    <p className="text-fg mt-0.5">{formatDate(summary.last_meeting)}</p>
                </div>
                <div className="bg-surface-sunken border border-line rounded-nb p-2.5">
                    <p className="text-fg-muted font-medium">Open Tasks</p>
                    <p className="text-fg mt-0.5"><CountUp value={summary.open_tasks} /></p>
                </div>
            </Grid>

            {summary.associated_deals.length > 0 && (
                <div>
                    <p className="text-xs text-fg-muted font-medium mb-1.5">Associated Deals</p>
                    <div className="space-y-1">
                        {summary.associated_deals.map((d) => (
                            <div key={d.deal_id} className="flex items-center justify-between text-xs bg-surface-sunken border border-line rounded-nb px-2.5 py-1.5">
                                <span className="text-fg-subtle">{d.deal?.name || d.deal_id}</span>
                                <span className="text-fg-muted">{d.involvement_role}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StakeholderActivitySummary;
