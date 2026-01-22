import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, CheckCircle2, Circle, Calendar,
    User as UserIcon, Briefcase, Clock, AlertCircle, Trash2
} from 'lucide-react';
import { crmService } from '../services/crmService';
import { Task } from '../types/crm';
import { Loader2 } from 'lucide-react';

const TaskDetailPage = () => {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [task, setTask] = useState<Task | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTask = async () => {
            try {
                const data = await crmService.getTaskById(id);
                setTask(data || null);
            } catch (error) {
                console.error('Failed to fetch task', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTask();
    }, [id]);

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 gap-3">
                <Loader2 className="animate-spin" />
                <span>Loading task details...</span>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p>Task not found.</p>
                <Link to=".." className="text-blue-500 hover:underline mt-4 inline-block">Back to Tasks</Link>
            </div>
        );
    }

    const isOverdue = task.status === 'Open' && new Date(task.due_date) < new Date();

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <header className="mb-8">
                <Link to=".." className="flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors mb-4 group">
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Tasks
                </Link>
                <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                        <button className="mt-1 text-slate-500 hover:text-blue-400 transition-colors">
                            {task.status === 'Done' ? <CheckCircle2 size={32} className="text-emerald-500" /> : <Circle size={32} />}
                        </button>
                        <div>
                            <h1 className={`text-4xl font-black tracking-tight ${task.status === 'Done' ? 'text-slate-500 line-through' : 'text-white'}`}>
                                {task.title}
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }`}>
                                    {task.status}
                                </span>
                                {isOverdue && (
                                    <span className="flex items-center gap-1 text-rose-400 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                                        <AlertCircle size={12} /> Overdue
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button className="text-slate-500 hover:text-rose-400 p-2 transition-colors">
                        <Trash2 size={20} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-slate-800 pb-2">Related Information</h3>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                                    <Briefcase size={20} />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Associated Deal</span>
                                    <Link to={`../deal/${task.deal_id}`} className="text-lg font-bold text-white hover:text-blue-400 transition-colors truncate block">
                                        {task.deal_name}
                                    </Link>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                                    <Calendar size={20} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Due Date</span>
                                    <p className={`text-lg font-bold ${isOverdue ? 'text-rose-400' : 'text-white'}`}>
                                        {new Date(task.due_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Description</h3>
                        <p className="text-slate-300 leading-relaxed italic">
                            No additional description provided for this task.
                        </p>
                    </section>
                </div>

                <div className="space-y-8">
                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Assignee</h3>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-700">
                                {task.assigned_to.avatar_url ? <img src={task.assigned_to.avatar_url} alt={task.assigned_to.full_name} /> : task.assigned_to.full_name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-white">{task.assigned_to.full_name}</p>
                                <p className="text-xs text-slate-500">Sales Representative</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Task Actions</h3>
                        <div className="space-y-2">
                            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95">
                                Mark as Complete
                            </button>
                            <button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-xs font-bold transition-all border border-slate-700">
                                Reschedule
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailPage;
