import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import {
    Badge, Button, DataTable, Grid, GridItem, IconButton, KpiCard, KpiGrid, ListPageTemplate, Pagination,
    SearchInput, SegmentedControl, Select, TextField, toast,
    type DataTableColumn, type FilterValues, type ListFilterConfig,
} from '@so360/design-system';
import { useShell, useShellBridge } from '@so360/shell-context';
import { crmService, type GridView } from '../../services/crmService';
import { Task, UpNextTask } from '../../types/crm';
import { useCRMFormatters } from '../../utils/formatters';
import { describeTaskDue, type DueTone } from '../../utils/taskDueLabel';
import {
    DEFAULT_TASK_FILTERS, EMPTY_COUNTS, TASK_COUNTER_TILES, TASK_DUE_FILTER_OPTIONS, TASK_PAGE_SIZE,
    TASK_PRIORITY_FILTER_OPTIONS, TASK_REMINDER_FILTER_OPTIONS, TASK_STATUS_FILTER_OPTIONS, TASK_TYPE_FILTER_OPTIONS,
    activeFilterValues, clearTaskFilters, filtersFromFilterValues, parseTaskListFilters, serializeTaskListFilters,
    toTaskListApiParams, toggleQuickDue, type TaskListCounts, type TaskListFilters, type TaskSortField,
} from '../../utils/taskListFilters';
import { TASK_VIEW_ENTITY, filtersForView, filtersFromViewConfig, hasNoFilters, sameFilters, systemTaskViews, toViewConfig } from '../../utils/taskViews';
import { Modal } from '../../components/common/Modal';
import TaskModal from '../components/TaskModal';
import UpNextPanel from './UpNextPanel';

const DUE_BADGE: Record<DueTone, 'danger' | 'warning' | 'neutral' | 'success' | 'info'> = {
    overdue: 'danger', today: 'warning', upcoming: 'info', none: 'neutral', done: 'success',
};
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TASK_TYPE_FILTER_OPTIONS.map(o => [o.value, o.label]));
const SORT_KEYS: Record<string, TaskSortField> = { title: 'title', due: 'due', priority: 'priority' };
const tzOffsetMinutes = () => -new Date().getTimezoneOffset();

/** Value of the views select: 'system:<id>' / 'saved:<id>' when the filters match a view, else ''. */
export function matchingViewId(
    filters: TaskListFilters,
    saved: GridView[],
    currentUserId?: string,
): string {
    const system = systemTaskViews(currentUserId).find(v => sameFilters(filtersForView(v, filters.scope), filters));
    if (system) return system.id;
    const own = saved.find(v => sameFilters(filtersFromViewConfig(v.config, filters.scope), filters));
    return own ? `saved:${own.id}` : '';
}

/**
 * Priority-driven Tasks & Follow-ups list (Pulse 552552b8), behind
 * submodule:crm:task_smart_list. The server orders overdue → today →
 * upcoming → no due date → done (GET /tasks/list sort=smart) and returns the
 * counts for the counter strip; filters live in the URL so the dashboard can
 * deep-link into them. Visibility is clamped server-side by the task scope.
 */
const SmartTasksList: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const formatters = useCRMFormatters();
    const shell = useShell();
    const bridge = useShellBridge();
    const currentUserId = shell?.user?.id;
    const perm = (code: string) => bridge?.permissionsLoaded === true && (bridge?.hasPermission?.(code) ?? false);
    const canCreateTask = perm('activities.create') && bridge?.effectiveFlagsLoaded !== false && (bridge?.isFeatureEnabled?.('action:crm:tasks:create') ?? true);
    const canViewTeam = perm('crm_tasks.view_team');
    const canViewAll = perm('crm_tasks.view_all');

    const [filters, setFiltersState] = useState<TaskListFilters>(() => parseTaskListFilters(searchParams));
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<Task[]>([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState<TaskListCounts>(EMPTY_COUNTS);
    const [loading, setLoading] = useState(true);
    const [upNext, setUpNext] = useState<UpNextTask[]>([]);
    const [upNextLoading, setUpNextLoading] = useState(true);
    const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
    const [savedViews, setSavedViews] = useState<GridView[]>([]);
    const [reloadKey, setReloadKey] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [viewName, setViewName] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const setFilters = useCallback((next: TaskListFilters) => {
        setFiltersState(next);
        setPage(1);
        setSearchParams(serializeTaskListFilters(next), { replace: true });
    }, [setSearchParams]);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        crmService.getTaskList(toTaskListApiParams(filters, { page, limit: TASK_PAGE_SIZE, tzOffsetMinutes: tzOffsetMinutes() }))
            .then(res => { if (alive) { setItems(res.items); setTotal(res.total); setCounts(res.counts ?? EMPTY_COUNTS); } })
            .catch(() => { if (alive) { setItems([]); setTotal(0); setCounts(EMPTY_COUNTS); toast.error('Could not load tasks'); } })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [filters, page, reloadKey]);

    useEffect(() => {
        let alive = true;
        setUpNextLoading(true);
        crmService.getUpNext({ scope: filters.scope, tz_offset_minutes: String(tzOffsetMinutes()) })
            .then(res => { if (alive) setUpNext(res.items); })
            .catch(() => { if (alive) setUpNext([]); })
            .finally(() => { if (alive) setUpNextLoading(false); });
        return () => { alive = false; };
    }, [filters.scope, reloadKey]);

    useEffect(() => {
        crmService.getUsers().then(setUsers).catch(() => setUsers([]));
        crmService.gridViews.list(TASK_VIEW_ENTITY).then(setSavedViews).catch(() => setSavedViews([]));
    }, []);

    const reload = () => setReloadKey(k => k + 1);

    const handleStatus = async (task: Task, status: string) => {
        try {
            await crmService.updateTask(task.id, { status });
            reload();
        } catch {
            toast.error('Could not update the task');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await crmService.deleteTask(id);
            setDeleteId(null);
            reload();
        } catch {
            toast.error('Could not delete the task');
        }
    };

    const handleSaveView = async () => {
        const name = viewName.trim();
        if (!name) return;
        try {
            const view = await crmService.gridViews.create({ name, entity_type: TASK_VIEW_ENTITY, config: { ...toViewConfig(filters) } });
            setSavedViews(prev => [...prev, view]);
            setSaveOpen(false);
            setViewName('');
            toast.success('View saved');
        } catch {
            toast.error('Could not save the view');
        }
    };

    const handleDeleteView = async (id: string) => {
        try {
            await crmService.gridViews.remove(id);
            setSavedViews(prev => prev.filter(v => v.id !== id));
        } catch {
            toast.error('Could not delete the view');
        }
    };

    const systemViews = useMemo(() => systemTaskViews(currentUserId), [currentUserId]);
    const activeView = matchingViewId(filters, savedViews, currentUserId);
    const applyView = (id: string) => {
        if (!id) return setFilters(clearTaskFilters(filters));
        const system = systemViews.find(v => v.id === id);
        if (system) return setFilters(filtersForView(system, filters.scope));
        const saved = savedViews.find(v => `saved:${v.id}` === id);
        if (saved) setFilters(filtersFromViewConfig(saved.config, filters.scope));
    };

    const fmt = {
        formatDay: (day: string) => formatters.formatDate(day),
        formatTime: (iso: string) => formatters.formatDate(iso, { hour: 'numeric', minute: '2-digit' }),
    };
    const now = new Date();

    const columns: DataTableColumn<Task>[] = [
        {
            key: 'title', header: 'Task', sortable: true, widthClassName: 'min-w-64',
            render: (task: Task) => (
                <div className="flex items-start gap-3">
                    <IconButton
                        label={task.status === 'DONE' ? 'Mark as open' : 'Mark as done'}
                        size="sm"
                        icon={task.status === 'DONE' ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} />}
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleStatus(task, task.status === 'DONE' ? 'OPEN' : 'DONE'); }}
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className={`line-clamp-1 font-semibold ${task.status === 'DONE' ? 'text-fg-muted line-through' : 'text-fg'}`}>{task.title}</span>
                        <span className="text-nb-caption text-fg-subtle">{TYPE_LABEL[task.type] ?? task.type}</span>
                    </div>
                </div>
            ),
        },
        {
            key: 'due', header: 'Due', sortable: true, widthClassName: 'min-w-40 whitespace-nowrap',
            render: (task: Task) => {
                const d = describeTaskDue(task, now, fmt, task.list_bucket);
                return <span title={d.title}><Badge size="sm" tone={DUE_BADGE[d.tone]}>{d.label}</Badge></span>;
            },
        },
        {
            key: 'priority', header: 'Priority', sortable: true, widthClassName: 'min-w-28',
            render: (task: Task) => task.priority
                ? <Badge size="sm" tone={task.priority === 'CRITICAL' || task.priority === 'HIGH' ? 'danger' : 'neutral'}>{TASK_PRIORITY_FILTER_OPTIONS.find(o => o.value === task.priority)?.label ?? task.priority}</Badge>
                : <span className="text-fg-muted">—</span>,
        },
        {
            key: 'associated_with', header: 'Associated with', widthClassName: 'min-w-44',
            render: (task: Task) => <span className="truncate text-fg">{task.deal?.name || task.deal?.company_name || task.lead?.company_name || task.lead?.contact_name || '—'}</span>,
        },
        {
            key: 'assigned_to', header: 'Assigned to', widthClassName: 'min-w-36',
            render: (task: Task) => <span className="text-fg-subtle">{task.assigned_to?.full_name || '—'}</span>,
        },
    ];

    const filterConfig: ListFilterConfig = {
        fields: [
            { key: 'due', label: 'Due', type: 'select', quick: true, options: TASK_DUE_FILTER_OPTIONS },
            { key: 'type', label: 'Type', type: 'multiselect', quick: true, options: TASK_TYPE_FILTER_OPTIONS },
            { key: 'priority', label: 'Priority', type: 'multiselect', quick: true, options: TASK_PRIORITY_FILTER_OPTIONS },
            { key: 'status', label: 'Status', type: 'multiselect', options: TASK_STATUS_FILTER_OPTIONS },
            { key: 'assignee', label: 'Assignee', type: 'select', options: users.map(u => ({ value: u.id, label: u.full_name })) },
            { key: 'reminder', label: 'Reminder', type: 'select', options: TASK_REMINDER_FILTER_OPTIONS },
        ],
        values: activeFilterValues(filters) as FilterValues,
        onChange: (next: FilterValues) => setFilters(filtersFromFilterValues(filters, next)),
        onClear: () => setFilters(clearTaskFilters(filters)),
        quickFilters: true,
    };

    const viewOptions = [
        { value: '', label: 'All tasks' },
        ...systemViews.map(v => ({ value: v.id, label: v.name })),
        ...savedViews.map(v => ({ value: `saved:${v.id}`, label: v.name })),
    ];
    const totalPages = Math.max(1, Math.ceil(total / TASK_PAGE_SIZE));

    return (
        <ListPageTemplate
            trail={[]}
            title="Tasks & Follow-ups"
            description="Overdue first, then today, then what is coming up"
            count={counts.total}
            primaryAction={canCreateTask ? <Button onClick={() => setShowCreate(true)}><Plus size={16} />Create Task</Button> : undefined}
            headerSecondaryActions={[
                <Button key="save-view" variant="secondary" data-testid="tasks-save-view" disabled={hasNoFilters(filters) || activeView !== ''} onClick={() => setSaveOpen(true)}>
                    Save view
                </Button>,
            ]}
            kpis={
                <KpiGrid name="task-counters">
                    {TASK_COUNTER_TILES.map(tile => (
                        <KpiCard
                            key={tile.due}
                            data-testid={`tasks-counter-${tile.due}`}
                            label={tile.label}
                            value={counts[tile.countKey]}
                            badge={filters.due === tile.due ? <Badge size="sm" tone="primary">Filtered</Badge> : undefined}
                            onClick={() => setFilters(toggleQuickDue(filters, tile.due))}
                        />
                    ))}
                </KpiGrid>
            }
            search={<SearchInput placeholder="Search tasks..." value={filters.search} onChange={(v: string) => setFilters({ ...filters, search: v })} />}
            filterConfig={filterConfig}
            views={(canViewTeam || canViewAll) ? (
                <SegmentedControl
                    aria-label="Task scope"
                    data-testid="tasks-scope-views"
                    value={filters.scope}
                    onChange={(id: string) => setFilters({ ...filters, scope: id as TaskListFilters['scope'] })}
                    options={[
                        { value: 'own', label: 'My Tasks' },
                        ...(canViewTeam ? [{ value: 'team', label: 'Team Tasks' }] : []),
                        ...(canViewAll ? [{ value: 'all', label: 'All Tasks' }] : []),
                    ]}
                />
            ) : undefined}
            toolbarEnd={
                <div className="flex items-center gap-2">
                    <Select name="task-view" aria-label="Task view" size="sm" value={activeView} onValueChange={applyView} options={viewOptions} data-testid="tasks-view-select" />
                    {activeView.startsWith('saved:') && (
                        <IconButton label="Delete saved view" size="sm" icon={<Trash2 size={14} />} data-testid="tasks-delete-view" onClick={() => handleDeleteView(activeView.slice('saved:'.length))} />
                    )}
                </div>
            }
            pagination={total > TASK_PAGE_SIZE ? (
                <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={TASK_PAGE_SIZE} onPageChange={setPage} />
            ) : undefined}
        >
            <Grid gap="md">
                <GridItem span={{ lg: 8 }}>
                    <DataTable
                        name="tasks"
                        data-testid="tasks-table"
                        rows={items}
                        rowKey={(t: Task) => t.id}
                        columns={columns}
                        loading={loading}
                        onRowClick={(t: Task) => navigate(`${t.id}`)}
                        emptyState={hasNoFilters(filters) ? 'No tasks yet.' : 'No tasks match these filters.'}
                        sortKey={filters.sort || undefined}
                        sortDir={filters.sort ? filters.order : undefined}
                        onSortChange={(key: string, dir?: 'asc' | 'desc' | null) =>
                            setFilters(dir && SORT_KEYS[key] ? { ...filters, sort: SORT_KEYS[key], order: dir } : { ...filters, sort: '', order: 'asc' })}
                        rowActions={canCreateTask ? (t: Task) => [{ label: 'Delete task', danger: true, onSelect: () => setDeleteId(t.id) }] : undefined}
                    />
                </GridItem>
                <GridItem span={{ lg: 4 }}>
                    <UpNextPanel
                        items={upNext}
                        loading={upNextLoading}
                        formatTime={fmt.formatTime}
                        formatDay={(iso: string) => formatters.formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })}
                        onOpen={(t: UpNextTask) => navigate(`${t.id}`)}
                    />
                </GridItem>
            </Grid>

            {showCreate && (
                <TaskModal task={null} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); reload(); }} />
            )}

            {saveOpen && (
                <Modal
                    isOpen
                    onClose={() => setSaveOpen(false)}
                    size="md"
                    title="Save view"
                    data-testid="save-task-view-modal"
                    footer={<>
                        <Button variant="secondary" onClick={() => setSaveOpen(false)}>Cancel</Button>
                        <Button data-testid="save-task-view-confirm" disabled={!viewName.trim()} onClick={handleSaveView}>Save</Button>
                    </>}
                >
                    <TextField name="task-view-name" label="View name" value={viewName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setViewName(e.target.value)} />
                </Modal>
            )}

            {deleteId && (
                <Modal
                    isOpen
                    onClose={() => setDeleteId(null)}
                    size="md"
                    title="Delete Task"
                    data-testid="delete-task-modal"
                    footer={<>
                        <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="danger" onClick={() => handleDelete(deleteId)}>Delete</Button>
                    </>}
                >
                    <p className="text-fg-subtle">Are you sure you want to delete this task? This action cannot be undone.</p>
                </Modal>
            )}
        </ListPageTemplate>
    );
};

export default SmartTasksList;
