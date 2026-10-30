import React, { useEffect, useState } from 'react';
import { Search, Loader2, ChevronDown } from 'lucide-react';
import { useEntityTimeline } from './timeline/useEntityTimeline';
import TimelineEventCard from './timeline/TimelineEventCard';
import TimelineSummaryBanner from './timeline/TimelineSummaryBanner';
import { activitiesApi } from '../../services/crmService';
import { PromptDialog } from '../../components/PromptDialog';
import { useConfirm, Button, Drawer, SearchInput, ListFilters, type ListFilterConfig, type FilterValues } from '@so360/design-system';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    entityType: string;
    entityId: string;
}

const MODULE_FILTERS: { key: string; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'crm', label: 'CRM' },
    { key: 'documents', label: 'Documents' },
];

/** G8 Client 360: per-interaction-type chips (multi-select). Keys match the backend's normalized `type`. */
export const TYPE_FILTERS: { key: string; label: string }[] = [
    { key: 'call', label: 'Calls' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'email', label: 'Email' },
    { key: 'meeting', label: 'Meetings' },
    { key: 'task', label: 'Tasks' },
    { key: 'note', label: 'Notes' },
    { key: 'document', label: 'Documents' },
    { key: 'booking', label: 'Bookings' },
];

/**
 * Task 4 (Customer Timeline): full-history view built on the SAME
 * useEntityTimeline hook + TimelineEventCard used by the inline Activity tab
 * preview in LeadDetailPage.tsx — replaces the drawer's own duplicated
 * aggregation logic (formerly a second copy of getAggregatedTimeline()).
 */
const ActivityHistoryDrawer: React.FC<Props> = ({ isOpen, onClose, entityType, entityId }) => {
    const [confirm, confirmDialog] = useConfirm();
    const [editActivity, setEditActivity] = useState<null | { id: string; relatedId?: string | null; description: string }>(null);
    const timeline = useEntityTimeline({ entityType, entityId, pageSize: 50 });

    useEffect(() => {
        if (isOpen) timeline.refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, entityType, entityId]);

    if (!isOpen) return null;

    const filterConfig: ListFilterConfig = {
        fields: [
            { key: 'module', label: 'Module', type: 'select', quick: true, options: MODULE_FILTERS.filter((m) => m.key).map((m) => ({ value: m.key, label: m.label })) },
            {
                key: 'types', label: 'Interaction type', type: 'multiselect',
                options: TYPE_FILTERS.map((t) => {
                    const count = timeline.summary?.type_counts?.[t.key];
                    return { value: t.key, label: count !== undefined ? `${t.label} (${count})` : t.label };
                }),
            },
        ],
        values: {
            ...(timeline.moduleFilter ? { module: timeline.moduleFilter } : {}),
            ...(timeline.typeFilter.length > 0 ? { types: timeline.typeFilter } : {}),
        } as FilterValues,
        onChange: (next: FilterValues) => {
            timeline.setModuleFilter((next.module as string) || '');
            timeline.setTypeFilter(Array.isArray(next.types) ? (next.types as string[]) : []);
        },
        onClear: () => { timeline.setModuleFilter(''); timeline.setTypeFilter([]); },
    };

    return (
        <>
            {confirmDialog}
            <PromptDialog
                open={!!editActivity}
                title="Edit activity"
                fields={[{ name: 'notes', label: 'Activity notes', initialValue: editActivity?.description ?? '', multiline: true }]}
                onSubmit={async (v) => {
                    if (editActivity?.relatedId) {
                        await activitiesApi.update(editActivity.relatedId, { notes: v.notes });
                        timeline.updateEventDescription(editActivity.id, v.notes);
                    }
                    setEditActivity(null);
                }}
                onClose={() => setEditActivity(null)}
            />
            <Drawer
                isOpen={isOpen}
                onClose={onClose}
                title="Activity History"
                subtitle={timeline.events.length > 0 ? `${timeline.events.length} loaded` : 'Loading…'}
                size="md"
                data-testid="activity-history-drawer"
            >
              <div className="-mx-6 -my-5">
                {/* Search + Comb filters (module quick; interaction types in the drawer) */}
                <div className="px-4 py-3 border-b border-line shrink-0 flex flex-col gap-nb-2">
                    <SearchInput
                        name="activity-search"
                        aria-label="Search activities"
                        placeholder="Search activities…"
                        value={timeline.search}
                        onChange={timeline.setSearch}
                    />
                    <div className="flex flex-wrap items-center gap-nb-2">
                        <ListFilters {...filterConfig} />
                    </div>
                </div>

                {timeline.summary && (
                    <div className="px-4 py-3 border-b border-line shrink-0">
                        <TimelineSummaryBanner summary={timeline.summary} />
                    </div>
                )}

                {/* Timeline */}
                <div>
                    {timeline.loading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-fg-muted">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-xs">Loading history…</span>
                        </div>
                    ) : timeline.events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-fg-muted px-6 text-center">
                            <Search size={32} className="mb-3 text-fg" />
                            <p className="text-xs font-medium text-fg-subtle">
                                {timeline.search || timeline.moduleFilter || timeline.typeFilter.length > 0 ? 'No matching activities' : 'No Activity Yet'}
                            </p>
                            <p className="text-xs text-fg-muted mt-1">
                                {timeline.search || timeline.moduleFilter || timeline.typeFilter.length > 0
                                    ? 'Try adjusting your search or filter.'
                                    : 'Activities will appear here automatically when users interact with this record.'}
                            </p>
                        </div>
                    ) : (
                        <div className="px-4 py-4 space-y-2">
                            {timeline.events.map(event => (
                                <TimelineEventCard
                                    key={event.id}
                                    event={event}
                                    isPinned={timeline.pinnedIds.has(event.id)}
                                    onTogglePin={timeline.togglePin}
                                    onEdit={(e) => setEditActivity({ id: e.id, relatedId: e.related_id, description: e.description })}
                                    onDelete={async (e) => {
                                        if (await confirm({ title: 'Delete?', message: 'Delete this activity?', intent: 'danger', confirmLabel: 'Delete' }) && e.related_id) {
                                            await activitiesApi.delete(e.related_id);
                                            timeline.removeEvent(e.id);
                                        }
                                    }}
                                />
                            ))}

                            {/* Load More */}
                            {timeline.hasMore && (
                                <div className="flex justify-center pt-2 pb-4">
                                    <Button type="button" variant="secondary" size="sm" onClick={timeline.loadMore} disabled={timeline.loadingMore}>
                                        {timeline.loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                                        {timeline.loadingMore ? 'Loading…' : 'Load More'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
              </div>
            </Drawer>
        </>
    );
};

export default ActivityHistoryDrawer;
