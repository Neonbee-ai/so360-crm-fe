import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    CheckCircle2, Circle, Calendar,
    User as UserIcon, Briefcase, Clock, AlertCircle, Trash2, Edit2,
    Link2, Unlink, RefreshCw
} from 'lucide-react';
import { crmService } from '../services/crmService';
import { Task } from '../types/crm';
import { Loader2 } from 'lucide-react';
import TaskModal from './components/TaskModal';
import { RescheduleModal } from './components/RescheduleModal';
import { ShellContext, useActivity, useShellBridge } from '@so360/shell-context';
import { toast, getErrorMessage, CrossLinkChip, DetailPageTemplate, Button, Card, Badge, StatusBadge, EmptyState, Alert, IconButton, Textarea, RadioGroup, Skeleton } from '@so360/design-system';
import { CrmScope } from '../utils/crmScope';
import { useCRMFormatters } from '../utils/formatters';
import { isTaskLocked, canRescheduleTask, canEditTask, isTaskOverdue, TASK_LOCKED_HINT } from '../utils/taskUtils';
import { dueDateCalendarDay, hasTimeComponent } from '../utils/datetime';
import { Modal } from '../components/common/Modal';

const TaskDetailPage = () => {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const formatters = useCRMFormatters();
    const shell = useContext(ShellContext) as any;
    const currentUserId = shell?.user?.id;
    const { recordActivity } = useActivity();
    const shellBridge = useShellBridge();
    const canCreateTask = (shellBridge?.permissionsLoaded === true) && (shellBridge?.hasPermission?.('activities.create') ?? false) && (shellBridge?.effectiveFlagsLoaded !== false) && (shellBridge?.isFeatureEnabled?.('action:crm:tasks:create') ?? true);
    const [task, setTask] = useState<Task | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditingTask, setIsEditingTask] = useState(false);
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [notes, setNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [notesError, setNotesError] = useState<string | null>(null);
    const [isRetryingNotes, setIsRetryingNotes] = useState(false);
    const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<{ id: string; content: string } | null>(null);
    const [isRetryingSync, setIsRetryingSync] = useState(false);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
    const [disconnectMode, setDisconnectMode] = useState<'remove_project_task' | 'keep_but_disconnect'>('keep_but_disconnect');
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const refreshNotes = async (taskId: string) => {
        try {
            const notesData = await crmService.getTaskNotes(taskId);
            setNotes(notesData || []);
            setNotesError(null);
            return true;
        } catch (error) {
            console.error('Failed to fetch task notes:', error);
            setNotesError('Unable to load notes right now. Please try again.');
            return false;
        }
    };

    useEffect(() => {
        const fetchTask = async () => {
            try {
                // Load users first (populates cache for note author enrichment)
                await crmService.getUsers().catch(err => {
                    console.warn('Failed to load users for enrichment:', err);
                });

                // Fetch task data (required)
                const taskData = await crmService.getTaskById(id);
                setTask(taskData || null);

                // Fetch notes data (independent of task load — a notes failure
                // must never block the task itself from rendering)
                await refreshNotes(id);
            } catch (error) {
                console.error('Failed to fetch task', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTask();
    }, [id]);

    const handleRetryNotes = async () => {
        if (!task) return;
        setIsRetryingNotes(true);
        await refreshNotes(task.id);
        setIsRetryingNotes(false);
    };

    const handleTaskToggle = async () => {
        if (!task) return;
        const newStatus = task.status === 'DONE' ? 'OPEN' : 'DONE';
        try {
            // Optimistic update
            setTask({ ...task, status: newStatus });
            // Action availability must update immediately: close any editing
            // surface that is no longer valid for a completed task.
            if (isTaskLocked(newStatus)) {
                setIsRescheduling(false);
                setIsEditingTask(false);
            }

            await crmService.updateTask(task.id, { status: newStatus });
            if (newStatus === 'DONE') {
                recordActivity({ eventType: 'task.completed', eventCategory: 'crm', description: `Completed task "${task.title}"`, resourceType: 'task', resourceId: task.id }).catch(() => {});
            } else {
                recordActivity({ eventType: 'task.updated', eventCategory: 'crm', description: `Reopened task "${task.title}"`, resourceType: 'task', resourceId: task.id }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to toggle task status:', error);
            // Revert
            setTask({ ...task, status: task.status });
        }
    };

    const handleTaskUpdate = async () => {
        setIsEditingTask(false);
        // Refresh task data
        const data = await crmService.getTaskById(id);
        setTask(data || null);
    };

    const handleReschedule = async (date: string) => {
        if (!task) return;
        if (!canRescheduleTask(task.status)) {
            toast.warning(TASK_LOCKED_HINT);
            setIsRescheduling(false);
            return;
        }
        try {
            await crmService.updateTask(task.id, { due_date: date });
            setTask({ ...task, due_date: date });
            setIsRescheduling(false);
            recordActivity({ eventType: 'task.rescheduled', eventCategory: 'crm', description: `Rescheduled task "${task.title}" to ${formatters.formatDate(date)}`, resourceType: 'task', resourceId: task.id }).catch(() => {});
        } catch (error) {
            console.error('Failed to reschedule task:', error);
        }
    };

    const handleDelete = async () => {
        if (!task) return;
        try {
            await crmService.deleteTask(task.id);
            navigate('/crm/tasks');
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    };

    const handleRetrySync = async () => {
        if (!task) return;
        setIsRetryingSync(true);
        try {
            const updated = await crmService.retryTaskProjectSync(task.id);
            setTask(updated || task);
            toast.success('Project sync retried.');
        } catch (error) {
            console.error('Failed to retry project sync:', error);
            toast.error(getErrorMessage(error, 'Failed to retry sync. Please try again.'));
        } finally {
            setIsRetryingSync(false);
        }
    };

    const handleDisconnect = async () => {
        if (!task) return;
        setIsDisconnecting(true);
        try {
            const updated = await crmService.disconnectTaskFromProject(task.id, disconnectMode);
            setTask(updated || { ...task, sync_status: 'disconnected' });
            setShowDisconnectConfirm(false);
            toast.success('Task disconnected from Project.');
        } catch (error) {
            console.error('Failed to disconnect task from project:', error);
            toast.error(getErrorMessage(error, 'Failed to disconnect from Project. Please try again.'));
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (isLoading) {
        return (
            <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4">
                <Skeleton variant="rect" />
                <Skeleton variant="text" lines={3} />
                <span className="sr-only">Loading task details...</span>
            </div>
        );
    }

    if (!task) {
        return (
            // Comb root (data-comb-path) so readiness checks settle on a bad/missing id instead of spinning.
            <DetailPageTemplate title="Task not found" trail={[{ label: 'Tasks', to: '/crm/tasks' }]}>
                <EmptyState title="Task not found." action={{ label: 'Back to Tasks', onClick: () => navigate('/crm/tasks') }} />
            </DetailPageTemplate>
        );
    }

    const isOverdue = isTaskOverdue(task);
    const isLocked = isTaskLocked(task.status);
    const canEdit = canEditTask(task.status);
    const canReschedule = canRescheduleTask(task.status);

    return (
        <DetailPageTemplate
            trail={[{ label: 'Tasks', to: '/crm/tasks' }]}
            title={task.title}
            status={
                <span className="flex items-center gap-nb-2">
                    <StatusBadge
                        status={task.status}
                        size="sm"
                        map={{ done: 'success', in_progress: 'warning', on_hold: 'warning', cancelled: 'danger' }}
                    />
                    {isOverdue && (
                        <Badge size="sm" tone="danger"><AlertCircle size={12} /> Overdue</Badge>
                    )}
                </span>
            }
            primaryAction={
                <Button
                    onClick={() => canEdit && setIsEditingTask(true)}
                    disabled={!canEdit}
                    aria-label="Edit Task"
                    title={canEdit ? 'Edit Task' : TASK_LOCKED_HINT}
                ><Edit2 size={14} />
                    Edit
                </Button>
            }
            secondaryActions={[
                <Button key="toggle" variant="secondary" onClick={handleTaskToggle}>
                    {task.status === 'DONE' ? 'Mark as Open' : 'Mark as Complete'}
                </Button>,
                <Button
                    key="reschedule"
                    variant="secondary"
                    onClick={() => canReschedule && setIsRescheduling(true)}
                    disabled={!canReschedule}
                    title={canReschedule ? 'Reschedule this task' : TASK_LOCKED_HINT}
                >
                    Reschedule
                </Button>,
            ]}
            overflowActions={canCreateTask ? [{ label: 'Delete Task', danger: true, onSelect: () => setShowDeleteConfirm(true) }] : []}
            sidePanel={
                <div className="flex flex-col gap-nb-3">
                    <Card title="Assignee">
                        <div className="flex items-center gap-nb-3">
                            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-raised text-fg">
                                {task.assigned_to.avatar_url ? <img src={task.assigned_to.avatar_url} alt={task.assigned_to.full_name} /> : task.assigned_to.full_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-fg">{task.assigned_to.full_name}</p>
                                <p className="text-xs text-fg-muted">Sales Representative</p>
                            </div>
                        </div>
                    </Card>

                    <Card title="Schedule">
                        <p className="text-xs text-fg-muted">Due date</p>
                        <p className={`text-sm ${isOverdue ? 'text-danger' : 'text-fg'}`}>
                            {formatters.formatDate(dueDateCalendarDay(task.due_date), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            {/* The time appears only when the user chose one. */}
                            {hasTimeComponent(task.due_date) && (
                                <span className="ml-2 text-fg-subtle">{formatters.formatDate(task.due_date, { hour: 'numeric', minute: '2-digit' })}</span>
                            )}
                        </p>
                        {isLocked && (
                            <p className="mt-nb-2 text-xs text-fg-muted" data-testid="task-locked-hint">
                                {TASK_LOCKED_HINT}
                            </p>
                        )}
                    </Card>
                </div>
            }
        >

            <div className="flex flex-col gap-nb-3">
                <Card title="Related information">
                    <div className="flex flex-col gap-nb-4">
                        {(task.deal_name || task.deal_id) && (
                            <div className="flex items-center gap-nb-3">
                                <Briefcase size={18} className="shrink-0 text-fg-muted" />
                                <div className="min-w-0">
                                    <span className="block text-xs text-fg-muted">Associated deal</span>
                                    <Link to={`/deals/${task.deal_id}`} className="block truncate text-sm font-medium text-fg hover:text-primary">
                                        {task.deal_name || 'View Deal'}
                                    </Link>
                                </div>
                            </div>
                        )}

                        {(task.lead_id) && !task.deal_id && (
                            <div className="flex items-center gap-nb-3">
                                <UserIcon size={18} className="shrink-0 text-fg-muted" />
                                <div className="min-w-0">
                                    <span className="block text-xs text-fg-muted">Related lead</span>
                                    <Link to={`/crm/leads/${task.lead_id}`} className="block truncate text-sm font-medium text-fg hover:text-primary">
                                        View Lead
                                    </Link>
                                </div>
                            </div>
                        )}

                            {/* Project connection status. `sync_status` is only present
                                once the task has (or once had) a Project connection —
                                absent/undefined means unaffected behavior, no UI at all. */}
                            {task.sync_status === 'connected' && (
                                <div className="flex items-center gap-4" data-testid="project-sync-connected">
                                    <div className="size-10 rounded-xl bg-success/10 flex items-center justify-center text-success shrink-0">
                                        <Link2 size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="text-xs text-fg-muted block mb-1">Connected to Project</span>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {task.project_id && <CrossLinkChip type="projects.project" id={task.project_id} />}
                                            {task.last_synced_at && (
                                                <span className="text-xs text-fg-muted">
                                                    Last synced {formatters.formatDate(task.last_synced_at, { hour: 'numeric', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <IconButton
                                        label="Disconnect from Project"
                                        variant="danger"
                                        icon={<Unlink size={16} />}
                                        onClick={() => { setDisconnectMode('keep_but_disconnect'); setShowDisconnectConfirm(true); }}
                                    />
                                </div>
                            )}

                            {task.sync_status === 'sync_failed' && (
                                <div className="flex items-center gap-4" data-testid="project-sync-failed">
                                    <div className="size-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger shrink-0">
                                        <AlertCircle size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="text-xs text-danger block mb-1">Sync Failed</span>
                                        <span className="text-sm text-fg-subtle">This task couldn't be synchronized with its Project.</span>
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={handleRetrySync} disabled={isRetryingSync}>
                                        {isRetryingSync ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Retry Sync
                                    </Button>
                                </div>
                            )}

                            {task.sync_status === 'disconnected' && (
                                <p className="text-xs text-fg-muted italic" data-testid="project-sync-disconnected">
                                    Previously connected to a Project.
                                </p>
                            )}
                    </div>
                </Card>

                <Card title="Description">
                    <p className={`text-sm leading-relaxed text-fg-subtle ${!task.description ? 'italic' : ''}`}>
                        {task.description || 'No additional description provided for this task.'}
                    </p>
                </Card>

                {/* Notes & Comments Section */}
                <Card
                    title="Notes & Comments"
                    actions={canCreateTask && !notesError && !isAddingNote ? (
                        <Button variant="secondary" onClick={() => setIsAddingNote(true)}>+ Add Note</Button>
                    ) : undefined}
                >
                        {notesError && (
                            <Alert
                                variant="warning"
                                className="mb-nb-3"
                                action={{
                                    label: isRetryingNotes ? 'Retrying…' : 'Retry',
                                    onClick: () => { if (!isRetryingNotes) handleRetryNotes(); },
                                }}
                            >
                                {notesError}
                            </Alert>
                        )}

                        {/* Collapsed state: a compact input that expands into the full
                            editor on click, so the section stays quiet when idle. */}
                        {canCreateTask && !notesError && !isAddingNote && (
                            <Button variant="secondary"
                                type="button"
                                onClick={() => setIsAddingNote(true)}
                                data-testid="note-composer-trigger"
                                className="w-full !justify-start !text-left"
                            >
                                Add a note or comment...
                            </Button>
                        )}

                        {isAddingNote && (
                            <div className="mb-nb-3 border-b border-line pb-nb-3">
                                <Textarea
                                    name="task-new-note"
                                    autoFocus
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Add a note or comment..."
                                    rows={4}
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <Button variant="secondary" onClick={() => { setNewNote(''); setIsAddingNote(false); }}>
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={async () => {
                                            if (!task || !newNote.trim()) return;
                                            try {
                                                await crmService.createNote({ content: newNote, task_id: task.id });
                                                await refreshNotes(task.id);
                                                setNewNote('');
                                                setIsAddingNote(false);
                                                recordActivity({ eventType: 'note.added', eventCategory: 'crm', description: `Added a note on task "${task.title}"`, resourceType: 'task', resourceId: task.id }).catch(() => {});
                                            } catch (error) {
                                                console.error('Failed to create note:', error);
                                                toast.error(getErrorMessage(error, 'Failed to add note. Please try again.'));
                                            }
                                        }}
                                    >
                                        Add Note
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="divide-y divide-line">
                            {notes.length === 0 ? (
                                !notesError && (
                                    <EmptyState title="No notes added yet. Add the first note to collaborate with your team." />
                                )
                            ) : (
                                notes.map(note => {
                                    const isAuthor = currentUserId && note.author?.id === currentUserId;
                                    const isEdited = !!note.updated_at && note.updated_at !== note.created_at;

                                    return (
                                        <div key={note.id} className="group py-nb-3 first:pt-0 last:pb-0">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                                                        {note.author?.avatar_url ? (
                                                            <img src={note.author.avatar_url} alt={note.author?.full_name || 'User'} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-xs font-bold text-primary">
                                                                {note.author?.full_name?.[0] || 'U'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-medium text-fg-subtle">
                                                        {note.author?.full_name || 'Unknown User'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-fg-muted">
                                                        {formatters.formatDate(note.created_at)}
                                                        {isEdited && <span className="italic"> · Edited</span>}
                                                    </span>
                                                    {isAuthor && (
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <IconButton label="Edit note" icon={<Edit2 size={14} />} onClick={() => setEditingNote({ id: note.id, content: note.content })} />
                                                            <IconButton label="Delete note" variant="danger" icon={<Trash2 size={14} />} onClick={() => setDeleteNoteId(note.id)} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-fg-subtle whitespace-pre-wrap">{note.content}</p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                </Card>
            </div>

            {/* Task Edit Modal */}
            {isEditingTask && (
                <TaskModal
                    task={task}
                    leadId={task?.lead_id}
                    dealId={task?.deal_id}
                    onClose={() => setIsEditingTask(false)}
                    onSuccess={(updatedTask) => {
                        setTask(updatedTask);
                        setIsEditingTask(false);
                    }}
                />
            )}

            {/* Reschedule Modal */}
            {isRescheduling && task && (
                <RescheduleModal
                    currentDate={task.due_date}
                    onClose={() => setIsRescheduling(false)}
                    onConfirm={async (newDate) => {
                        await handleReschedule(newDate);
                        setIsRescheduling(false);
                    }}
                />
            )}

            {/* Edit Note Modal */}
            <Modal isOpen={!!editingNote} onClose={() => setEditingNote(null)} title="Edit Note" size="md">
                {editingNote && (
                    <div className="flex flex-col gap-nb-3">
                        <p className="text-sm text-fg-subtle">Update your note content below.</p>
                        <Textarea
                            name="task-edit-note"
                            value={editingNote.content}
                            onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                            placeholder="Note content..."
                            rows={6}
                        />
                        <div className="flex gap-nb-2 justify-end">
                            <Button variant="secondary" onClick={() => setEditingNote(null)}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={async () => {
                                    if (!editingNote.content.trim()) {
                                        toast.warning('Note content cannot be empty.');
                                        return;
                                    }
                                    try {
                                        await crmService.updateNote(editingNote.id, editingNote.content);
                                        await refreshNotes(task.id);
                                        setEditingNote(null);
                                        recordActivity({ eventType: 'note.updated', eventCategory: 'crm', description: `Edited a note on task "${task.title}"`, resourceType: 'task', resourceId: task.id }).catch(() => {});
                                    } catch (error) {
                                        console.error('Failed to update note:', error);
                                        toast.error(getErrorMessage(error, 'Failed to update note. Please try again.'));
                                    }
                                }}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete Note Confirmation Modal */}
            <Modal isOpen={!!deleteNoteId} onClose={() => setDeleteNoteId(null)} title="Delete Note" size="md">
                {deleteNoteId && (
                    <div className="flex flex-col gap-nb-3">
                        <p className="text-sm text-fg-subtle">
                            Are you sure you want to delete this note? This action cannot be undone.
                        </p>
                        <div className="flex gap-nb-2 justify-end">
                            <Button variant="secondary" onClick={() => setDeleteNoteId(null)}>Cancel</Button>
                            <Button
                                variant="danger"
                                onClick={async () => {
                                    try {
                                        await crmService.deleteNote(deleteNoteId);
                                        await refreshNotes(task.id);
                                        setDeleteNoteId(null);
                                        recordActivity({ eventType: 'note.deleted', eventCategory: 'crm', description: `Deleted a note on task "${task.title}"`, resourceType: 'task', resourceId: task.id }).catch(() => {});
                                    } catch (error) {
                                        console.error('Failed to delete note:', error);
                                        toast.error(getErrorMessage(error, 'Failed to delete note. Please try again.'));
                                    }
                                }}
                            >
                                Delete Note
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Disconnect from Project Confirmation Modal */}
            <Modal isOpen={showDisconnectConfirm} onClose={() => setShowDisconnectConfirm(false)} title="Disconnect from Project" size="md">
                <div className="flex flex-col gap-nb-3">
                    <p className="text-sm text-fg-subtle">Choose what happens to the linked Project task.</p>
                    <div className="flex flex-col gap-nb-2">
                        <CrmScope>
                            <RadioGroup
                                name="disconnect-mode"
                                label="Disconnect mode"
                                value={disconnectMode}
                                onChange={(v: string) => setDisconnectMode(v as typeof disconnectMode)}
                                options={[
                                    { value: 'keep_but_disconnect', label: 'Keep Project task, just disconnect', description: 'The Project task stays as-is; this CRM task stops syncing with it.' },
                                    { value: 'remove_project_task', label: 'Remove the Project task too', description: 'Deletes the connected task on the Project side as well.' },
                                ]}
                            />
                        </CrmScope>
                    </div>
                    <div className="flex gap-nb-2 justify-end">
                        <Button variant="secondary" onClick={() => setShowDisconnectConfirm(false)} disabled={isDisconnecting}>Cancel</Button>
                        <Button variant="danger" onClick={handleDisconnect} disabled={isDisconnecting}>
                            {isDisconnecting && <Loader2 size={12} className="animate-spin" />}
                            Disconnect
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Dialog */}
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Task" size="md">
                <div className="flex flex-col gap-nb-3">
                    <p className="text-fg-subtle">
                        Are you sure you want to delete this task? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-nb-2">
                        <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDelete}>Delete</Button>
                    </div>
                </div>
            </Modal>
        </DetailPageTemplate>
    );
};

export default TaskDetailPage;
