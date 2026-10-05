import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Trash2, UserPlus, Building2, Plus, Link2, ArrowDownWideNarrow } from 'lucide-react';
import { crmService } from '../services/crmService';
import { Task } from '../types/crm';
import { TableSkeleton } from '../components/common/Skeleton';
import { useShell, useShellBridge, useSandboxLimit } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { canCurrentUserBeAssigned, isTaskAssignedToUser, isTaskLocked, TASK_LOCKED_HINT } from '../utils/taskUtils';
import { describeTaskDue } from '../utils/taskDueLabel';
import {
    EMPTY_COUNTS,
    TASK_COUNTER_TILES,
    TASK_DUE_FILTER_OPTIONS,
    TASK_PAGE_SIZE,
    TASK_PRIORITY_FILTER_OPTIONS,
    TASK_REMINDER_FILTER_OPTIONS,
    TASK_STATUS_FILTER_OPTIONS,
    TASK_TYPE_FILTER_OPTIONS,
    TaskListCounts,
    TaskSortField,
    activeFilterValues,
    applyFilterChange,
    clearTaskFilters,
    groupTasksIntoSections,
    nextSort,
    parseTaskListFilters,
    serializeTaskListFilters,
    toTaskListApiParams,
    toggleQuickDue,
    TaskListFilters,
} from '../utils/taskListFilters';
import { Button, FilterBar, toast } from '@so360/design-system';
import TaskModal from './components/TaskModal';
import { TaskListSections, TaskColumn } from './components/TaskListSections';
import { TaskDueCell, TaskPriorityBadge, TaskReminderBadge, TaskTypeBadge } from './components/TaskCells';
import { TasksUpNext } from './components/TasksUpNext';
import { TaskSavedViews } from './components/TaskSavedViews';
import { useTaskViews } from '../hooks/useTaskViews';
import { filtersFromViewConfig, hasNoFilters } from '../utils/taskViews';
import { useListScrollRestore } from '../hooks/useListViewState';

const SEARCH_DEBOUNCE_MS = 300;
const MAX_REFRESH_PAGES = 4; // refresh re-reads up to 4 x 25 = the endpoint's 100-row cap

const SORT_LABELS: Record<TaskSortField, string> = { title: 'Task', due: 'Due Date', priority: 'Priority' };

const TasksPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const formatters = useCRMFormatters();
    const shell = useShell();
    const shellBridge = useShellBridge();
    const canCreateTask = (shellBridge?.permissionsLoaded === true) && (shellBridge?.hasPermission?.('activities.create') ?? false) && (shellBridge?.effectiveFlagsLoaded !== false) && (shellBridge?.isFeatureEnabled?.('action:crm:tasks:create') ?? true);
    // The backend clamps scope to what the caller actually holds regardless
    // of these flags (tasks.controller.ts TaskScope decorator) — these only
    // decide which tabs are worth rendering, never widen access on their own.
    const canViewTeamTasks = (shellBridge?.permissionsLoaded === true) && (shellBridge?.hasPermission?.('crm_tasks.view_team') ?? false);
    const canViewAllTasks = (shellBridge?.permissionsLoaded === true) && (shellBridge?.hasPermission?.('crm_tasks.view_all') ?? false);
    const { isSandboxMode, sandboxEntryLimit, isLimited } = useSandboxLimit();
    const currentUser = shell?.user;
    const currentUserId = currentUser?.id;
    const [tasks, setTasks] = useState<Task[]>([]);
    const [counts, setCounts] = useState<TaskListCounts>(EMPTY_COUNTS);
    const [total, setTotal] = useState(0);
    const [truncated, setTruncated] = useState(false);
    const [users, setUsers] = useState<any[]>([]); // Using any for User to avoid import issues if not exported
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [reloadTick, setReloadTick] = useState(0);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // All view state lives in the URL (scope, search, filters, sort), so a
    // filtered view survives the trip to a task's detail page and back, can be
    // bookmarked and shared. Only the loaded-page count is transient.
    const filters = useMemo(() => parseTaskListFilters(searchParams), [searchParams]);
    const queryKey = serializeTaskListFilters(filters).toString();
    const updateFilters = useCallback(
        (next: TaskListFilters) => setSearchParams(serializeTaskListFilters(next), { replace: true }),
        [setSearchParams],
    );

    // The search box is local so typing does not refetch on every keystroke;
    // the URL (and so the query) follows 300ms after the last one.
    const [searchInput, setSearchInput] = useState(filters.search);
    useEffect(() => {
        setSearchInput(filters.search);
    }, [filters.search]);
    useEffect(() => {
        if (searchInput === filters.search) return;
        const timer = setTimeout(() => updateFilters({ ...filters, search: searchInput }), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput, filters, updateFilters]);

    // Saved views. A default view is applied once, on arrival, and only when the
    // URL carries no filters of its own (a shared or restored link wins).
    const taskViews = useTaskViews();
    const defaultViewHandled = useRef(false);
    useEffect(() => {
        if (!taskViews.loaded || defaultViewHandled.current) return;
        defaultViewHandled.current = true;
        const defaultView = taskViews.views.find(v => v.is_default);
        if (defaultView && hasNoFilters(filters)) {
            updateFilters(filtersFromViewConfig(defaultView.config, filters.scope));
        }
    }, [taskViews.loaded, taskViews.views, filters, updateFilters]);

    const listAnchorRef = useRef<HTMLDivElement>(null);
    useListScrollRestore('tasks', listAnchorRef, !isLoading);

    useEffect(() => {
        crmService.getUsers().then(setUsers).catch(err => console.error('Failed to fetch users', err));
    }, []);

    // Pages already loaded for the current query. A filter change starts over;
    // a refresh (after an edit) re-reads everything loaded so far in one call.
    const pagesLoaded = useRef(1);
    const lastQueryKey = useRef(queryKey);
    useEffect(() => {
        let cancelled = false;
        if (lastQueryKey.current !== queryKey) {
            lastQueryKey.current = queryKey;
            pagesLoaded.current = 1;
            // Only a new query blanks the list; an edit refresh updates it in place.
            setIsLoading(true);
        }
        const pages = Math.min(pagesLoaded.current, MAX_REFRESH_PAGES);
        const fetchData = async () => {
            try {
                const res = await crmService.getTaskList(
                    toTaskListApiParams(filters, {
                        page: 1,
                        limit: TASK_PAGE_SIZE * pages,
                        tzOffsetMinutes: -new Date().getTimezoneOffset(),
                    }),
                );
                if (cancelled) return;
                pagesLoaded.current = pages;
                setTasks(res.items);
                setCounts(res.counts);
                setTotal(res.total);
                setTruncated(res.truncated);
                setError(null);
            } catch (err) {
                if (cancelled) return;
                console.error('Failed to fetch tasks', err);
                setError('Failed to load tasks. Please try again.');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchData();
        return () => {
            cancelled = true;
        };
        // `filters` is derived from queryKey; keying on the string avoids refetching on identity changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queryKey, reloadTick]);

    const reload = () => setReloadTick(t => t + 1);

    const handleLoadMore = async () => {
        setIsLoadingMore(true);
        try {
            const res = await crmService.getTaskList(
                toTaskListApiParams(filters, {
                    page: pagesLoaded.current + 1,
                    limit: TASK_PAGE_SIZE,
                    tzOffsetMinutes: -new Date().getTimezoneOffset(),
                }),
            );
            pagesLoaded.current += 1;
            setTasks(prev => {
                const seen = new Set(prev.map(t => t.id));
                return [...prev, ...res.items.filter(t => !seen.has(t.id))];
            });
            setCounts(res.counts);
            setTotal(res.total);
        } catch (err) {
            console.error('Failed to load more tasks', err);
            toast.error('Failed to load more tasks');
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleStatusChange = async (task: Task, newStatus: string) => {
        try {
            await crmService.updateTask(task.id, { status: newStatus });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as any } : t));
            // The task may now belong in another section and the counters moved.
            reload();
        } catch (error) {
            console.error('Failed to update task status', error);
        }
    };

    const handleAssigneeChange = async (task: Task, newAssigneeId: string) => {
        const newAssignee = users.find(u => u.id === newAssigneeId);
        if (!newAssignee) return;
        if (isTaskLocked(task.status)) {
            toast.warning(TASK_LOCKED_HINT);
            return;
        }

        try {
            await crmService.updateTask(task.id, { assignee_id: newAssigneeId });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, assigned_to: newAssignee } : t));
        } catch (error) {
            console.error('Failed to update task assignee', error);
        }
    };

    const handleQuickAssignToMe = async (task: Task) => {
        if (!currentUserId) {
            toast.error('User context not available');
            return;
        }

        if (!canCurrentUserBeAssigned(currentUser, users)) {
            toast.error("You don't have permission to be assigned tasks");
            return;
        }

        if (isTaskLocked(task.status)) {
            toast.warning(TASK_LOCKED_HINT);
            return;
        }

        try {
            await crmService.updateTask(task.id, { assignee_id: currentUserId });
            toast.success('Task assigned to you');

            // Optimistic update
            const currentUserObj = users.find(u => u.id === currentUserId);
            if (currentUserObj) {
                setTasks(prev => prev.map(t =>
                    t.id === task.id ? { ...t, assigned_to: currentUserObj } : t
                ));
            }
        } catch (error) {
            console.error('Failed to assign task:', error);
            toast.error('Failed to assign task to yourself');
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        setIsDeleting(true);
        try {
            await crmService.deleteTask(taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
            setShowDeleteConfirm(null);
            reload();
        } catch (err: any) {
            setError(err.message || 'Failed to delete task');
        } finally {
            setIsDeleting(false);
        }
    };

    const now = useMemo(() => new Date(), [tasks]); // eslint-disable-line react-hooks/exhaustive-deps
    const dueFormatters = useMemo(() => ({
        formatDay: (day: string) => formatters.formatDate(day),
        formatTime: (iso: string) => formatters.formatDate(iso, { hour: 'numeric', minute: '2-digit' }),
    }), [formatters]);

    const columns: TaskColumn[] = [
        {
            key: 'title',
            header: 'Task',
            sortField: 'title',
            render: (task: Task) => (
                <div className="flex items-start gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(task, task.status === 'DONE' ? 'OPEN' : 'DONE');
                        }}
                        className="mt-0.5 text-slate-500 hover:text-blue-400 transition-colors"
                        aria-label={task.status === 'DONE' ? 'Reopen task' : 'Mark task done'}
                    >
                        {task.status === 'DONE' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} />}
                    </button>
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className={`font-semibold ${task.status === 'DONE' ? 'text-slate-500 line-through' : 'text-slate-50'}`}>
                                {task.title}
                            </span>
                            {task.project_id && (
                                <span title={task.sync_status === 'sync_failed' ? 'Project sync failed' : 'Linked to a project'} className={task.sync_status === 'sync_failed' ? 'text-amber-400' : 'text-blue-400'}>
                                    <Link2 size={12} aria-label="Linked to a project" />
                                </span>
                            )}
                        </div>
                        <TaskReminderBadge task={task} formatTime={dueFormatters.formatTime} />
                    </div>
                </div>
            ),
        },
        { key: 'priority', header: 'Priority', sortField: 'priority', render: (task: Task) => <TaskPriorityBadge priority={task.priority} /> },
        { key: 'type', header: 'Type', render: (task: Task) => <TaskTypeBadge type={task.type} /> },
        {
            key: 'due',
            header: 'Due Date',
            sortField: 'due',
            render: (task: Task) => <TaskDueCell due={describeTaskDue(task, now, dueFormatters, task.list_bucket)} />,
        },
        {
            key: 'associated_with',
            header: 'Associated With',
            render: (task: Task) => {
                const entity = task.deal
                    ? { label: task.deal.name || task.deal.company_name, sub: task.deal.company_name !== task.deal.name ? task.deal.company_name : null, type: 'deal' as const }
                    : task.lead
                    ? { label: task.lead.company_name || task.lead.contact_name, sub: task.lead.company_name ? task.lead.contact_name : null, type: 'lead' as const }
                    : null;

                if (!entity) {
                    return <span className="text-slate-600 text-xs">—</span>;
                }

                return (
                    <div className="flex items-center gap-2">
                        <Building2 size={13} className={entity.type === 'deal' ? 'text-violet-400 shrink-0' : 'text-blue-400 shrink-0'} />
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm text-slate-200 truncate">{entity.label}</span>
                            {entity.sub && <span className="text-[11px] text-slate-400 truncate">{entity.sub}</span>}
                            <span className={`text-[9px] font-black uppercase tracking-widest ${entity.type === 'deal' ? 'text-violet-500' : 'text-blue-500'}`}>
                                {entity.type}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'assigned_to',
            header: 'Assigned To',
            render: (task: Task) => (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                    <select
                        value={task.assigned_to.id}
                        onChange={(e) => handleAssigneeChange(task, e.target.value)}
                        disabled={isTaskLocked(task.status)}
                        title={isTaskLocked(task.status) ? TASK_LOCKED_HINT : undefined}
                        className="flex-1 bg-transparent text-slate-300 text-sm focus:outline-none cursor-pointer hover:text-slate-50 transition-colors py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {users.map(user => (
                            <option key={user.id} value={user.id} className="bg-slate-900 text-slate-300">
                                {user.full_name}
                                {user.id === currentUserId ? ' (You)' : ''}
                            </option>
                        ))}
                    </select>

                    {!isTaskAssignedToUser(task, currentUserId) && (
                        <button
                            onClick={() => handleQuickAssignToMe(task)}
                            disabled={!canCurrentUserBeAssigned(currentUser, users) || isTaskLocked(task.status)}
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-600/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                                isTaskLocked(task.status)
                                    ? TASK_LOCKED_HINT
                                    : canCurrentUserBeAssigned(currentUser, users)
                                        ? "Assign to me"
                                        : "You don't have permission to be assigned tasks"
                            }
                        >
                            <UserPlus className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (task: Task) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value)}
                        className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-950 ${task.status === 'DONE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 focus:ring-emerald-500'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 focus:ring-amber-500'
                            : task.status === 'ON_HOLD'
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 focus:ring-orange-500'
                            : task.status === 'CANCELLED'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 focus:ring-rose-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 focus:ring-slate-500'
                            }`}
                    >
                        <option value="OPEN" className="bg-slate-900 text-slate-300">OPEN</option>
                        <option value="IN_PROGRESS" className="bg-slate-900 text-slate-300">IN PROGRESS</option>
                        <option value="DONE" className="bg-slate-900 text-slate-300">DONE</option>
                        <option value="ON_HOLD" className="bg-slate-900 text-slate-300">ON HOLD</option>
                        <option value="CANCELLED" className="bg-slate-900 text-slate-300">CANCELLED</option>
                    </select>
                </div>
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (task: Task) => (
                <div onClick={(e) => e.stopPropagation()}>
                    {canCreateTask && <button
                        onClick={() => setShowDeleteConfirm(task.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                        title="Delete task"
                    >
                        <Trash2 size={16} />
                    </button>}
                </div>
            ),
        },
    ];

    // Sandbox mode caps how many rows are shown, not how many are fetched.
    const visibleTasks = isSandboxMode ? tasks.slice(0, sandboxEntryLimit) : tasks;
    const smartOrder = filters.sort === '';
    const sections = smartOrder
        ? groupTasksIntoSections(visibleTasks, counts, now)
        : [{ bucket: 'upcoming' as const, label: 'All tasks', empty: 'No tasks match the current filters.', count: total, tasks: visibleTasks }];

    const assigneeOptions = users.map(u => ({ value: u.id, label: u.full_name }));
    const filterConfigs = [
        { key: 'type', label: 'Type', type: 'multiselect' as const, options: TASK_TYPE_FILTER_OPTIONS },
        { key: 'priority', label: 'Priority', type: 'multiselect' as const, options: TASK_PRIORITY_FILTER_OPTIONS },
        { key: 'status', label: 'Status', type: 'multiselect' as const, options: TASK_STATUS_FILTER_OPTIONS },
        { key: 'due', label: 'Due', type: 'select' as const, options: TASK_DUE_FILTER_OPTIONS, placeholder: 'Any due date' },
        { key: 'reminder', label: 'Reminders', type: 'select' as const, options: TASK_REMINDER_FILTER_OPTIONS, placeholder: 'Any task' },
        // Team / All views span several people; "My Tasks" is always just you.
        ...(filters.scope !== 'own'
            ? [{ key: 'assignee', label: 'Assigned to', type: 'select' as const, options: assigneeOptions, placeholder: 'Anyone' }]
            : []),
    ];

    return (
        <div className="p-8" ref={listAnchorRef}>
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-50 tracking-tight leading-none">Tasks & Follow-ups</h1>
                    <p className="text-slate-300 mt-2">Personal execution discipline and daily tasks</p>
                </div>
                {canCreateTask && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-900/30 active:scale-95"
                    >
                        <Plus size={16} />
                        Create Task
                    </button>
                )}
            </header>

            {(canViewTeamTasks || canViewAllTasks) && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {([
                        { key: 'own' as const, label: 'My Tasks' },
                        ...(canViewTeamTasks ? [{ key: 'team' as const, label: 'Team Tasks' }] : []),
                        ...(canViewAllTasks ? [{ key: 'all' as const, label: 'All Tasks' }] : []),
                    ]).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => updateFilters({ ...filters, scope: tab.key, assignee: '' })}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all border ${filters.scope === tab.key
                                ? 'bg-slate-700 text-white border-slate-600'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-100 hover:bg-slate-800'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}

            <TasksUpNext
                scope={filters.scope}
                refreshKey={reloadTick}
                onChanged={reload}
                onOpen={(task) => navigate(`${task.id}`)}
                formatDay={dueFormatters.formatDay}
                formatTime={dueFormatters.formatTime}
            />

            {/* Counter strip: each tile is a one-click due filter */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4" data-testid="task-counters">
                {TASK_COUNTER_TILES.map(tile => {
                    const active = filters.due === tile.due;
                    const value = counts[tile.countKey];
                    const alarming = tile.due === 'overdue' && value > 0;
                    return (
                        <button
                            key={tile.due}
                            onClick={() => updateFilters(toggleQuickDue(filters, tile.due))}
                            aria-pressed={active}
                            className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all ${active
                                ? 'bg-blue-600/20 border-blue-500 text-slate-50'
                                : alarming
                                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                                }`}
                        >
                            <span className="text-2xl font-bold leading-none">{value}</span>
                            <span className="mt-1 text-xs font-semibold uppercase tracking-wider">{tile.label}</span>
                        </button>
                    );
                })}
            </div>

            <TaskSavedViews
                filters={filters}
                currentUserId={currentUserId}
                taskViews={taskViews}
                onApply={(next) => updateFilters(next)}
            />

            <FilterBar
                className="mb-4"
                filters={filterConfigs}
                activeFilters={activeFilterValues(filters)}
                onFilterChange={(key, value) => updateFilters(applyFilterChange(filters, key, value))}
                onClearAll={() => {
                    setSearchInput('');
                    updateFilters(clearTaskFilters(filters));
                }}
                searchPlaceholder="Search tasks, leads or deals..."
                searchValue={searchInput}
                onSearchChange={setSearchInput}
            />

            <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-slate-400">
                {smartOrder ? (
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 font-semibold text-blue-300"
                        title="Overdue first, then due today, upcoming, no due date and done. Within a section: priority, then due date."
                    >
                        <ArrowDownWideNarrow size={13} />
                        Smart order
                    </span>
                ) : (
                    <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 font-semibold text-slate-200">
                            Sorted by {SORT_LABELS[filters.sort as TaskSortField]} ({filters.order === 'asc' ? 'ascending' : 'descending'})
                        </span>
                        <button
                            onClick={() => updateFilters({ ...filters, sort: '', order: 'asc' })}
                            className="font-semibold text-blue-400 hover:text-blue-300"
                        >
                            Back to smart order
                        </button>
                    </>
                )}
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">×</button>
                </div>
            )}

            {truncated && (
                <div className="mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">
                    Very large task list: showing the most recent 5,000 tasks. Narrow the filters to see older ones.
                </div>
            )}

            {/* Sandbox limit notice */}
            {isSandboxMode && isLimited(tasks.length) && (
                <div className="mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm flex items-center gap-2">
                    <span className="font-semibold">Sandbox mode:</span>
                    showing {sandboxEntryLimit} of {tasks.length} tasks — full list visible in production.
                </div>
            )}

            {isLoading ? (
                <TableSkeleton />
            ) : (
                <TaskListSections
                    columns={columns}
                    sections={sections}
                    showSectionHeaders={smartOrder}
                    sort={filters.sort ? { field: filters.sort, direction: filters.order } : null}
                    onSort={(field) => updateFilters(nextSort(filters, field as TaskSortField))}
                    onRowClick={(task) => navigate(`${task.id}`)}
                />
            )}

            {!isLoading && (
                <div className="flex items-center justify-between mt-4 px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-400">
                    <span>Showing {tasks.length} of {total} tasks</span>
                    {tasks.length < total && (
                        <Button variant="secondary" size="sm" onClick={handleLoadMore} disabled={isLoadingMore}>
                            {isLoadingMore ? 'Loading...' : 'Load more'}
                        </Button>
                    )}
                </div>
            )}

            {/* Create Task Modal */}
            {showCreateModal && (
                <TaskModal
                    task={null}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        reload();
                    }}
                />
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-semibold text-slate-100 mb-2">Delete Task</h2>
                        <p className="text-slate-400 mb-6">
                            Are you sure you want to delete this task? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 text-slate-300 hover:text-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteTask(showDeleteConfirm)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                {isDeleting && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TasksPage;
