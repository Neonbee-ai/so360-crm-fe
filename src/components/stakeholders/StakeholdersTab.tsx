import React, { useState, useEffect, useCallback } from 'react';
import { Plus, SlidersHorizontal, List, Loader2, Users } from 'lucide-react';
import { stakeholderApi } from '../../services/crmService';
import { Stakeholder, Deal } from '../../types/crm';
import StakeholderCard from './StakeholderCard';
import StakeholderProfileModal from './StakeholderProfileModal';
import StakeholderHierarchyTree from './StakeholderHierarchyTree';
import StakeholderQuickActions from './StakeholderQuickActions';
import StakeholderActivitySummary from './StakeholderActivitySummary';
import StakeholderDealLinker from './StakeholderDealLinker';
import { useConfirm, Button, SearchInput, ListFilters, type ListFilterConfig, type FilterValues, IconButton } from '@so360/design-system';

interface Props {
    leadId: string;
    deals: Deal[];
    onSwitchToNotes?: () => void;
    onSwitchToCalls?: () => void;
    onSwitchToMeetings?: () => void;
}

const StakeholdersTab: React.FC<Props> = ({ leadId, deals, onSwitchToNotes, onSwitchToCalls, onSwitchToMeetings }) => {
    const [confirm, confirmDialog] = useConfirm();
    const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'hierarchy'>('list');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [strengthFilter, setStrengthFilter] = useState('');
    const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null | undefined>(undefined);
    const [quickActionsFor, setQuickActionsFor] = useState<Stakeholder | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await stakeholderApi.listByLead(leadId, {
                search: search || undefined,
                role: roleFilter || undefined,
                relationship_strength: strengthFilter || undefined,
            });
            setStakeholders(data);
        } finally {
            setLoading(false);
        }
    }, [leadId, search, roleFilter, strengthFilter]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (stakeholder: Stakeholder) => {
        if (!await confirm({ title: 'Remove?', message: `Remove ${stakeholder.full_name || 'this stakeholder'}?`, intent: 'danger', confirmLabel: 'Remove' })) return;
        await stakeholderApi.delete(stakeholder.id);
        load();
    };

    const handleSetManager = async (stakeholderId: string, managerId: string | null) => {
        await stakeholderApi.setHierarchy(stakeholderId, managerId);
        load();
    };

    const filterConfig: ListFilterConfig = {
        fields: [
            {
                key: 'strength', label: 'Relationship strength', type: 'select', quick: true,
                options: ['very_strong', 'strong', 'moderate', 'weak', 'no_relationship'].map((st) => ({ value: st, label: st.replace(/_/g, ' ') })),
            },
        ],
        values: (strengthFilter ? { strength: strengthFilter } : {}) as FilterValues,
        onChange: (next: FilterValues) => setStrengthFilter((next.strength as string) || ''),
        onClear: () => setStrengthFilter(''),
    };

    return (
        <div className="space-y-4">
            {confirmDialog}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-44">
                    <SearchInput
                        name="stakeholder-search"
                        aria-label="Search stakeholders"
                        value={search}
                        onChange={setSearch}
                        placeholder="Search stakeholders…"
                    />
                </div>
                <ListFilters {...filterConfig} />
                <div className="flex items-center gap-1 bg-surface border border-line rounded-nb p-1">
                    <IconButton label="List view" icon={<List size={14} />} onClick={() => setView('list')} aria-pressed={view === 'list'} />
                    <IconButton label="Hierarchy view" icon={<SlidersHorizontal size={14} />} onClick={() => setView('hierarchy')} aria-pressed={view === 'hierarchy'} />
                </div>
                <Button type="button" size="sm" onClick={() => setEditingStakeholder(null)}>
                    <Plus size={14} /> Add Stakeholder
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10 text-fg-muted"><Loader2 size={20} className="animate-spin" /></div>
            ) : stakeholders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-fg-muted">
                    <Users size={24} className="mb-2" />
                    <p className="text-xs">No stakeholders added yet.</p>
                </div>
            ) : view === 'hierarchy' ? (
                <StakeholderHierarchyTree stakeholders={stakeholders} onSetManager={handleSetManager} />
            ) : (
                <div className="space-y-3">
                    {stakeholders.map((s) => (
                        <div key={s.id}>
                            <StakeholderCard
                                stakeholder={s}
                                onEdit={setEditingStakeholder}
                                onDelete={handleDelete}
                                onOpenQuickActions={setQuickActionsFor}
                            />
                            <Button variant="secondary" size="sm" className="mt-1 ml-1" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                                {expandedId === s.id ? 'Hide activity' : 'Show activity'}
                            </Button>
                            {expandedId === s.id && (
                                <div className="mt-2 ml-1 space-y-3">
                                    <StakeholderActivitySummary stakeholderId={s.id} />
                                    <StakeholderDealLinker
                                        stakeholderId={s.id}
                                        availableDeals={deals}
                                        linkedDealIds={[]}
                                        onLinked={load}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {editingStakeholder !== undefined && (
                <StakeholderProfileModal
                    leadId={leadId}
                    stakeholder={editingStakeholder}
                    onClose={() => setEditingStakeholder(undefined)}
                    onSaved={load}
                />
            )}

            {quickActionsFor && (
                <StakeholderQuickActions
                    leadId={leadId}
                    stakeholder={quickActionsFor}
                    onClose={() => setQuickActionsFor(null)}
                    onLogCall={() => onSwitchToCalls?.()}
                    onScheduleMeeting={() => onSwitchToMeetings?.()}
                    onAddNote={() => onSwitchToNotes?.()}
                    onOpenProfile={(s) => { setQuickActionsFor(null); setEditingStakeholder(s); }}
                    onTaskCreated={load}
                />
            )}
        </div>
    );
};

export default StakeholdersTab;
