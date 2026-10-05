import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { TaskListFilters } from '../../utils/taskListFilters';
import {
    filtersForView,
    filtersFromViewConfig,
    hasNoFilters,
    sameFilters,
    systemTaskViews,
} from '../../utils/taskViews';
import { TaskViewsApi } from '../../hooks/useTaskViews';

interface TaskSavedViewsProps {
    filters: TaskListFilters;
    currentUserId?: string;
    taskViews: TaskViewsApi;
    onApply: (filters: TaskListFilters) => void;
}

const MAX_NAME = 120;

const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition-all ${active
        ? 'border-blue-500 bg-blue-600/20 text-slate-50'
        : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
        }`;

/**
 * Saved-view chips under the counter strip: the built-in views (always
 * there), then the user's own saved views. A view is only a set of filters
 * (the My / Team / All tab is not part of it), applied by replacing the
 * current ones. The server still clamps every list request to what the caller
 * may see, so a view can never reveal more. Views are private to the owner.
 */
export const TaskSavedViews = ({ filters, currentUserId, taskViews, onApply }: TaskSavedViewsProps) => {
    const [naming, setNaming] = useState<string | null>(null);
    const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const system = systemTaskViews(currentUserId);
    const own = taskViews.available
        ? taskViews.views.map(v => ({ view: v, filters: filtersFromViewConfig(v.config, filters.scope) }))
        : [];

    const matchesAny =
        system.some(v => sameFilters(filtersForView(v, filters.scope), filters)) ||
        own.some(o => sameFilters(o.filters, filters));
    const canSave = taskViews.available && !hasNoFilters(filters) && !matchesAny;

    const submitSave = async () => {
        // Only reachable while the name box is open (naming is a string).
        const name = naming!.trim();
        if (!name) return;
        if (await taskViews.save(name, filters)) setNaming(null);
    };

    const submitRename = async () => {
        // Only reachable while the rename box is open.
        const current = renaming!;
        const name = current.name.trim();
        if (!name) return;
        if (await taskViews.rename(current.id, name)) setRenaming(null);
    };

    return (
        <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="task-views" role="group" aria-label="Saved views">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Views</span>
            {system.map(v => {
                const next = filtersForView(v, filters.scope);
                return (
                    <button
                        key={v.id}
                        type="button"
                        aria-pressed={sameFilters(next, filters)}
                        onClick={() => onApply(next)}
                        className={chipClass(sameFilters(next, filters))}
                    >
                        {v.name}
                    </button>
                );
            })}

            {own.map(({ view, filters: viewFilters }) => (
                <span key={view.id} className="relative inline-flex items-center gap-1" data-testid={`task-view-${view.id}`}>
                    {renaming?.id === view.id ? (
                        <>
                            <input
                                aria-label="View name"
                                value={renaming.name}
                                maxLength={MAX_NAME}
                                onChange={e => setRenaming({ id: view.id, name: e.target.value })}
                                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                            />
                            <button type="button" onClick={submitRename} className="text-xs font-semibold text-blue-300">Save name</button>
                            <button type="button" onClick={() => setRenaming(null)} className="text-xs text-slate-400">Cancel</button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                aria-pressed={sameFilters(viewFilters, filters)}
                                onClick={() => onApply(viewFilters)}
                                className={`${chipClass(sameFilters(viewFilters, filters))} inline-flex items-center gap-1`}
                            >
                                {view.is_default && <Star size={11} className="text-amber-400" aria-label="Default view" />}
                                {view.name}
                            </button>
                            <button
                                type="button"
                                aria-label={`Manage view ${view.name}`}
                                aria-expanded={menuFor === view.id}
                                onClick={() => {
                                    setMenuFor(menuFor === view.id ? null : view.id);
                                    setConfirmDelete(null);
                                }}
                                className="rounded px-1 text-xs text-slate-400 hover:bg-slate-800"
                            >
                                ...
                            </button>
                            {menuFor === view.id && (
                                <span className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRenaming({ id: view.id, name: view.name });
                                            setMenuFor(null);
                                        }}
                                        className="text-slate-200 hover:text-white"
                                    >
                                        Rename
                                    </button>
                                    <button
                                        type="button"
                                        disabled={view.is_default}
                                        onClick={async () => {
                                            await taskViews.setDefault(view.id);
                                            setMenuFor(null);
                                        }}
                                        className="text-slate-200 hover:text-white disabled:opacity-50"
                                    >
                                        {view.is_default ? 'Default view' : 'Set as default'}
                                    </button>
                                    {confirmDelete === view.id ? (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await taskViews.remove(view.id);
                                                setMenuFor(null);
                                                setConfirmDelete(null);
                                            }}
                                            className="font-semibold text-rose-300"
                                        >
                                            Confirm delete
                                        </button>
                                    ) : (
                                        <button type="button" onClick={() => setConfirmDelete(view.id)} className="text-rose-300 hover:text-rose-200">
                                            Delete
                                        </button>
                                    )}
                                </span>
                            )}
                        </>
                    )}
                </span>
            ))}

            {naming !== null ? (
                <span className="inline-flex items-center gap-1">
                    <input
                        aria-label="New view name"
                        autoFocus
                        value={naming}
                        maxLength={MAX_NAME}
                        placeholder="View name"
                        onChange={e => setNaming(e.target.value)}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                    />
                    <button type="button" onClick={submitSave} className="text-xs font-semibold text-blue-300">Save</button>
                    <button type="button" onClick={() => setNaming(null)} className="text-xs text-slate-400">Cancel</button>
                </span>
            ) : (
                canSave && (
                    <button
                        type="button"
                        onClick={() => setNaming('')}
                        className="rounded-full border border-dashed border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                        Save view
                    </button>
                )
            )}
        </div>
    );
};
