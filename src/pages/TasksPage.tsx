import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, AlertCircle, Calendar, Trash2, UserPlus, Building2, Plus, X } from 'lucide-react';
import { crmService } from '../services/crmService';
import { Task } from '../types/crm';
import { ListPageTemplate, Pagination, Button, IconButton, SegmentedControl, DataTable, Select, SearchInput, toast, type DataTableColumn, type FilterValues, type ListFilterConfig } from '@so360/design-system';
import { useShell, useShellBridge, useSandboxLimit } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { canCurrentUserBeAssigned, isTaskAssignedToUser, isTaskLocked, isTaskOverdue, TASK_LOCKED_HINT } from '../utils/taskUtils';
import { dueDateCalendarDay, hasTimeComponent } from '../utils/datetime';
import TaskModal from './components/TaskModal';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { Modal } from '../components/common/Modal';

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

    const columns: DataTableColumn<Task>[] = [
        {
            key: 'title',
            header: 'Task',
            sortable: true,
            widthClassName: 'min-w-64',
            render: (task: Task) => (
                <div className="flex items-start gap-3">
                    <IconButton
                        label={task.status === 'DONE' ? 'Mark as open' : 'Mark as done'}
                        size="sm"
                        icon={task.status === 'DONE' ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(task, task.status === 'DONE' ? 'OPEN' : 'DONE');
                        }}
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className={`line-clamp-2 font-semibold ${task.status === 'DONE' ? 'text-fg-muted line-through' : 'text-fg'}`}>
                            {task.title}
                        </span>
                    </div>
                </div>
            )
        },
        {
            key: 'due_date',
            header: 'Due Date',
            sortable: true,
            render: (task: Task) => {
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
            key: 'associated_with',
            header: 'Associated With',
            sortable: true,
            render: (task: Task) => {
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
            key: 'assigned_to',
            header: 'Assigned To',
            sortable: true,
            widthClassName: 'min-w-48',
            render: (task: Task) => (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                    <Select
                        name={`task-assignee-${task.id}`}
                        aria-label="Assigned to"
                        size="sm"
                        value={task.assigned_to.id}
                        onValueChange={(v) => handleAssigneeChange(task, v)}
                        disabled={isTaskLocked(task.status)}
                        title={isTaskLocked(task.status) ? TASK_LOCKED_HINT : undefined}
                        className="flex-1"
                        options={users.map(user => ({ value: user.id, label: `${user.full_name}${user.id === currentUserId ? ' (You)' : ''}` }))}
                    />

                    {!isTaskAssignedToUser(task, currentUserId) && (
                        <IconButton
                            size="sm"
                            onClick={() => handleQuickAssignToMe(task)}
                            disabled={!canCurrentUserBeAssigned(currentUser, users) || isTaskLocked(task.status)}
                            label={
                                isTaskLocked(task.status)
                                    ? TASK_LOCKED_HINT
                                    : canCurrentUserBeAssigned(currentUser, users)
                                        ? "Assign to me"
                                        : "You don't have permission to be assigned tasks"
                            }
                            icon={<UserPlus className="w-4 h-4" />}
                        />
                    )}
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (task: Task) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Select
                        name={`task-status-${task.id}`}
                        aria-label="Status"
                        size="sm"
                        value={task.status}
                        onValueChange={(v) => handleStatusChange(task, v)}
                        options={[
                            { value: 'OPEN', label: 'Open' },
                            { value: 'IN_PROGRESS', label: 'In progress' },
                            { value: 'DONE', label: 'Done' },
                            { value: 'ON_HOLD', label: 'On hold' },
                            { value: 'CANCELLED', label: 'Cancelled' },
                        ]}
                    />
                </div>
            )
        },
    ];
    const statusOptions = ['Open', 'In Progress', 'Done', 'On Hold', 'Cancelled', 'Overdue'].map(v => ({ value: v, label: v }));
    const filterConfig: ListFilterConfig = {
        fields: [{ key: 'status', label: 'Status', type: 'select', quick: true, options: statusOptions }],
        values: (filter !== 'All' ? { status: filter } : {}) as FilterValues,
        onChange: (next: FilterValues) => setFilter((next.status as string) || 'All'),
        onClear: () => { setSearchTerm(''); setFilter('All'); },
    };

    return (
        <ListPageTemplate
            trail={[]}
            title="Tasks & Follow-ups"
            description="Personal execution discipline and daily tasks"
            primaryAction={canCreateTask ? (
                <Button onClick={() => setShowCreateModal(true)}><Plus size={16} />
                    Create Task
                </Button>
            ) : undefined}
            search={
                <SearchInput
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                />
            }
            filterConfig={filterConfig}
            views={(canViewTeamTasks || canViewAllTasks) ? (
                <SegmentedControl
                    aria-label="Task scope"
                    data-testid="tasks-scope-views"
                    value={taskScope}
                    onChange={(id) => setTaskScope(id as typeof taskScope)}
                    options={[
                        { value: 'own', label: 'My Tasks' },
                        ...(canViewTeamTasks ? [{ value: 'team', label: 'Team Tasks' }] : []),
                        ...(canViewAllTasks ? [{ value: 'all', label: 'All Tasks' }] : []),
                    ]}
                />
            ) : undefined}
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
                    <IconButton label="Dismiss error" size="sm" icon={<X size={14} />} onClick={() => setError(null)} />
                </div>
            )}

            {/* Sandbox limit notice */}
            {isSandboxMode && isLimited(sortedAndFilteredTasks.length) && (
                <div className="mb-4 px-4 py-2.5 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm flex items-center gap-2">
                    <span className="font-semibold">Sandbox mode:</span>
                    showing {sandboxEntryLimit} of {sortedAndFilteredTasks.length} tasks — full list visible in production.
                </div>
            )}

            <DataTable
                name="tasks"
                data-testid="tasks-table"
                rows={paginatedTasks}
                rowKey={(task: Task) => task.id}
                columns={columns}
                loading={isLoading}
                onRowClick={(task: Task) => navigate(`${task.id}`)}
                emptyState="No tasks found for the selected filter."
                sortKey={sortField ?? undefined}
                sortDir={sortDirection ?? undefined}
                onSortChange={(key: string, dir?: SortDirection) => { setSortField(dir ? (key as SortField) : null); setSortDirection(dir ?? null); }}
                rowActions={canCreateTask ? (task: Task) => [
                    { label: 'Delete task', danger: true, onSelect: () => setShowDeleteConfirm(task.id) },
                ] : undefined}
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
            {showDeleteConfirm && (
                <Modal
                    isOpen
                    onClose={() => setShowDeleteConfirm(null)}
                    size="md"
                    title="Delete Task"
                    dismissible={!isDeleting}
                    data-testid="delete-task-modal"
                    footer={
                        <>
                            <Button type="button" variant="secondary" onClick={() => setShowDeleteConfirm(null)} disabled={isDeleting}>
                                Cancel
                            </Button>
                            <Button type="button" variant="danger" onClick={() => handleDeleteTask(showDeleteConfirm)} disabled={isDeleting}>
                                {isDeleting && <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />}
                                Delete
                            </Button>
                        </>
                    }
                >
                    <p className="text-fg-subtle">
                        Are you sure you want to delete this task? This action cannot be undone.
                    </p>
                </Modal>
            )}
        </ListPageTemplate>
    );
};

export default TasksPage;
