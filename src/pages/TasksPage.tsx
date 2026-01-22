import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, CheckCircle2, Circle, Clock, AlertCircle, Calendar } from 'lucide-react';
import { crmService } from '../services/crmService';
import { Task } from '../types/crm';
import { Table } from '../components/common/Table';

const TasksPage = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const data = await crmService.getTasks();
                setTasks(data);
            } catch (error) {
                console.error('Failed to fetch tasks', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTasks();
    }, []);

    const filteredTasks = tasks.filter(task => {
        if (filter === 'All') return true;
        if (filter === 'Open') return task.status === 'Open';
        if (filter === 'Done') return task.status === 'Done';
        if (filter === 'Overdue') {
            return task.status === 'Open' && new Date(task.due_date) < new Date();
        }
        return true;
    });

    const columns = [
        {
            header: 'Task Detail',
            accessor: (task: Task) => (
                <div className="flex items-start gap-3">
                    <button className="mt-0.5 text-slate-500 hover:text-blue-400 transition-colors">
                        {task.status === 'Done' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} />}
                    </button>
                    <div className="flex flex-col gap-0.5">
                        <span className={`font-semibold ${task.status === 'Done' ? 'text-slate-500 line-through' : 'text-white'}`}>
                            {task.title}
                        </span>
                        <span className="text-xs text-slate-400">Related to: <span className="text-blue-400/80">{task.deal_name}</span></span>
                    </div>
                </div>
            )
        },
        {
            header: 'Due Date',
            accessor: (task: Task) => {
                const isOverdue = task.status === 'Open' && new Date(task.due_date) < new Date();
                return (
                    <div className={`flex items-center gap-2 text-xs font-medium ${isOverdue ? 'text-rose-400' : 'text-slate-400'}`}>
                        {isOverdue ? <AlertCircle size={14} /> : <Calendar size={14} />}
                        {new Date(task.due_date).toLocaleDateString()}
                        {isOverdue && <span className="uppercase text-[9px] font-black tracking-tighter ml-1">Overdue</span>}
                    </div>
                );
            }
        },
        {
            header: 'Assigned To',
            accessor: (task: Task) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold overflow-hidden border border-slate-700">
                        {task.assigned_to.avatar_url ? <img src={task.assigned_to.avatar_url} alt={task.assigned_to.full_name} /> : task.assigned_to.full_name.charAt(0)}
                    </div>
                    <span className="text-sm text-slate-300">{task.assigned_to.full_name}</span>
                </div>
            )
        },
        {
            header: 'Status',
            accessor: (task: Task) => (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${task.status === 'Done'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                    {task.status}
                </span>
            )
        }
    ];

    return (
        <div className="p-8">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight leading-none">Tasks & Follow-ups</h1>
                    <p className="text-slate-400 mt-2">Personal execution discipline and daily tasks</p>
                </div>
            </header>

            <div className="flex gap-2 mb-6">
                {['All', 'Open', 'Overdue', 'Done'].map((btn) => (
                    <button
                        key={btn}
                        onClick={() => setFilter(btn)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all border ${filter === btn
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-100 hover:bg-slate-800'
                            }`}
                    >
                        {btn}
                    </button>
                ))}
            </div>

            <Table
                data={filteredTasks}
                columns={columns}
                isLoading={isLoading}
                onRowClick={(task) => navigate(`${task.id}`)}
                emptyMessage="No tasks found for the selected filter."
            />
        </div>
    );
};

export default TasksPage;
