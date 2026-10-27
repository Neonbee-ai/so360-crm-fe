import React from 'react';
import { EntityTimelineSummary } from '../../../services/crmService';

const HEALTH_STYLE: Record<EntityTimelineSummary['health_status'], { label: string; className: string }> = {
    very_active: { label: 'Very Active', className: 'bg-success/10 text-success border-success/20' },
    healthy: { label: 'Healthy', className: 'bg-primary/10 text-primary border-primary/20' },
    neutral: { label: 'Neutral', className: 'bg-surface-raised text-fg-subtle border-line' },
    at_risk: { label: 'At Risk', className: 'bg-warning/10 text-warning border-warning/20' },
    dormant: { label: 'Dormant', className: 'bg-danger/10 text-danger border-danger/20' },
};

interface Props {
    status: EntityTimelineSummary['health_status'];
}

const CustomerHealthBadge: React.FC<Props> = ({ status }) => {
    const style = HEALTH_STYLE[status] || HEALTH_STYLE.neutral;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${style.className}`}>
            {style.label}
        </span>
    );
};

export default CustomerHealthBadge;
