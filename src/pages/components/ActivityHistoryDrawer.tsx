import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X, Search, Phone, Users, AtSign, FileText, CheckCircle2,
    File, Briefcase, TrendingUp, BarChart3, Info, Loader2, ChevronDown,
} from 'lucide-react';
import { activitiesApi } from '../../services/crmService';
import { useCRMFormatters } from '../../utils/formatters';
import type { Lead, Task, Deal, Activity, User } from '../../types/crm';

type FilterType = 'ALL' | 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'STATUS_CHANGE' | 'NOTE' | 'DOCUMENT' | 'DEAL' | 'SYSTEM';

interface TimelineEvent {
    id: string;
    type: 'Activity' | 'NOTE' | 'TASK' | 'DOCUMENT' | 'DEAL' | 'STATUS_CHANGE' | 'STAGE_CHANGE' | 'OWNER_CHANGE' | 'PROFILE_UPDATE';
    subType?: string;
    title: string;
    description: string;
    date: string;
    author?: User;
}

interface DateGroup {
    label: string;
    events: TimelineEvent[];
}

const SYSTEM_TYPES = ['STATUS_CHANGE', 'STAGE_CHANGE', 'OWNER_CHANGE', 'PROFILE_UPDATE'];
const LOAD_BATCH = 50;

function getDateGroupLabel(date: string): string {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return 'Last 7 Days';
    if (diffDays <= 30) return 'Last 30 Days';
    return 'Older';
}

const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Older'];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    lead: Lead;
    associatedTasks: Task[];
    associatedDeals: Deal[];
}

const ActivityHistoryDrawer: React.FC<Props> = ({ isOpen, onClose, leadId, lead, associatedTasks, associatedDeals }) => {
    const formatters = useCRMFormatters();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

    const fetchActivities = useCallback(async (reset = false) => {
        const currentOffset = reset ? 0 : offset;
        if (reset) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }
        try {
            const result = await activitiesApi.getAllByLeadPaginated(leadId, LOAD_BATCH, currentOffset);
            setActivities(prev => reset ? result.data : [...prev, ...result.data]);
            setTotal(result.total);
            setOffset(currentOffset + result.data.length);
            setHasMore(currentOffset + result.data.length < result.total);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [leadId, offset]);

    useEffect(() => {
        if (isOpen) {
            setActivities([]);
            setOffset(0);
            setSearchQuery('');
            setActiveFilter('ALL');
            fetchActivities(true);
        }
    }, [isOpen, leadId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fullTimeline = useMemo((): TimelineEvent[] => {
        const events: TimelineEvent[] = [];

        activities.forEach(a => {
            const isSystem = SYSTEM_TYPES.includes(a.type);
            events.push({
                id: a.id,
                type: isSystem ? (a.type as any) : 'Activity',
                subType: isSystem ? undefined : a.type,
                title: isSystem ? a.type.replace(/_/g, ' ') : `${a.type} Logged`,
                description: a.notes,
                date: a.created_at || a.date,
                author: a.author,
            });
        });

        lead.notes?.forEach(n => {
            events.push({
                id: n.id,
                type: 'NOTE',
                title: 'Note Captured',
                description: n.content,
                date: n.created_at,
                author: n.author,
            });
        });

        lead.documents?.forEach(d => {
            events.push({
                id: d.id,
                type: 'DOCUMENT',
                title: 'Document Uploaded',
                description: `${d.name} (${(d.size / (1024 * 1024)).toFixed(2)} MB)`,
                date: d.created_at || d.uploaded_at,
                author: d.uploaded_by,
            });
        });

        associatedTasks.forEach(t => {
            events.push({
                id: t.id,
                type: 'TASK',
                subType: t.type,
                title: `Task: ${t.title}`,
                description: `Status: ${t.status} | Type: ${t.type}`,
                date: t.created_at || t.due_date,
                author: t.assigned_to,
            });
        });

        associatedDeals.forEach(d => {
            events.push({
                id: d.id,
                type: 'DEAL',
                title: 'Deal Created',
                description: `${d.name} | Stage: ${d.stage}`,
                date: d.created_at || d.expected_close_date,
                author: d.owner,
            });
        });

        return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [activities, lead, associatedTasks, associatedDeals]);

    const filteredTimeline = useMemo((): TimelineEvent[] => {
        let filtered = fullTimeline;

        if (activeFilter !== 'ALL') {
            filtered = filtered.filter(e => {
                if (activeFilter === 'SYSTEM') return SYSTEM_TYPES.includes(e.type as string);
                if (activeFilter === 'CALL') return e.type === 'Activity' && e.subType === 'CALL';
                if (activeFilter === 'EMAIL') return e.type === 'Activity' && e.subType === 'EMAIL';
                if (activeFilter === 'MEETING') return e.type === 'Activity' && e.subType === 'MEETING';
                if (activeFilter === 'TASK') return e.type === 'TASK';
                if (activeFilter === 'NOTE') return e.type === 'NOTE';
                if (activeFilter === 'DOCUMENT') return e.type === 'DOCUMENT';
                if (activeFilter === 'DEAL') return e.type === 'DEAL';
                if (activeFilter === 'STATUS_CHANGE') return e.type === 'STATUS_CHANGE';
                return true;
            });
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                e.title.toLowerCase().includes(q) ||
                (e.description || '').toLowerCase().includes(q) ||
                (e.author?.full_name || '').toLowerCase().includes(q)
            );
        }

        return filtered;
    }, [fullTimeline, activeFilter, searchQuery]);

    const groupedTimeline = useMemo((): DateGroup[] => {
        const groups: Record<string, TimelineEvent[]> = {};
        filteredTimeline.forEach(e => {
            const label = getDateGroupLabel(e.date);
            if (!groups[label]) groups[label] = [];
            groups[label].push(e);
        });
        return DATE_GROUP_ORDER
            .filter(label => groups[label]?.length)
            .map(label => ({ label, events: groups[label] }));
    }, [filteredTimeline]);

    function getEventIcon(event: TimelineEvent) {
        if (event.type === 'Activity') {
            if (event.subType === 'CALL') return <Phone size={13} className="text-blue-400" />;
            if (event.subType === 'MEETING') return <Users size={13} className="text-purple-400" />;
            if (event.subType === 'EMAIL') return <AtSign size={13} className="text-emerald-400" />;
            return <FileText size={13} className="text-amber-400" />;
        }
        if (event.type === 'NOTE') return <FileText size={13} className="text-amber-400" />;
        if (event.type === 'TASK') return <CheckCircle2 size={13} className="text-blue-500" />;
        if (event.type === 'DOCUMENT') return <File size={13} className="text-indigo-400" />;
        if (event.type === 'DEAL') return <Briefcase size={13} className="text-emerald-400" />;
        if (event.type === 'STATUS_CHANGE') return <TrendingUp size={13} className="text-blue-400" />;
        if (event.type === 'STAGE_CHANGE') return <BarChart3 size={13} className="text-purple-400" />;
        if (event.type === 'OWNER_CHANGE') return <Users size={13} className="text-pink-400" />;
        return <Info size={13} className="text-slate-400" />;
    }

    const filters: { key: FilterType; label: string }[] = [
        { key: 'ALL', label: 'All' },
        { key: 'CALL', label: 'Calls' },
        { key: 'EMAIL', label: 'Emails' },
        { key: 'MEETING', label: 'Meetings' },
        { key: 'TASK', label: 'Tasks' },
        { key: 'NOTE', label: 'Notes' },
        { key: 'DOCUMENT', label: 'Documents' },
        { key: 'DEAL', label: 'Deals' },
        { key: 'SYSTEM', label: 'System Events' },
    ];

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
                            {total > 0 ? `${total} total activities` : 'Loading…'}
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
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="px-4 py-2.5 border-b border-slate-800 shrink-0 overflow-x-auto">
                    <div className="flex gap-1.5 min-w-max">
                        {filters.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setActiveFilter(f.key)}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${
                                    activeFilter === f.key
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-xs">Loading history…</span>
                        </div>
                    ) : groupedTimeline.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500 px-6 text-center">
                            <FileText size={32} className="mb-3 text-slate-700" />
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                {searchQuery || activeFilter !== 'ALL' ? 'No matching activities' : 'No Activity Yet'}
                            </p>
                            <p className="text-[11px] text-slate-600 mt-1">
                                {searchQuery || activeFilter !== 'ALL'
                                    ? 'Try adjusting your search or filter.'
                                    : 'Activities will appear here automatically when users interact with this lead.'}
                            </p>
                        </div>
                    ) : (
                        <div className="px-4 py-4 space-y-6">
                            {groupedTimeline.map(group => (
                                <div key={group.label}>
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3 px-1">
                                        {group.label}
                                    </p>
                                    <div className="space-y-2 relative before:absolute before:left-3.5 before:top-1 before:bottom-1 before:w-px before:bg-slate-800">
                                        {group.events.map(event => (
                                            <div key={event.id} className="relative pl-9">
                                                <div className="absolute left-0 top-1.5 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center z-10">
                                                    {getEventIcon(event)}
                                                </div>
                                                <div className="bg-slate-900 border border-slate-800/50 p-3 rounded-lg hover:border-slate-700 transition-colors">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <span className="text-[11px] font-bold text-slate-200 uppercase tracking-tight leading-tight">{event.title}</span>
                                                        <span className="text-[9px] text-slate-600 font-mono shrink-0">{formatters.formatDateTime(event.date)}</span>
                                                    </div>
                                                    {event.description && (
                                                        <p className="text-[11px] text-slate-400 leading-relaxed">{event.description}</p>
                                                    )}
                                                    {event.author && (
                                                        <div className="mt-2 flex items-center gap-1.5">
                                                            <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-black overflow-hidden">
                                                                {event.author.avatar_url
                                                                    ? <img src={event.author.avatar_url} alt={event.author.full_name} />
                                                                    : (event.author.full_name?.charAt(0) || '?')}
                                                            </div>
                                                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{event.author.full_name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Load More */}
                            {hasMore && !searchQuery && activeFilter === 'ALL' && (
                                <div className="flex justify-center pt-2 pb-4">
                                    <button
                                        onClick={() => fetchActivities(false)}
                                        disabled={isLoadingMore}
                                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {isLoadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                                        {isLoadingMore ? 'Loading…' : `Load More (${total - offset} remaining)`}
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
