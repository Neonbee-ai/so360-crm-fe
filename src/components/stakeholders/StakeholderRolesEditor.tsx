import React from 'react';
import { StakeholderRole } from '../../types/crm';
import { Button } from '@so360/design-system';

export const ROLE_LABELS: Record<StakeholderRole, string> = {
    decision_maker: 'Decision Maker',
    economic_buyer: 'Economic Buyer',
    technical_evaluator: 'Technical Evaluator',
    end_user: 'End User',
    project_sponsor: 'Project Sponsor',
    procurement: 'Procurement',
    finance: 'Finance',
    legal: 'Legal',
    influencer: 'Influencer',
    champion: 'Champion',
    gatekeeper: 'Gatekeeper',
};

const ALL_ROLES = Object.keys(ROLE_LABELS) as StakeholderRole[];

interface Props {
    value: StakeholderRole[];
    onChange: (roles: StakeholderRole[]) => void;
    readOnly?: boolean;
}

const StakeholderRolesEditor: React.FC<Props> = ({ value, onChange, readOnly }) => {
    const toggle = (role: StakeholderRole) => {
        if (readOnly) return;
        onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
    };

    return (
        <div className="flex flex-wrap gap-1.5">
            {ALL_ROLES.map((role) => {
                const active = value.includes(role);
                return (
                    <Button variant={active ? "primary" : "secondary"} size="sm" key={role} type="button" onClick={() => toggle(role)} disabled={readOnly}>
                        {ROLE_LABELS[role]}
                    </Button>
                );
            })}
        </div>
    );
};

export default StakeholderRolesEditor;
