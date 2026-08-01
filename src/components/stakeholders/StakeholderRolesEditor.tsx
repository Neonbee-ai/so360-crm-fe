import React from 'react';
import { StakeholderRole } from '../../types/crm';

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
                    <button
                        key={role}
                        type="button"
                        onClick={() => toggle(role)}
                        disabled={readOnly}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                            active
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                        } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                        {ROLE_LABELS[role]}
                    </button>
                );
            })}
        </div>
    );
};

export default StakeholderRolesEditor;
