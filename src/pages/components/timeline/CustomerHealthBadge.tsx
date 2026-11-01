import React from 'react';
import { Badge, type BadgeTone } from '@so360/design-system';
import { EntityTimelineSummary } from '../../../services/crmService';

const HEALTH_STYLE: Record<EntityTimelineSummary['health_status'], { label: string; tone: BadgeTone }> = {
    very_active: { label: 'Very Active', tone: 'success' },
    healthy: { label: 'Healthy', tone: 'primary' },
    neutral: { label: 'Neutral', tone: 'neutral' },
    at_risk: { label: 'At Risk', tone: 'warning' },
    dormant: { label: 'Dormant', tone: 'danger' },
};

interface Props {
    status: EntityTimelineSummary['health_status'];
}

const CustomerHealthBadge: React.FC<Props> = ({ status }) => {
    const style = HEALTH_STYLE[status] || HEALTH_STYLE.neutral;
    return (
        <Badge size="sm" tone={style.tone}>
            {style.label}
        </Badge>
    );
};

export default CustomerHealthBadge;
