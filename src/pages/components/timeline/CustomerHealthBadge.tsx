import React from 'react';
import { EntityTimelineSummary } from '../../../services/crmService';

const HEALTH_STYLE: Record<EntityTimelineSummary['health_status'], { label: string; className: string }> = {
    very_active: { label: 'Very Active', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    healthy: { label: 'Healthy', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    neutral: { label: 'Neutral', className: 'bg-slate-800 text-slate-400 border-slate-700' },
    at_risk: { label: 'At Risk', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    dormant: { label: 'Dormant', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

interface Props {
    status: EntityTimelineSummary['health_status'];
}

const CustomerHealthBadge: React.FC<Props> = ({ status }) => {
    const style = HEALTH_STYLE[status] || HEALTH_STYLE.neutral;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${style.className}`}>
            {style.label}
        </span>
    );
};

export default CustomerHealthBadge;
