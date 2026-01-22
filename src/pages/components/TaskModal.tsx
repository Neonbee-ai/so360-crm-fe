import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar, CheckCircle2, User as UserIcon } from 'lucide-react';
import { crmService } from '../../services/crmService';
import { Task, TaskType, User } from '../../types/crm';

interface TaskModalProps {
    task?: Task | null; // If null, creating new task
    leadId?: string;
    dealId?: string;
    onClose: () => void;
    onSuccess: (task: Task) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, leadId, dealId, onClose, onSuccess }) => {
    const isEditing = !!task;
    const [title, setTitle] = useState(task?.title || '');
    const [dueDate, setDueDate] = useState(task?.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
    const [status, setStatus] = useState<'Open' | 'Done'>(task?.status || 'Open');
    const [type, setType] = useState<TaskType>(task?.type || 'ToDo');
    const [assignedToId, setAssignedToId] = useState(task?.assigned_to?.id || '');
    const [users, setUsers] = useState<User[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            const usersData = await crmService.getUsers();
            setUsers(usersData);
            if (!assignedToId && usersData.length > 0) {
                setAssignedToId(usersData[0].id);
            }
        };
        fetchUsers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const data: any = {
                title,
                due_date: new Date(dueDate).toISOString(),
                status: status.toUpperCase(),
                type: type.toUpperCase(),
                assignee_id: assignedToId
            };

            if (leadId) data.lead_id = leadId;
            if (dealId) data.deal_id = dealId;

            let result: Task;
            if (isEditing && task) {
                result = await crmService.updateTask(task.id, data);
            } else {
                result = await crmService.createTask(data);
            }
            onSuccess(result);
            onClose();
        } catch (error) {
            console.error('Failed to save task', error);
            alert('Failed to save task');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as TaskType)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                >
                                    <option value="ToDo">To Do</option>
                                    <option value="Call">Call</option>
                                    <option value="Email">Email</option>
                                    <option value="Meeting">Meeting</option>
                                    <option value="Reminder">Reminder</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-bold"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assigned To</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <select
                                    value={assignedToId}
                                    onChange={(e) => setAssignedToId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-4 py-3 outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer"
                                >
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {isEditing && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="status"
                                            value="Open"
                                            checked={status === 'Open'}
                                            onChange={() => setStatus('Open')}
                                            className="text-blue-500 focus:ring-blue-500 bg-slate-950 border-slate-800"
                                        />
                                        <span className="text-sm font-bold text-slate-300">Open</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="status"
                                            value="Done"
                                            checked={status === 'Done'}
                                            onChange={() => setStatus('Done')}
                                            className="text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-800"
                                        />
                                        <span className="text-sm font-bold text-slate-300">Done</span>
                                    </label>
                                </div>
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
