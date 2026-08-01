import React, { useState, useMemo, useCallback } from 'react';
import {
    Clock, MessageCircle, CheckCircle2, File, ChevronDown,
    Edit2, Trash2, Download, Eye, Loader2, Plus, UploadCloud,
    FileIcon, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Activity, Note, Task, Attachment } from '../types/crm';
import { useCRMFormatters } from '../utils/formatters';

export type TimelineItemType = 'activity' | 'note' | 'task' | 'document';

interface TimelineItem {
    id: string;
    type: TimelineItemType;
    title: string;
    description?: string;
    date: string;
    actor?: string;
    status?: string;
    data: Activity | Note | Task | Attachment;
}

interface UnifiedTimelinePanelProps {
    activities: Activity[];
    notes: Note[];
    tasks: Task[];
    documents: Attachment[];
    onNoteEdit?: (note: Note) => void;
    onNoteDelete?: (noteId: string) => void;
    onTaskEdit?: (task: Task) => void;
    onTaskToggle?: (task: Task) => void;
    onDocumentDelete?: (docId: string) => void;
    onDocumentView?: (doc: Attachment) => void;
    onDocumentDownload?: (doc: Attachment) => void;
    isLoading?: boolean;
    leadId?: string;
}

const UnifiedTimelinePanel: React.FC<UnifiedTimelinePanelProps> = ({
    activities = [],
    notes = [],
    tasks = [],
    documents = [],
    onNoteEdit,
    onNoteDelete,
    onTaskEdit,
    onTaskToggle,
    onDocumentDelete,
    onDocumentView,
    onDocumentDownload,
    isLoading = false,
    leadId,
}) => {
    const formatters = useCRMFormatters();
    const [filterType, setFilterType] = useState<'all' | TimelineItemType>('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);

    // Build unified timeline items
    const allItems: TimelineItem[] = useMemo(() => {
        const items: TimelineItem[] = [];

        // Add activities
        activities.forEach((activity) => {
            items.push({
                id: `activity-${activity.id}`,
                type: 'activity',
                title: activity.type || 'Activity',
                description: activity.notes,
                date: activity.created_at,
                actor: activity.author?.full_name || 'Unknown',
                data: activity,
            });
        });

        // Add notes
        notes.forEach((note) => {
            const text = note.content?.replace(/<[^>]*>/g, '') || '';
            items.push({
                id: `note-${note.id}`,
                type: 'note',
                title: text.slice(0, 100) || 'Note',
                description: text,
                date: note.created_at,
                actor: note.author?.full_name || 'Unknown',
                data: note,
            });
        });

        // Add tasks
        tasks.forEach((task) => {
            items.push({
                id: `task-${task.id}`,
                type: 'task',
                title: task.title || 'Untitled Task',
                description: task.description,
                date: task.due_date || task.created_at,
                status: task.status,
                data: task,
            });
        });

        // Add documents
        documents.forEach((doc) => {
            items.push({
                id: `doc-${doc.id}`,
                type: 'document',
                title: doc.name,
                date: doc.uploaded_at,
                actor: doc.uploaded_by?.full_name || 'Unknown',
                data: doc,
            });
        });

        return items;
    }, [activities, notes, tasks, documents]);

    // Filter items
    const filteredItems = useMemo(() => {
        return filterType === 'all'
            ? allItems
            : allItems.filter((item) => item.type === filterType);
    }, [allItems, filterType]);

    // Sort items
    const sortedItems = useMemo(() => {
        const sorted = [...filteredItems];
        sorted.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
        return sorted;
    }, [filteredItems, sortOrder]);

    const getItemIcon = (type: TimelineItemType) => {
        switch (type) {
            case 'activity':
                return <Clock size={14} className="text-slate-500" />;
            case 'note':
                return <MessageCircle size={14} className="text-blue-500" />;
            case 'task':
                return <CheckCircle2 size={14} className="text-yellow-500" />;
            case 'document':
                return <File size={14} className="text-gray-500" />;
        }
    };

    const getItemColor = (type: TimelineItemType) => {
        switch (type) {
            case 'activity':
                return 'text-slate-400';
            case 'note':
                return 'text-blue-400';
            case 'task':
                return 'text-yellow-400';
            case 'document':
                return 'text-gray-400';
        }
    };

    const getStatusBadgeColor = (status?: string) => {
        if (!status) return '';
        switch (status.toUpperCase()) {
            case 'DONE':
            case 'COMPLETED':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'OPEN':
                return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            case 'IN_PROGRESS':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default:
                return 'bg-slate-800 text-slate-400 border-slate-700';
        }
    };

    const renderItemContent = (item: TimelineItem) => {
        switch (item.type) {
            case 'activity': {
                const activity = item.data as Activity;
                const isExpanded = expandedActivityId === item.id;
                return (
                    <div
                        className="cursor-pointer hover:bg-slate-800/50 rounded-lg transition-colors p-2 -mx-2"
                        onClick={() => setExpandedActivityId(isExpanded ? null : item.id)}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-200">
                                    {activity.type || 'Activity'}
                                </p>
                                {activity.notes && (
                                    <p className="text-xs text-slate-400 mt-2 whitespace-pre-wrap line-clamp-2">
                                        {activity.notes}
                                    </p>
                                )}
                            </div>
                            {activity.notes && (
                                <ChevronDown
                                    size={14}
                                    className={`text-slate-500 transition-transform shrink-0 ml-2 ${
                                        isExpanded ? 'rotate-180' : ''
                                    }`}
                                />
                            )}
                        </div>
                    </div>
                );
            }

            case 'note': {
                const note = item.data as Note;
                return (
                    <div className="group/note">
                        <p className="text-sm text-slate-300 line-clamp-2">
                            {item.description}
                        </p>
                        <div className="flex gap-2 mt-2 opacity-0 group-hover/note:opacity-100 transition-opacity">
                            {onNoteEdit && (
                                <button
                                    onClick={() => onNoteEdit(note)}
                                    className="p-1 text-slate-500 hover:text-blue-400 transition-colors"
                                    title="Edit note"
                                >
                                    <Edit2 size={12} />
                                </button>
                            )}
                            {onNoteDelete && (
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this note?')) {
                                            onNoteDelete(note.id);
                                        }
                                    }}
                                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                    title="Delete note"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                );
            }

            case 'task': {
                const task = item.data as Task;
                return (
                    <Link
                        to={`/crm/tasks/${task.id}`}
                        className="block group/task hover:bg-slate-800/50 rounded-lg transition-colors p-2 -mx-2"
                    >
                        <div className="flex items-center gap-3">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    onTaskToggle?.(task);
                                }}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    task.status === 'DONE'
                                        ? 'bg-emerald-500/10 border-emerald-500'
                                        : 'border-slate-700 group-hover/task:border-blue-500'
                                }`}
                            >
                                <CheckCircle2
                                    size={10}
                                    className={`transition-opacity ${
                                        task.status === 'DONE'
                                            ? 'opacity-100 text-emerald-500'
                                            : 'opacity-0 group-hover/task:opacity-20 text-blue-500'
                                    }`}
                                />
                            </button>
                            <div className="flex-1 min-w-0">
                                <p
                                    className={`text-sm font-bold group-hover/task:text-blue-400 transition-colors ${
                                        task.status === 'DONE'
                                            ? 'line-through text-slate-500'
                                            : 'text-slate-200'
                                    }`}
                                >
                                    {task.title}
                                </p>
                            </div>
                            <span
                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border shrink-0 ${getStatusBadgeColor(
                                    task.status
                                )}`}
                            >
                                {task.status}
                            </span>
                        </div>
                        {task.description && (
                            <p className="text-xs text-slate-400 mt-1 ml-7 line-clamp-1">
                                {task.description}
                            </p>
                        )}
                    </Link>
                );
            }

            case 'document': {
                const doc = item.data as Attachment;
                return (
                    <div className="flex items-center gap-3 group/doc">
                        <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-blue-500 border border-slate-800 group-hover/doc:scale-105 transition-transform">
                            <FileIcon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-200 truncate">
                                {doc.name}
                            </p>
                            <p className="text-xs text-slate-500">
                                {(doc.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                            {onDocumentView && (
                                <button
                                    onClick={() => onDocumentView(doc)}
                                    className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded transition-all"
                                    title="View"
                                >
                                    <Eye size={12} />
                                </button>
                            )}
                            {onDocumentDownload && (
                                <button
                                    onClick={() => onDocumentDownload(doc)}
                                    className="p-1.5 text-slate-500 hover:text-slate-50 hover:bg-slate-800 rounded transition-all"
                                    title="Download"
                                >
                                    <Download size={12} />
                                </button>
                            )}
                            {onDocumentDelete && (
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this document?')) {
                                            onDocumentDelete(doc.id);
                                        }
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                                    title="Delete"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                );
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 size={20} className="animate-spin" />
            </div>
        );
    }

    const isEmpty = allItems.length === 0;

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex items-center gap-4 flex-wrap">
                {/* Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-black text-slate-300 uppercase tracking-widest hover:border-slate-700 transition-colors"
                    >
                        <span>Filter:</span>
                        <span className="text-blue-400">
                            {filterType === 'all'
                                ? 'All'
                                : filterType.charAt(0).toUpperCase() +
                                  filterType.slice(1)}
                        </span>
                        <ChevronDown size={10} />
                    </button>
                    {showFilterDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-lg z-10 min-w-max">
                            {(['all', 'activity', 'note', 'task', 'document'] as const).map(
                                (type) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setFilterType(type);
                                            setShowFilterDropdown(false);
                                        }}
                                        className={`block w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                                            filterType === type
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                        }`}
                                    >
                                        {type === 'all'
                                            ? 'All Items'
                                            : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-black text-slate-300 uppercase tracking-widest hover:border-slate-700 transition-colors"
                    >
                        <span>Sort:</span>
                        <span className="text-blue-400">
                            {sortOrder === 'newest'
                                ? 'Newest First'
                                : 'Oldest First'}
                        </span>
                        <ChevronDown size={10} />
                    </button>
                    {showSortDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-lg z-10 min-w-max">
                            {(['newest', 'oldest'] as const).map((order) => (
                                <button
                                    key={order}
                                    onClick={() => {
                                        setSortOrder(order);
                                        setShowSortDropdown(false);
                                    }}
                                    className={`block w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                                        sortOrder === order
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                                >
                                    {order === 'newest'
                                        ? 'Newest First'
                                        : 'Oldest First'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Item count */}
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {sortedItems.length} of {allItems.length} items
                </span>
            </div>

            {/* Empty state */}
            {isEmpty ? (
                <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                    <Clock size={40} className="mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-bold uppercase tracking-widest mb-1">
                        No timeline items yet
                    </p>
                    <p className="text-xs text-slate-400 lowercase italic">
                        Activities, notes, tasks, and documents will appear here.
                    </p>
                </div>
            ) : sortedItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    <p className="text-sm font-bold uppercase tracking-widest">
                        No items match your filter
                    </p>
                </div>
            ) : (
                /* Timeline */
                <div className="space-y-3 relative">
                    {/* Vertical line */}
                    <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-slate-700 to-slate-800/30" />

                    {sortedItems.map((item) => (
                        <div
                            key={item.id}
                            className="flex gap-4 relative"
                            data-testid={`timeline-item-${item.type}-${item.id}`}
                        >
                            {/* Dot */}
                            <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center shrink-0 mt-1 relative z-10">
                                {getItemIcon(item.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pt-2 pb-6">
                                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`text-[10px] font-black uppercase tracking-widest ${getItemColor(
                                                    item.type
                                                )}`}
                                            >
                                                {item.type.charAt(0).toUpperCase() +
                                                    item.type.slice(1)}
                                            </span>
                                            {item.status && (
                                                <span
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${getStatusBadgeColor(
                                                        item.status
                                                    )}`}
                                                >
                                                    {item.status}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold">
                                            {formatters.formatDate(item.date)}
                                        </span>
                                    </div>

                                    {/* Item content */}
                                    {renderItemContent(item)}

                                    {/* Footer with actor info */}
                                    {item.actor && (
                                        <div className="text-[9px] text-slate-500 mt-3 pt-3 border-t border-slate-800">
                                            by {item.actor}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UnifiedTimelinePanel;
