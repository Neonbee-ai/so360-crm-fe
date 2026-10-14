import React from 'react';
import { EntityTimelineSummary } from '../../../services/crmService';
import CustomerHealthBadge from './CustomerHealthBadge';

interface Props {
    summary: EntityTimelineSummary;
}

const TimelineSummaryBanner: React.FC<Props> = ({ summary }) => {
    return (
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <CustomerHealthBadge status={summary.health_status} />

            {summary.last_interaction_at && (
                <div className="text-[10px] text-fg-muted">
                    Last interaction: <span className="text-fg-subtle font-bold">{new Date(summary.last_interaction_at).toLocaleDateString()}</span>
                </div>
            )}

            {summary.most_active_contact && (
                <div className="text-[10px] text-fg-muted">
                    Most active: <span className="text-fg-subtle font-bold">{summary.most_active_contact}</span>
                </div>
            )}

            {Object.entries(summary.counts).length > 0 && (
                <div className="text-[10px] text-fg-muted flex flex-wrap gap-2">
                    {Object.entries(summary.counts).map(([key, count]) => (
                        <span key={key} className="bg-surface-raised text-fg-subtle px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                            {key.replace(/^(field|event|activity):/, '')}: {count}
                        </span>
                    ))}
                </div>
            )}

            {summary.pending_tasks > 0 && (
                <div className="text-[10px] text-fg-muted">
                    Tasks pending: <span className="text-fg-subtle font-bold">{summary.pending_tasks}</span>
                </div>
            )}

            {summary.idle_days !== null && summary.idle_days >= 14 && (
                <div className="text-[10px] text-warning font-bold">
                    No activity for {summary.idle_days} days.
                </div>
            )}
        </div>
    );
};

export default TimelineSummaryBanner;
