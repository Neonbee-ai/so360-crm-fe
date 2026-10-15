import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle2, Circle, AlertCircle, Calendar, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, UserPlus, Building2, Plus } from 'lucide-react';
import { crmService } from '../services/crmService';
import { Task } from '../types/crm';
import { ListPageTemplate, Pagination, Button, Tabs, toast } from '@so360/design-system';
import { Table } from '../components/common/Table';
import { useShell, useShellBridge, useSandboxLimit } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { canCurrentUserBeAssigned, isTaskAssignedToUser, isTaskLocked, isTaskOverdue, TASK_LOCKED_HINT } from '../utils/taskUtils';
import { dueDateCalendarDay, hasTimeComponent } from '../utils/datetime';
import TaskModal from './components/TaskModal';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { crmPortalRoot } from '../utils/crmScope';

type SortField = 'title' | 'due_date' | 'status' | 'assigned_to' | 'associated_with';
type SortDirection = 'asc' | 'desc' | null;

const TasksPage = () => {
    const navigate = useNavigate();
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
    const [users, setUsers] = useState<any[]>([]); // Using any for User to avoid import issues if not exported
    const [isLoading, setIsLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // View state survives a trip to a task's detail page and back — see
    // usePersistedState. Everything else above is transient by design.
    // Default scope is 'own' ("My Tasks") — broader tabs only render once
    // canViewTeamTasks/canViewAllTasks resolve true, and the backend clamps
    // the request regardless of what's persisted here.
    const [taskScope, setTaskScope] = usePersistedState<'own' | 'team' | 'all'>('tasks.scope', 'own');
    const [filter, setFilter] = usePersistedState('tasks.filter', 'All');
    const [searchTerm, setSearchTerm] = usePersistedState('tasks.search', '');
    const [sortField, setSortField] = usePersistedState<SortField | null>('tasks.sortField', null);
    const [sortDirection, setSortDirection] = usePersistedState<SortDirection>('tasks.sortDirection', null);
    const [currentPage, setCurrentPage] = usePersistedState('tasks.page', 1);
    const [pageSize, setPageSize] = usePersistedState('tasks.pageSize', 10);

    const listAnchorRef = useRef<HTMLDivElement>(null);
    useListScrollRestore('tasks', listAnchorRef, !isLoading);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [tasksData, usersData] = await Promise.all([
                    crmService.getTasks(taskScope),
                    crmService.getUsers()
                ]);
                setTasks(tasksData);
                setUsers(usersData);
            } catch (error) {
                console.error('Failed to fetch data', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [taskScope]);

    const handleStatusChange = async (task: Task, newStatus: string) => {
        try {
            await crmService.updateTask(task.id, { status: newStatus });
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as any } : t));
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
        } catch (err: any) {
            setError(err.message || 'Failed to delete task');
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDirection === 'asc') setSortDirection('desc');
            else if (sortDirection === 'desc') { setSortField(null); setSortDirection(null); }
            else setSortDirection('asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ChevronsUpDown size={14} className="text-fg-muted" />;
        if (sortDirection === 'asc') return <ChevronUp size={14} className="text-primary" />;
        if (sortDirection === 'desc') return <ChevronDown size={14} className="text-primary" />;
        return <ChevronsUpDown size={14} className="text-fg-muted" />;
    };

    const SortableHeader = ({ label, field }: { label: string, field: SortField }) => (
        <button
            onClick={() => toggleSort(field)}
            className="flex items-center gap-1 hover:text-fg transition-colors cursor-pointer"
        >
            {label}
            <SortIcon field={field} />
        </button>
    );

    const sortedAndFilteredTasks = useMemo(() => {
        let result = tasks.filter(task => {
            const lc = searchTerm.toLowerCase();
            const matchesSearch = task.title.toLowerCase().includes(lc) ||
                task.description?.toLowerCase().includes(lc) ||
                task.deal?.name?.toLowerCase().includes(lc) ||
                task.deal?.company_name?.toLowerCase().includes(lc) ||
                task.lead?.company_name?.toLowerCase().includes(lc) ||
                task.lead?.contact_name?.toLowerCase().includes(lc);

            if (!matchesSearch) return false;

            if (filter === 'All') return true;
            if (filter === 'Open') return task.status === 'OPEN';
            if (filter === 'In Progress') return task.status === 'IN_PROGRESS';
            if (filter === 'Done') return task.status === 'DONE';
            if (filter === 'On Hold') return task.status === 'ON_HOLD';
            if (filter === 'Cancelled') return task.status === 'CANCELLED';
            if (filter === 'Overdue') return isTaskOverdue(task);
            return true;
        });

        // Apply sorting
        if (sortField && sortDirection) {
            result = [...result].sort((a, b) => {
                let aVal: any, bVal: any;
                switch (sortField) {
                    case 'title': aVal = a.title; bVal = b.title; break;
                    case 'due_date': aVal = new Date(a.due_date).getTime(); bVal = new Date(b.due_date).getTime(); break;
                    case 'status': aVal = a.status; bVal = b.status; break;
                    case 'assigned_to': aVal = a.assigned_to?.full_name || ''; bVal = b.assigned_to?.full_name || ''; break;
                    case 'associated_with': {
                        const getLabel = (t: Task) => t.deal?.name || t.deal?.company_name || t.lead?.company_name || t.lead?.contact_name || '';
                        aVal = getLabel(a); bVal = getLabel(b); break;
                    }
                    default: return 0;
                }
                if (typeof aVal === 'string') {
                    return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }

        return result;
    }, [tasks, searchTerm, filter, sortField, sortDirection]);

    // Sandbox limit + pagination
    const sandboxLimitedTasks = useMemo(
        () => isSandboxMode ? sortedAndFilteredTasks.slice(0, sandboxEntryLimit) : sortedAndFilteredTasks,
        [sortedAndFilteredTasks, isSandboxMode, sandboxEntryLimit],
    );

    const totalPages = Math.ceil(sandboxLimitedTasks.length / pageSize);
    const paginatedTasks = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sandboxLimitedTasks.slice(start, start + pageSize);
    }, [sandboxLimitedTasks, currentPage, pageSize]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filter]);

    const columns = [
        {
            header: <SortableHeader label="Task" field="title" />,
            accessor: (task: Task) => (
                <div className="flex items-start gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(task, task.status === 'DONE' ? 'OPEN' : 'DONE');
                        }}
                        className="mt-0.5 text-fg-muted hover:text-primary transition-colors"
                    >
                        {task.status === 'DONE' ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} />}
                    </button>
                    <div className="flex flex-col gap-0.5">
                        <span className={`font-semibold ${task.status === 'DONE' ? 'text-fg-muted line-through' : 'text-fg'}`}>
                            {task.title}
                        </span>
                    </div>
                </div>
            )
        },
        {
            header: <SortableHeader label="Due Date" field="due_date" />,
            accessor: (task: Task) => {
                const isOverdue = isTaskOverdue(task);
                return (
                    <div className={`flex items-center gap-2 text-xs font-medium whitespace-nowrap ${isOverdue ? 'text-danger' : 'text-fg-subtle'}`}>
                        {isOverdue ? <AlertCircle size={14} className="shrink-0" /> : <Calendar size={14} className="shrink-0" />}
                        <span>{formatters.formatDate(dueDateCalendarDay(task.due_date))}</span>
                        {/* Only a task the user gave a time to shows one. */}
                        {hasTimeComponent(task.due_date) && (
                            <span className="text-fg-subtle">{formatters.formatDate(task.due_date, { hour: 'numeric', minute: '2-digit' })}</span>
                        )}
                        {isOverdue && <span className=" text-xs font-semibolder">Overdue</span>}
                    </div>
                );
            }
        },
        {
            header: <SortableHeader label="Associated With" field="associated_with" />,
            accessor: (task: Task) => {
                const entity = task.deal
                    ? { label: task.deal.name || task.deal.company_name, sub: task.deal.company_name !== task.deal.name ? task.deal.company_name : null, type: 'deal' as const }
                    : task.lead
                    ? { label: task.lead.company_name || task.lead.contact_name, sub: task.lead.company_name ? task.lead.contact_name : null, type: 'lead' as const }
                    : null;

                if (!entity) {
                    return <span className="text-fg-muted text-xs">—</span>;
                }

                return (
                    <div className="flex items-center gap-2">
                        <Building2 size={13} className={entity.type === 'deal' ? 'text-primary shrink-0' : 'text-primary shrink-0'} />
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm text-fg truncate">{entity.label}</span>
                            {entity.sub && <span className="text-xs text-fg-subtle truncate">{entity.sub}</span>}
                            <span className={`text-xs font-semibold  ${entity.type === 'deal' ? 'text-primary' : 'text-primary'}`}>
                                {entity.type}
                            </span>
                        </div>
                    </div>
                );
            }
        },
        {
            header: <SortableHeader label="Assigned To" field="assigned_to" />,
            accessor: (task: Task) => (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                    <select
                        value={task.assigned_to.id}
                        onChange={(e) => handleAssigneeChange(task, e.target.value)}
                        disabled={isTaskLocked(task.status)}
                        title={isTaskLocked(task.status) ? TASK_LOCKED_HINT : undefined}
                        className="flex-1 bg-transparent text-fg-subtle text-sm focus:outline-none cursor-pointer hover:text-fg transition-colors py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {users.map(user => (
                            <option key={user.id} value={user.id} className="bg-surface text-fg-subtle">
                                {user.full_name}
                                {user.id === currentUserId ? ' (You)' : ''}
                            </option>
                        ))}
                    </select>

                    {!isTaskAssignedToUser(task, currentUserId) && (
                        <button
                            onClick={() => handleQuickAssignToMe(task)}
                            disabled={!canCurrentUserBeAssigned(currentUser, users) || isTaskLocked(task.status)}
                            className="p-1 text-fg-subtle hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
            )
        },
        {
            header: <SortableHeader label="Status" field="status" />,
            accessor: (task: Task) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value)}
                        className={`px-2 py-1 rounded-full text-xs font-semibold  border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface ${task.status === 'DONE'
                            ? 'bg-success/10 text-success border-success/20 focus:ring-success'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-warning/10 text-warning border-warning/20 focus:ring-warning'
                            : task.status === 'ON_HOLD'
                            ? 'bg-warning/10 text-warning border-warning/20 focus:ring-warning'
                            : task.status === 'CANCELLED'
                            ? 'bg-danger/10 text-danger border-danger/20 focus:ring-danger'
                            : 'bg-surface-raised text-fg-subtle border-line focus:ring-line-strong'
                            }`}
                    >
                        <option value="OPEN" className="bg-surface text-fg-subtle">OPEN</option>
                        <option value="IN_PROGRESS" className="bg-surface text-fg-subtle">IN PROGRESS</option>
                        <option value="DONE" className="bg-surface text-fg-subtle">DONE</option>
                        <option value="ON_HOLD" className="bg-surface text-fg-subtle">ON HOLD</option>
                        <option value="CANCELLED" className="bg-surface text-fg-subtle">CANCELLED</option>
                    </select>
                </div>
            )
        },
        {
            header: '',
            accessor: (task: Task) => (
                <div onClick={(e) => e.stopPropagation()}>
                    {canCreateTask && <button
                        onClick={() => setShowDeleteConfirm(task.id)}
                        className="p-1.5 text-fg-subtle hover:text-danger hover:bg-surface-raised rounded transition-colors"
                        title="Delete task"
                    >
                        <Trash2 size={16} />
                    </button>}
                </div>
            )
        }
    ];

    return (
        <ListPageTemplate
            title="Tasks & Follow-ups"
            description="Personal execution discipline and daily tasks"
            primaryAction={canCreateTask ? (
                <Button onClick={() => setShowCreateModal(true)}><Plus size={16} />
                    Create Task
                </Button>
            ) : undefined}
            filters={
                <>
            {(canViewTeamTasks || canViewAllTasks) && (
                <Tabs
                    name="task-scope"
                    value={taskScope}
                    onChange={(id) => setTaskScope(id as typeof taskScope)}
                    items={[
                        { id: 'own', label: 'My Tasks' },
                        ...(canViewTeamTasks ? [{ id: 'team', label: 'Team Tasks' }] : []),
                        ...(canViewAllTasks ? [{ id: 'all', label: 'All Tasks' }] : []),
                    ]}
                />
            )}
                <div className="relative w-full wc-medium:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={16} />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-nb-control-md w-full rounded-nb border border-line bg-surface pl-10 pr-4 text-nb-body text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-nb-1">
                    {['All', 'Open', 'In Progress', 'Done', 'On Hold', 'Cancelled', 'Overdue'].map((btn) => (
                        <button
                            key={btn}
                            onClick={() => setFilter(btn)}
                            className={`h-nb-control-md px-nb-3 rounded-nb text-nb-body transition-colors ${filter === btn
                                ? 'bg-surface-raised text-fg font-medium'
                                : 'text-fg-muted hover:text-fg hover:bg-surface-raised'
                                }`}
                        >
                            {btn}
                        </button>
                    ))}
                </div>
                </>
            }
            pagination={sandboxLimitedTasks.length > 0 ? (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages || 1}
                    totalItems={sandboxLimitedTasks.length}
                    pageSize={pageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                />
            ) : undefined}
        >
            <div ref={listAnchorRef}>
            {error && (
                <div className="mb-4 p-4 bg-danger/20 border border-danger/50 rounded-lg text-danger">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 text-danger hover:text-danger/80">×</button>
                </div>
            )}

            {/* Sandbox limit notice */}
            {isSandboxMode && isLimited(sortedAndFilteredTasks.length) && (
                <div className="mb-4 px-4 py-2.5 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm flex items-center gap-2">
                    <span className="font-semibold">Sandbox mode:</span>
                    showing {sandboxEntryLimit} of {sortedAndFilteredTasks.length} tasks — full list visible in production.
                </div>
            )}

            <Table
                data={paginatedTasks}
                columns={columns}
                isLoading={isLoading}
                onRowClick={(task) => navigate(`${task.id}`)}
                emptyMessage="No tasks found for the selected filter."
            />

            </div>

            {/* Create Task Modal */}
            {showCreateModal && (
                <TaskModal
                    task={null}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={(newTask) => {
                        setTasks(prev => [newTask, ...prev]);
                        setShowCreateModal(false);
                    }}
                />
            )}

            {/* Delete Confirmation Dialog */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-overlay/70">
                    <div className="bg-surface border border-line rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-semibold text-fg mb-2">Delete Task</h2>
                        <p className="text-fg-subtle mb-6">
                            Are you sure you want to delete this task? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 text-fg-subtle hover:text-fg transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteTask(showDeleteConfirm)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-danger hover:bg-danger-hover disabled:bg-danger-hover text-primary-fg rounded-lg transition-colors flex items-center gap-2"
                            >
                                {isDeleting && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                crmPortalRoot()
            )}
        </ListPageTemplate>
    );
};

export default TasksPage;
