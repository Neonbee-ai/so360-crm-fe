import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SortableHeader } from '@so360/design-system';
import { Task } from '../../types/crm';
import { TaskBucket, TaskSortField, TaskSectionData } from '../../utils/taskListFilters';

export interface TaskColumn {
    key: string;
    header: string;
    /** Server-sortable field; columns without one render a plain header. */
    sortField?: TaskSortField;
    render: (task: Task) => React.ReactNode;
}

interface TaskListSectionsProps {
    columns: TaskColumn[];
    sections: TaskSectionData[];
    /** false = one flat group (manual sort), no section headers. */
    showSectionHeaders: boolean;
    sort: { field: string; direction: 'asc' | 'desc' | null } | null;
    onSort: (field: string) => void;
    onRowClick: (task: Task) => void;
}

const SECTION_STYLES: Record<TaskBucket, { header: string; count: string }> = {
    overdue: { header: 'text-rose-300 bg-rose-950/80 border-rose-500/40', count: 'bg-rose-500/20 text-rose-300' },
    today: { header: 'text-amber-300 bg-slate-900', count: 'bg-amber-500/15 text-amber-300' },
    upcoming: { header: 'text-slate-200 bg-slate-900', count: 'bg-slate-700 text-slate-300' },
    no_due: { header: 'text-slate-300 bg-slate-900', count: 'bg-slate-700 text-slate-300' },
    done: { header: 'text-emerald-300 bg-slate-900', count: 'bg-emerald-500/15 text-emerald-300' },
};

/**
 * One table, one column header, and a sticky header row per smart-order
 * section. Sections are collapsible (Done starts collapsed) and each shows an
 * empty state when it has nothing in it.
 */
export const TaskListSections = ({ columns, sections, showSectionHeaders, sort, onSort, onRowClick }: TaskListSectionsProps) => {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true });
    const toggle = (bucket: string) => setCollapsed(prev => ({ ...prev, [bucket]: !prev[bucket] }));

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50 shadow-sm">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 border-b border-slate-700/50">
                    <tr>
                        {columns.map(col => (
                            <SortableHeader
                                key={col.key}
                                label={col.header}
                                field={col.sortField ?? col.key}
                                sortable={!!col.sortField}
                                currentSort={sort}
                                onSort={onSort}
                            />
                        ))}
                    </tr>
                </thead>
                {sections.map(section => {
                    const isCollapsed = showSectionHeaders && !!collapsed[section.bucket];
                    const styles = SECTION_STYLES[section.bucket];
                    return (
                        <tbody key={section.bucket} data-testid={`task-section-${section.bucket}`} className="divide-y divide-slate-800">
                            {showSectionHeaders && (
                                <tr>
                                    <th
                                        colSpan={columns.length}
                                        scope="colgroup"
                                        className={`sticky top-0 z-10 p-0 text-left border-y ${styles.header}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => toggle(section.bucket)}
                                            aria-expanded={!isCollapsed}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest"
                                        >
                                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                            {section.label}
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${styles.count}`}>{section.count}</span>
                                        </button>
                                    </th>
                                </tr>
                            )}
                            {!isCollapsed && section.tasks.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length} className="px-6 py-4 text-xs text-slate-500">
                                        {section.count > 0 ? 'Not loaded yet. Use "Load more" below.' : section.empty}
                                    </td>
                                </tr>
                            )}
                            {!isCollapsed && section.tasks.map(task => (
                                <tr
                                    key={task.id}
                                    data-testid={`task-row-${task.id}`}
                                    onClick={() => onRowClick(task)}
                                    className={`cursor-pointer transition-colors hover:bg-blue-500/5 ${section.bucket === 'overdue' ? 'border-l-2 border-l-rose-500 bg-rose-500/[0.03]' : ''}`}
                                >
                                    {columns.map(col => (
                                        <td key={col.key} className="px-4 py-3 align-middle">
                                            {col.render(task)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    );
                })}
            </table>
        </div>
    );
};
