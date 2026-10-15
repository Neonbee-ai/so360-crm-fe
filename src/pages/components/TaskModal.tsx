import React, { useState, useEffect } from 'react';
import { Loader2, Calendar, Clock, CheckCircle2, User as UserIcon, UserPlus, ChevronDown, Link2 } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { ProjectSelect } from '../../components/common/ProjectSelect';
import { composeDueDate, dueDateCalendarDay, inputValueToApiValue, splitStoredDueDate } from '../../utils/datetime';
import { Task, TaskType, TaskPriority, TASK_PRIORITY_OPTIONS, User, Lead, Deal } from '../../types/crm';
import { toast, Button } from '@so360/design-system';
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
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-fg-muted">Task Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-bg border border-line text-fg rounded-nb-lg px-4 py-3 outline-none focus:border-primary transition-all font-bold"
                                required
                                placeholder="e.g. Follow up email..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-fg-muted">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-bg border border-line text-fg rounded-nb-lg px-4 py-3 outline-none focus:border-primary transition-all font-bold resize-none h-20"
                                placeholder="Add details..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-fg-muted">Priority</label>
                            <div className="relative">
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                                    className="w-full bg-bg border border-line text-fg rounded-nb-lg px-4 py-3 pr-9 outline-none focus:border-primary transition-all font-bold appearance-none cursor-pointer"
                                >
                                    {TASK_PRIORITY_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-fg-muted">Type</label>
                            <div className="relative">
                                <select
                                    value={type}
                                    onChange={(e) => {
                                        const nextType = e.target.value as TaskType;
                                        setType(nextType);
                                        // A reminder must ring at a moment; offer a
                                        // sensible one rather than an empty field.
                                        if (nextType === 'REMINDER' && !dueTime) setDueTime('09:00');
                                    }}
                                    className="w-full bg-bg border border-line text-fg rounded-nb-lg px-4 py-3 pr-9 outline-none focus:border-primary transition-all font-bold appearance-none cursor-pointer"
                                >
                                    <option value="TODO">To Do</option>
                                    <option value="CALL">Call</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="MEETING">Meeting</option>
                                    <option value="REMINDER">Reminder</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" size={16} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-fg-muted">Start Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={16} />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-bg border border-line text-fg rounded-nb-lg pl-9 pr-4 py-3 outline-none focus:border-primary transition-all font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="task-due-date" className="text-xs font-semibold text-fg-muted">
                                    Due Date
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={16} />
                                    <input
                                        id="task-due-date"
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        min={todayDate}
                                        className="w-full bg-bg border border-line text-fg rounded-nb-lg pl-9 pr-4 py-3 outline-none focus:border-primary transition-all font-bold"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Due time is optional for every kind except Reminder, which
                            is an alarm. Left blank the task stays a plain calendar
                            date — no invented 9am, no invented midnight. */}
                        <div className="space-y-2">
                            <label htmlFor="task-due-time" className="text-xs font-semibold text-fg-muted">
                                Due Time {type === 'REMINDER' ? <span className="text-danger">*</span> : <span className="text-fg-muted font-bold">(optional)</span>}
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={16} />
                                    <input
                                        id="task-due-time"
                                        type="time"
                                        value={dueTime}
                                        onChange={(e) => setDueTime(e.target.value)}
                                        className="w-full bg-bg border border-line text-fg rounded-nb-lg pl-9 pr-4 py-3 outline-none focus:border-primary transition-all font-bold"
                                        required={type === 'REMINDER'}
                                    />
                                </div>
                                {dueTime && type !== 'REMINDER' && (
                                    <button
                                        type="button"
                                        onClick={() => setDueTime('')}
                                        className="px-3 py-3 rounded-nb-lg border border-line text-xs font-semibold text-fg-subtle hover:text-fg transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {type === 'REMINDER' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-xs font-semibold text-fg-muted">Remind me before</label>
                                <select
                                    value={reminderMinutes}
                                    onChange={(e) => setReminderMinutes(e.target.value)}
                                    className="w-full bg-bg border border-line text-fg rounded-nb-lg px-4 py-3 outline-none focus:border-primary transition-all font-bold appearance-none cursor-pointer"
                                >
                                    <option value="">No reminder notification</option>
                                    <option value="15">15 minutes before</option>
                                    <option value="30">30 minutes before</option>
                                    <option value="60">1 hour before</option>
                                    <option value="1440">1 day before</option>
                                </select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-fg-muted">Assigned To</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" size={16} />
                                    <select
                                        value={assignedToId}
                                        onChange={(e) => setAssignedToId(e.target.value)}
                                        className="w-full bg-bg border border-line text-fg rounded-nb-lg pl-9 pr-4 py-3 outline-none focus:border-primary transition-all font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="">{isEditing ? 'Unassigned' : 'Select assignee…'}</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>
                                                {u.full_name}
                                                {u.id === currentUserId ? ' (You)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAssignToMe}
                                    disabled={!currentUserId || assignedToId === currentUserId}
                                    className="flex items-center gap-1.5 px-3 py-3 text-sm bg-info/10 border border-info/20 rounded-nb-lg text-info hover:bg-info/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                                </button>
                            </div>
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
                                <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                                    <div className="relative">
                                        <select
                                            value={associateType}
                                            onChange={(e) => { setAssociateType(e.target.value as any); setAssociateId(''); }}
                                            className="w-full bg-bg border border-line text-fg rounded-nb-lg px-4 py-3 pr-9 outline-none focus:border-primary transition-all font-bold appearance-none cursor-pointer"
                                        >
                                            <option value="none">None</option>
                                            <option value="lead">Lead</option>
                                            <option value="deal">Deal</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" size={16} />
                                    </div>
                                    {associateType !== 'none' && (
                                        <div className="relative">
                                            <select
                                                value={associateId}
                                                onChange={(e) => setAssociateId(e.target.value)}
                                                className="w-full bg-bg border border-line text-fg rounded-nb-lg px-4 py-3 pr-9 outline-none focus:border-primary transition-all font-bold appearance-none cursor-pointer"
                                            >
                                                <option value="">Select {associateType === 'lead' ? 'Lead' : 'Deal'}…</option>
                                                {associateType === 'lead'
                                                    ? leads.map(l => (
                                                        <option key={l.id} value={l.id}>
                                                            {l.company_name || l.contact_name}
                                                        </option>
                                                    ))
                                                    : deals.map(d => (
                                                        <option key={d.id} value={d.id}>
                                                            {d.name || d.company_name}
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {isEditing && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-fg-muted">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as Task['status'])}
                                    className="w-full bg-bg border border-line rounded-nb-lg px-4 py-3 text-sm font-bold text-fg focus:outline-none focus:ring-2 focus:ring-info/50 focus:border-primary transition-all appearance-none cursor-pointer"
                                >
                                    <option value="OPEN">Open</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="DONE">Done</option>
                                    <option value="ON_HOLD">On Hold</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                        )}
                    </div>

                </div>
                </form>
        </Modal>
    );
};

export default TaskModal;
