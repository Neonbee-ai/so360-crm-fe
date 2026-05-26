import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar, CheckCircle2, User as UserIcon, UserPlus, ChevronDown } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { Task, TaskType, User } from '../../types/crm';
import { ToastContainer, useToast } from '../../components/common/Toast';
import { useShell, useNotify, useActivity } from '@so360/shell-context';

interface TaskModalProps {
    task?: Task | null; // If null, creating new task
    leadId?: string;
    dealId?: string;
    onClose: () => void;
    onSuccess: (task: Task) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, leadId, dealId, onClose, onSuccess }) => {
    const { toasts, showError, dismissToast } = useToast();
    const shell = useShell();
    const { emitNotification } = useNotify();
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
        return new Date(task.start_date).toISOString().split('T')[0];
    });
    const [dueDate, setDueDate] = useState(() => {
        if (!task?.due_date) return '';
        // If it's a reminder, keep the time. task.due_date is ISO string.
        // For input type="datetime-local", format is YYYY-MM-DDTHH:MM
        if (task.type === 'REMINDER') {
            return new Date(task.due_date).toISOString().slice(0, 16);
        }
        return new Date(task.due_date).toISOString().split('T')[0];
    });
    const [status, setStatus] = useState<Task['status']>(task?.status || 'OPEN');
    const [type, setType] = useState<TaskType>(task?.type || 'TODO');
    const [assignedToId, setAssignedToId] = useState(task?.assigned_to?.id || '');
    const [reminderMinutes, setReminderMinutes] = useState(task?.reminder_minutes_before?.toString() || '');
    const [users, setUsers] = useState<User[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            if (!assignedToId && finalUsers.length > 0) {
                setAssignedToId(finalUsers[0].id);
            }
        };
        fetchUsers();
    }, []);

    const handleAssignToMe = () => {
        if (!currentUserId) return;
        setAssignedToId(currentUserId);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Reject past dates regardless of browser min-attribute enforcement
        // Date-only strings (YYYY-MM-DD) must be appended with T00:00:00 so they are
        // parsed as local midnight, not UTC midnight, for a correct timezone comparison.
        if (!dueDate) {
            showError('Please select a due date.');
            return;
        }
        const selectedDate = new Date(dueDate.includes('T') ? dueDate : dueDate + 'T00:00:00');
        const startOfToday = new Date(todayDate + 'T00:00:00');
        if (selectedDate < startOfToday) {
            showError('Due Date cannot be in the past. Please select today or a future date.');
            return;
        }

        setIsSubmitting(true);
        try {
            const data: any = {
                title,
                description,
                status: status.toUpperCase(),
                type: type.toUpperCase(),
                assignee_id: assignedToId
            };

            if (startDate) {
                data.start_date = new Date(startDate + 'T00:00:00').toISOString();
            }

            // Handle date formatting based on type
            if (type === 'REMINDER') {
                data.due_date = new Date(dueDate).toISOString();
                if (reminderMinutes) {
                    data.reminder_minutes_before = parseInt(reminderMinutes);
                }
            } else {
                // For regular tasks, just the date part matters usually, but we store as ISO
                data.due_date = new Date(dueDate).toISOString();
            }

            if (leadId) data.lead_id = leadId;
            if (dealId) data.deal_id = dealId;

            let result: Task;
            if (isEditing && task) {
                result = await crmService.updateTask(task.id, data);
            } else {
                result = await crmService.createTask(data);
            }
            if (!isEditing && assignedToId && assignedToId !== currentUserId) {
                emitNotification({ event: 'CRM_TASK_ASSIGNED', userIds: [assignedToId], variables: { taskTitle: title, actorName: currentUser?.full_name || 'Someone' }, relatedResource: { type: 'task', id: result?.id } }).catch(() => {});
            }
            recordActivity({ eventType: isEditing ? 'task.updated' : 'task.created', eventCategory: 'crm', description: `${isEditing ? 'Updated' : 'Created'} task "${title}"`, resourceType: 'task', resourceId: result?.id }).catch(() => {});
            onSuccess(result);
            onClose();
        } catch (error) {
            console.error('Failed to save task', error);
            showError('Failed to save task');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-8 py-6 border-b border-slate-800 bg-slate-800/20 flex items-center justify-between">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <CheckCircle2 className={isEditing ? "text-blue-500" : "text-emerald-500"} size={24} />
                        {isEditing ? 'Edit Task' : 'New Task'}
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Task Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all font-bold"
                                required
                                placeholder="e.g. Follow up email..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all font-bold resize-none h-20"
                                placeholder="Add details..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</label>
                                <div className="relative">
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value as TaskType)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 pr-9 outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="TODO">To Do</option>
                                        <option value="CALL">Call</option>
                                        <option value="EMAIL">Email</option>
                                        <option value="MEETING">Meeting</option>
                                        <option value="REMINDER">Reminder</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Start Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {type === 'REMINDER' ? 'Date & Time' : 'Due Date'}
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                <input
                                    type={type === 'REMINDER' ? "datetime-local" : "date"}
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    min={type === 'REMINDER' ? todayDatetime : todayDate}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-bold"
                                    required
                                />
                            </div>
                        </div>

                        {type === 'REMINDER' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Remind me before</label>
                                <select
                                    value={reminderMinutes}
                                    onChange={(e) => setReminderMinutes(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
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
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assigned To</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <select
                                        value={assignedToId}
                                        onChange={(e) => setAssignedToId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                    >
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
                                    className="flex items-center gap-1.5 px-3 py-3 text-sm bg-blue-600/10 border border-blue-600/20 rounded-xl text-blue-400 hover:bg-blue-600/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    title={
                                        !currentUserId
                                            ? "User session not available"
                                            : assignedToId === currentUserId
                                            ? "Already assigned to you"
                                            : "Assign this task to yourself"
                                    }
                                >
                                    <UserPlus className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Me</span>
                                </button>
                            </div>
                        </div>

                        {isEditing && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as Task['status'])}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none cursor-pointer"
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

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-8 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 ${isEditing ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'}`}
                        >
                            {isSubmitting && <Loader2 size={12} className="animate-spin" />}
                            {isEditing ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskModal;
