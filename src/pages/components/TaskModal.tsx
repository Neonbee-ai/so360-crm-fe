import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, UserPlus, Link2 } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { ProjectSelect } from '../../components/common/ProjectSelect';
import { composeDueDate, dueDateCalendarDay, inputValueToApiValue, splitStoredDueDate } from '../../utils/datetime';
import { Task, TaskType, TaskPriority, TASK_PRIORITY_OPTIONS, User, Lead, Deal } from '../../types/crm';
import { toast, Button, TextField, Textarea, Select, DatePicker, TimePicker, Grid, GridItem } from '@so360/design-system';
import { Modal } from '../../components/common/Modal';
import { useShell, useActivity } from '@so360/shell-context';

interface TaskModalProps {
    task?: Task | null; // If null, creating new task
    leadId?: string;
    dealId?: string;
    stakeholderId?: string;
    // The connected Deal's linked Project, when known — used only to
    // auto-suggest a Project on this task; the user may still change or
    // clear it. Passed by callers that already have the Deal loaded (e.g.
    // DealDetailPage); optional so callers without that context are unaffected.
    dealProjectId?: string;
    onClose: () => void;
    onSuccess: (task: Task) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, leadId, dealId, stakeholderId, dealProjectId, onClose, onSuccess }) => {
    const shell = useShell();
    const { recordActivity } = useActivity();
    const currentUser = shell?.user;
    const currentUserId = currentUser?.id;
    const isEditing = !!task;
    // Use local date/time (not UTC) so min constraint is correct in all timezones
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const todayDatetime = `${todayDate}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [startDate, setStartDate] = useState(() => {
        if (!task?.start_date) return '';
        return dueDateCalendarDay(task.start_date);
    });
    const [dueDate, setDueDate] = useState(() => splitStoredDueDate(task?.due_date).date);
    const [dueTime, setDueTime] = useState(() => splitStoredDueDate(task?.due_date).time);
    const [status, setStatus] = useState<Task['status']>(task?.status || 'OPEN');
    const [type, setType] = useState<TaskType>(task?.type || 'TODO');
    const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'MEDIUM');
    // The assignee the task was loaded with. Edits only send assignee_id when
    // it differs from this, so saving an unrelated field can never reassign.
    const originalAssigneeId = task?.assigned_to?.id || '';
    const [assignedToId, setAssignedToId] = useState(originalAssigneeId);
    const [reminderMinutes, setReminderMinutes] = useState(task?.reminder_minutes_before?.toString() || '');
    const [users, setUsers] = useState<User[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const showAssociatePicker = !leadId && !dealId && !isEditing;
    const [associateType, setAssociateType] = useState<'none' | 'lead' | 'deal'>('none');
    const [associateId, setAssociateId] = useState('');
    const [leads, setLeads] = useState<Lead[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    // Optional Project connection. Pre-selected from the task's existing
    // connection when editing, or from the parent Deal's project when
    // creating from a Deal context — either way the user can change/clear it.
    const [projectId, setProjectId] = useState(task?.project_id || dealProjectId || '');

    useEffect(() => {
        const fetchUsers = async () => {
            const usersData = await crmService.getUsers();

            // If API returns no users but we have the current user from shell, use them as fallback
            let finalUsers = usersData;
            if (usersData.length === 0 && currentUser?.id) {
                finalUsers = [{
                    id: currentUser.id,
                    full_name: (currentUser as any).full_name || (currentUser as any).email || 'Me',
                    email: (currentUser as any).email || '',
                    avatar_url: (currentUser as any).avatar_url || null
                }];
            }

            setUsers(finalUsers);
            // A new task starts assigned to its creator — never to whoever the
            // user list happens to return first, which is how tasks landed on
            // the wrong person. An existing task keeps exactly what it had.
            if (!isEditing && !assignedToId && currentUserId && finalUsers.some(u => u.id === currentUserId)) {
                setAssignedToId(currentUserId);
            }
        };
        const fetchAssociateOptions = async () => {
            if (!showAssociatePicker) return;
            const [leadsData, dealsData] = await Promise.all([
                crmService.getLeads({ take: 200 }).catch(() => []),
                crmService.getDeals().catch(() => []),
            ]);
            setLeads(leadsData);
            setDeals(dealsData);
        };
        fetchUsers();
        fetchAssociateOptions();
    }, []);

    const handleAssignToMe = () => {
        if (!currentUserId) return;
        setAssignedToId(currentUserId);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!dueDate) {
            toast.error('Please select a due date.');
            return;
        }
        // A reminder is an alarm — it is meaningless without the moment to ring.
        // Every other kind may stay date-only.
        if (type === 'REMINDER' && !dueTime) {
            toast.error('Please pick a date AND time for the reminder.');
            return;
        }
        // Compare calendar days as strings: both sides are the user's own local
        // date, so no instant — and no timezone shift — enters the comparison.
        if (dueDate < todayDate) {
            toast.error('Due Date cannot be in the past. Please select today or a future date.');
            return;
        }
        // A time already gone by today is past too, now that tasks carry one.
        if (dueTime && dueDate === todayDate && `${dueDate}T${dueTime}` < todayDatetime) {
            toast.error('Due time cannot be in the past. Please pick a later time.');
            return;
        }
        if (!isEditing && !assignedToId) {
            toast.error('Please choose who this task is assigned to.');
            return;
        }

        const assigneeChanged = assignedToId !== originalAssigneeId;
        const projectChanged = projectId !== (task?.project_id || '');

        setIsSubmitting(true);
        try {
            // A project-linked task can only belong to a member of that
            // project. Checked before saving so the task is never created in
            // CRM with an owner the project board would silently drop.
            if (projectId && assignedToId && (projectChanged || assigneeChanged)) {
                const teamUserIds = await crmService.getProjectTeamUserIds(projectId);
                if (teamUserIds && !teamUserIds.includes(assignedToId)) {
                    const name = users.find(u => u.id === assignedToId)?.full_name || 'The selected assignee';
                    toast.error(`${name} is not a member of the selected project. Assign the task to a project member, or add them to the project team first.`);
                    return;
                }
            }

            const data: any = {
                title,
                description,
                status: status.toUpperCase(),
                type: type.toUpperCase(),
                priority,
            };
            if (!isEditing) {
                data.assignee_id = assignedToId;
            } else if (assigneeChanged) {
                data.assignee_id = assignedToId || null;
            }

            if (startDate) {
                // Send the calendar day itself. Anchoring it to local midnight and
                // normalising to UTC rolled it back a day east of Greenwich.
                data.start_date = inputValueToApiValue(startDate);
            }

            data.due_date = composeDueDate(dueDate, dueTime);
            if (type === 'REMINDER' && reminderMinutes) {
                data.reminder_minutes_before = parseInt(reminderMinutes);
            }

            if (leadId) data.lead_id = leadId;
            if (dealId) data.deal_id = dealId;
            if (stakeholderId) data.stakeholder_id = stakeholderId;
            if (showAssociatePicker && associateId) {
                if (associateType === 'lead') data.lead_id = associateId;
                if (associateType === 'deal') data.deal_id = associateId;
            }

            let result: Task;
            if (isEditing && task) {
                result = await crmService.updateTask(task.id, data);
            } else {
                result = await crmService.createTask(data);
            }

            // Project connection is best-effort: the task itself is already
            // saved by this point, so a connect failure must not roll that back
            // or block the modal from closing — just tell the user quietly.
            if (projectId && projectId !== task?.project_id && result?.id) {
                try {
                    const connected = await crmService.connectTaskToProject(result.id, projectId);
                    // Hand callers the task as it is *after* linking (project_id,
                    // sync status), not the pre-link copy — otherwise lists show
                    // the task unlinked until a refresh.
                    const linkedTask = (connected as any)?.task;
                    if (linkedTask?.id === result.id) result = linkedTask;
                } catch (connectError) {
                    const reason = (connectError as Error)?.message || 'Unknown error';
                    toast.warning(`Task ${isEditing ? 'updated' : 'created'}, but couldn't connect to Project: ${reason}`);
                }
            }

            // The assignment notification is sent by the backend on create and
            // on reassignment; emitting one here too double-notified.
            recordActivity({ eventType: isEditing ? 'task.updated' : 'task.created', eventCategory: 'crm', description: `${isEditing ? 'Updated' : 'Created'} task "${title}"`, resourceType: 'task', resourceId: result?.id }).catch(() => {});
            onSuccess(result);
            onClose();
        } catch (error) {
            console.error('Failed to save task', error);
            // ApiClient already unwraps the API body (class-validator returns an
            // array of messages, joined). Discarding it turned every rejection —
            // including precise field validation — into a bare "Failed to save
            // task", which is what made the priority mismatch so hard to trace.
            const status = (error as { status?: number })?.status;
            const detail = (error as Error)?.message;
            const isActionable = !!detail && status !== undefined && status < 500;
            toast.error(isActionable ? detail : 'Failed to save task. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="lg"
            dismissible={!isSubmitting}
            data-testid="task-modal"
            title={
                <span className="flex items-center gap-2">
                    <CheckCircle2 className={isEditing ? "text-primary" : "text-success"} size={24} />
                    {isEditing ? 'Edit Task' : 'New Task'}
                </span>
            }
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" form="task-modal-form" variant="primary" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                        {isEditing ? 'Save Changes' : 'Create Task'}
                    </Button>
                </>
            }
        >
                <form id="task-modal-form" onSubmit={handleSubmit} className="flex flex-col">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <TextField
                            name="task-title"
                            label="Task Title"
                            type="text"
                            value={title}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                            required
                            placeholder="e.g. Follow up email..."
                        />

                        <Textarea
                            name="task-description"
                            label="Description"
                            value={description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                            placeholder="Add details..."
                            rows={3}
                        />

                        <Select
                            name="task-priority"
                            label="Priority"
                            value={priority}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriority(e.target.value as TaskPriority)}
                            options={TASK_PRIORITY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                        />

                        <Select
                            name="task-type"
                            label="Type"
                            value={type}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                const nextType = e.target.value as TaskType;
                                setType(nextType);
                                // A reminder must ring at a moment; offer a
                                // sensible one rather than an empty field.
                                if (nextType === 'REMINDER' && !dueTime) setDueTime('09:00');
                            }}
                            options={[
                                { value: 'TODO', label: 'To Do' },
                                { value: 'CALL', label: 'Call' },
                                { value: 'EMAIL', label: 'Email' },
                                { value: 'MEETING', label: 'Meeting' },
                                { value: 'REMINDER', label: 'Reminder' },
                            ]}
                        />
                        <Grid gap="md">
                            <GridItem span={{ md: 4, lg: 6 }}><DatePicker
                                name="task-start-date"
                                label="Start Date"
                                value={startDate}
                                onChange={(v: string) => setStartDate(v)}
                            /></GridItem>
                            <GridItem span={{ md: 4, lg: 6 }}><DatePicker
                                name="task-due-date"
                                label="Due Date"
                                value={dueDate}
                                onChange={(v: string) => setDueDate(v)}
                                min={todayDate}
                                required
                            /></GridItem>
                        </Grid>

                        {/* Due time is optional for every kind except Reminder, which
                            is an alarm. Left blank the task stays a plain calendar
                            date — no invented 9am, no invented midnight. */}
                        <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                                <TimePicker
                                    name="task-due-time"
                                    label={`Due Time ${type === 'REMINDER' ? '*' : '(optional)'}`}
                                    value={dueTime}
                                    onChange={(v: string) => setDueTime(v)}
                                    required={type === 'REMINDER'}
                                />
                            </div>
                            {dueTime && type !== 'REMINDER' && (
                                <Button type="button" variant="secondary" onClick={() => setDueTime('')}>
                                    Clear
                                </Button>
                            )}
                        </div>

                        {type === 'REMINDER' && (
                            <Select
                                name="task-reminder-minutes"
                                label="Remind me before"
                                value={reminderMinutes}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReminderMinutes(e.target.value)}
                                options={[
                                    { value: '', label: 'No reminder notification' },
                                    { value: '15', label: '15 minutes before' },
                                    { value: '30', label: '30 minutes before' },
                                    { value: '60', label: '1 hour before' },
                                    { value: '1440', label: '1 day before' },
                                ]}
                            />
                        )}

                        <div className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                                <Select
                                    name="task-assigned-to"
                                    label="Assigned To"
                                    value={assignedToId}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignedToId(e.target.value)}
                                    options={[
                                        { value: '', label: isEditing ? 'Unassigned' : 'Select assignee…' },
                                        ...users.map(u => ({ value: u.id, label: `${u.full_name}${u.id === currentUserId ? ' (You)' : ''}` })),
                                    ]}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleAssignToMe}
                                disabled={!currentUserId || assignedToId === currentUserId}
                                title={
                                    !currentUserId
                                        ? "User session not available"
                                        : assignedToId === currentUserId
                                        ? "Already assigned to you"
                                        : "Assign this task to yourself"
                                }
                            >
                                <UserPlus className="w-4 h-4" />
                                <span className="text-xs font-semibold">Me</span>
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-fg-muted flex items-center gap-1.5">
                                <Link2 size={12} />
                                Project <span className="text-fg-muted font-bold">(optional)</span>
                            </label>
                            <ProjectSelect value={projectId} onChange={setProjectId} />
                            {projectId && (
                                <p className="text-xs text-fg-muted">
                                    This task will be synchronized with the selected Project.
                                </p>
                            )}
                        </div>

                        {showAssociatePicker && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-fg-muted flex items-center gap-1.5">
                                    <Link2 size={12} />
                                    Associate With
                                </label>
                                <Grid gap="md">
                                    <GridItem span={{ md: 4, lg: 6 }}><Select
                                        name="task-associate-type"
                                        aria-label="Associate type"
                                        value={associateType}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setAssociateType(e.target.value as any); setAssociateId(''); }}
                                        options={[
                                            { value: 'none', label: 'None' },
                                            { value: 'lead', label: 'Lead' },
                                            { value: 'deal', label: 'Deal' },
                                        ]}
                                    /></GridItem>
                                    {associateType !== 'none' && (
                                        <GridItem span={{ md: 4, lg: 6 }}><Select
                                            name="task-associate-id"
                                            aria-label="Associate record"
                                            value={associateId}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssociateId(e.target.value)}
                                            options={[
                                                { value: '', label: `Select ${associateType === 'lead' ? 'Lead' : 'Deal'}…` },
                                                ...(associateType === 'lead'
                                                    ? leads.map(l => ({ value: l.id, label: l.company_name || l.contact_name || '' }))
                                                    : deals.map(d => ({ value: d.id, label: d.name || d.company_name || '' }))),
                                            ]}
                                        /></GridItem>
                                    )}
                                </Grid>
                            </div>
                        )}

                        {isEditing && (
                            <Select
                                name="task-status"
                                label="Status"
                                value={status}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as Task['status'])}
                                options={[
                                    { value: 'OPEN', label: 'Open' },
                                    { value: 'IN_PROGRESS', label: 'In Progress' },
                                    { value: 'DONE', label: 'Done' },
                                    { value: 'ON_HOLD', label: 'On Hold' },
                                    { value: 'CANCELLED', label: 'Cancelled' },
                                ]}
                            />
                        )}
                    </div>

                </div>
                </form>
        </Modal>
    );
};

export default TaskModal;
