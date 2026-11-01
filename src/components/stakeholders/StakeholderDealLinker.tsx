import React, { useState } from 'react';
import { Button, Select } from '@so360/design-system';
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
        return <p className="text-xs text-fg-muted italic">All deals on this lead are already linked.</p>;
    }

    return (
        <div className="flex items-center gap-2">
            <Select
                name="stakeholder-deal"
                aria-label="Deal"
                size="sm"
                className="flex-1"
                value={dealId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDealId(e.target.value)}
                options={[{ value: '', label: 'Select a deal…' }, ...unlinked.map((d) => ({ value: d.id, label: d.name }))]}
            />
            <Select
                name="stakeholder-involvement"
                aria-label="Involvement role"
                size="sm"
                value={role}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value)}
                options={INVOLVEMENT_ROLES.map((r) => ({ value: r, label: r.replace(/_/g, ' ') }))}
            />
            <Button type="button" size="sm" onClick={handleLink} disabled={!dealId || saving}>
                Link
            </Button>
        </div>
    );
};

export default StakeholderDealLinker;
