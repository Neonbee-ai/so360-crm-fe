import { useState, useEffect, useCallback, useMemo } from 'react';
import { timelineApi, EntityTimelineEvent, EntityTimelineSummary, TimelineFilters } from '../../../services/crmService';

export interface UseEntityTimelineOptions {
    entityType: string;
    entityId: string;
    pageSize?: number;
}

export function useEntityTimeline({ entityType, entityId, pageSize = 20 }: UseEntityTimelineOptions) {
    const [events, setEvents] = useState<EntityTimelineEvent[]>([]);
    const [summary, setSummary] = useState<EntityTimelineSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    const [search, setSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [range, setRange] = useState<TimelineFilters['range'] | ''>('');
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

    const buildFilters = useCallback((cursorValue?: string | null): TimelineFilters => ({
        search: search || undefined,
        module: moduleFilter || undefined,
        category: categoryFilter || undefined,
        range: (range || undefined) as TimelineFilters['range'],
        cursor: cursorValue || undefined,
        limit: pageSize,
    }), [search, moduleFilter, categoryFilter, range, pageSize]);

    const load = useCallback(async () => {
        if (!entityId) return;
        setLoading(true);
        setError(null);
        try {
            const result = await timelineApi.getTimeline(entityType, entityId, buildFilters());
            setEvents(result.data);
            setSummary(result.summary);
            setCursor(result.nextCursor);
            setHasMore(Boolean(result.nextCursor));
        } catch (err: any) {
            setError(err.message || 'Failed to load timeline');
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId, buildFilters]);

    const loadMore = useCallback(async () => {
        if (!cursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const result = await timelineApi.getTimeline(entityType, entityId, buildFilters(cursor));
            setEvents((prev) => [...prev, ...result.data]);
            setCursor(result.nextCursor);
            setHasMore(Boolean(result.nextCursor));
        } catch (err: any) {
            setError(err.message || 'Failed to load more timeline events');
        } finally {
            setLoadingMore(false);
        }
    }, [entityType, entityId, buildFilters, cursor, loadingMore]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityType, entityId, search, moduleFilter, categoryFilter, range]);

    const togglePin = useCallback((id: string) => {
        setPinnedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const orderedEvents = useMemo(() => {
        const pinned = events.filter((e) => pinnedIds.has(e.id));
        const rest = events.filter((e) => !pinnedIds.has(e.id));
        return [...pinned, ...rest];
    }, [events, pinnedIds]);

    const removeEvent = useCallback((id: string) => {
        setEvents((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const updateEventDescription = useCallback((id: string, description: string) => {
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, description } : e)));
    }, []);

    return {
        events: orderedEvents,
        summary,
        loading,
        loadingMore,
        error,
        hasMore,
        loadMore,
        refetch: load,
        search, setSearch,
        moduleFilter, setModuleFilter,
        categoryFilter, setCategoryFilter,
        range, setRange,
        pinnedIds, togglePin,
        removeEvent,
        updateEventDescription,
    };
}
