import React, { useEffect } from 'react';
import { X, Search, Loader2, ChevronDown } from 'lucide-react';
import { useEntityTimeline } from './timeline/useEntityTimeline';
import TimelineEventCard from './timeline/TimelineEventCard';
import TimelineSummaryBanner from './timeline/TimelineSummaryBanner';
import { activitiesApi } from '../../services/crmService';

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

/**
 * Task 4 (Customer Timeline): full-history view built on the SAME
 * useEntityTimeline hook + TimelineEventCard used by the inline Activity tab
 * preview in LeadDetailPage.tsx — replaces the drawer's own duplicated
 * aggregation logic (formerly a second copy of getAggregatedTimeline()).
 */
const ActivityHistoryDrawer: React.FC<Props> = ({ isOpen, onClose, entityType, entityId }) => {
    const timeline = useEntityTimeline({ entityType, entityId, pageSize: 50 });

    useEffect(() => {
        if (isOpen) timeline.refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, entityType, entityId]);

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Drawer — starts below the shell's fixed 56px (h-14) glass-nav header so the title/close controls are never clipped */}
            <div className="fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-full sm:w-[480px] lg:w-[520px] bg-slate-950 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
                    <div>
                        <p className="text-xs font-black text-slate-50 uppercase tracking-widest">Activity History</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            {timeline.events.length > 0 ? `${timeline.events.length} loaded` : 'Loading…'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800">
                        <X size={16} />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-slate-800 shrink-0">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search activities…"
                            value={timeline.search}
                            onChange={e => timeline.setSearch(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="px-4 py-2.5 border-b border-slate-800 shrink-0 overflow-x-auto">
                    <div className="flex gap-1.5 min-w-max">
                        {MODULE_FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => timeline.setModuleFilter(f.key)}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${
                                    timeline.moduleFilter === f.key
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {timeline.summary && (
                    <div className="px-4 py-3 border-b border-slate-800 shrink-0">
                        <TimelineSummaryBanner summary={timeline.summary} />
                    </div>
                )}

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto">
                    {timeline.loading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-xs">Loading history…</span>
                        </div>
                    ) : timeline.events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500 px-6 text-center">
                            <Search size={32} className="mb-3 text-slate-700" />
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                {timeline.search || timeline.moduleFilter ? 'No matching activities' : 'No Activity Yet'}
                            </p>
                            <p className="text-[11px] text-slate-600 mt-1">
                                {timeline.search || timeline.moduleFilter
                                    ? 'Try adjusting your search or filter.'
                                    : 'Activities will appear here automatically when users interact with this lead.'}
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
                                        if (confirm('Delete this activity?') && e.related_id) {
                                            await activitiesApi.delete(e.related_id);
                                            timeline.removeEvent(e.id);
                                        }
                                    }}
                                />
                            ))}

                            {/* Load More */}
                            {timeline.hasMore && (
                                <div className="flex justify-center pt-2 pb-4">
                                    <button
                                        onClick={timeline.loadMore}
                                        disabled={timeline.loadingMore}
                                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {timeline.loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                                        {timeline.loadingMore ? 'Loading…' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ActivityHistoryDrawer;
