import React, { useEffect } from 'react';
import { Search, Loader2, ChevronDown } from 'lucide-react';
import { useEntityTimeline } from './timeline/useEntityTimeline';
import TimelineEventCard from './timeline/TimelineEventCard';
import TimelineSummaryBanner from './timeline/TimelineSummaryBanner';
import { activitiesApi } from '../../services/crmService';
import { useConfirm, Button, Drawer, TextField } from '@so360/design-system';

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
    const timeline = useEntityTimeline({ entityType, entityId, pageSize: 50 });

    useEffect(() => {
        if (isOpen) timeline.refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, entityType, entityId]);

    if (!isOpen) return null;

    return (
        <>
            {confirmDialog}
            <Drawer
                isOpen={isOpen}
                onClose={onClose}
                title="Activity History"
                subtitle={timeline.events.length > 0 ? `${timeline.events.length} loaded` : 'Loading…'}
                size="md"
                data-testid="activity-history-drawer"
            >
              <div className="-mx-6 -my-5">
                {/* Search */}
                <div className="px-4 py-3 border-b border-line shrink-0">
                    <TextField
                        name="activity-search"
                        aria-label="Search activities"
                        type="text"
                        size="sm"
                        leadingIcon={Search}
                        placeholder="Search activities…"
                        value={timeline.search}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => timeline.setSearch(e.target.value)}
                    />
                </div>

                {/* Filters */}
                <div className="px-4 py-2.5 border-b border-line shrink-0 overflow-x-auto">
                    <div className="flex gap-1.5 min-w-max">
                        {MODULE_FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => timeline.setModuleFilter(f.key)}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
 timeline.moduleFilter === f.key
 ? 'bg-primary text-primary-fg'
 : 'bg-surface-raised text-fg-subtle hover:text-fg hover:bg-line'
 }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* G8 Client 360: interaction-type chips */}
                <div className="px-4 py-2.5 border-b border-line shrink-0 overflow-x-auto" role="group" aria-label="Filter by interaction type">
                    <div className="flex gap-1.5 min-w-max">
                        <button
                            type="button"
                            aria-pressed={timeline.typeFilter.length === 0}
                            onClick={() => timeline.setTypeFilter([])}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
 timeline.typeFilter.length === 0
 ? 'bg-primary text-primary-fg'
 : 'bg-surface-raised text-fg-subtle hover:text-fg hover:bg-line'
 }`}
                        >
                            All types
                        </button>
                        {TYPE_FILTERS.map(t => {
                            const active = timeline.typeFilter.includes(t.key);
                            const count = timeline.summary?.type_counts?.[t.key];
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    aria-pressed={active}
                                    data-testid={`type-chip-${t.key}`}
                                    onClick={() => timeline.toggleType(t.key)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
 active
 ? 'bg-primary text-primary-fg'
 : 'bg-surface-raised text-fg-subtle hover:text-fg hover:bg-line'
 }`}
                                >
                                    {t.label}
                                    {count !== undefined && <span className="ml-1 opacity-70">({count})</span>}
                                </button>
                            );
                        })}
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
                                    onEdit={async (e) => {
                                        const newNotes = prompt('Edit activity notes:', e.description);
                                        if (newNotes !== null && e.related_id) {
                                            await activitiesApi.update(e.related_id, { notes: newNotes });
                                            timeline.updateEventDescription(e.id, newNotes);
                                        }
                                    }}
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
