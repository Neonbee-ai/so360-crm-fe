import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Building2, Check, CalendarClock } from 'lucide-react';
import { toast } from '@so360/design-system';
import { crmService } from '../../services/crmService';
import { UpNextTask } from '../../types/crm';
import { TaskScopeTab } from '../../utils/taskListFilters';
import { UpNextGroupKey, groupUpNext } from '../../utils/upNext';
import { RescheduleChoice, addCalendarDays, rescheduleDueDate } from '../../utils/taskReschedule';
import { hasTimeComponent, toDateInputValue } from '../../utils/datetime';
import { TaskTypeBadge } from './TaskCells';

interface TasksUpNextProps {
    /** The My / Team / All tab: the agenda follows it (the server clamps it to what the caller may see). */
    scope: TaskScopeTab;
    /** Bump to refetch (the page bumps it after any edit). */
    refreshKey: number;
    /** Called after a quick action changed a task, so the list below refreshes too. */
    onChanged: () => void;
    onOpen: (task: UpNextTask) => void;
    formatDay: (calendarDay: string) => string;
    formatTime: (isoInstant: string) => string;
}

const dayLabel = (key: UpNextGroupKey, today: string, formatDay: (d: string) => string) => {
    if (key === 'overdue') return 'Overdue';
    if (key === 0) return 'Today';
    if (key === 1) return 'Tomorrow';
    return formatDay(addCalendarDays(today, key));
};

/**
 * Up Next: a compact agenda of the next booked calls/meetings and reminders
 * (today + 7 days, time ordered) above the task list. Past-due items stay in,
 * flagged Overdue. Quick actions use the ordinary task update API.
 *
 * DECISION (open PM question): "booked" means an open task of type Call or
 * Meeting, so tasks remain the single source of truth.
 */
export const TasksUpNext = ({ scope, refreshKey, onChanged, onOpen, formatDay, formatTime }: TasksUpNextProps) => {
    const [items, setItems] = useState<UpNextTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selected, setSelected] = useState<UpNextGroupKey | null>(null);
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        crmService
            .getUpNext({ scope, tz_offset_minutes: String(-new Date().getTimezoneOffset()) })
            .then(res => {
                if (cancelled) return;
                setItems(res.items);
                setError(false);
            })
            .catch(err => {
                if (cancelled) return;
                console.error('Failed to fetch Up Next', err);
                setError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [scope, refreshKey]);

    const groups = useMemo(() => groupUpNext(items), [items]);
    const today = toDateInputValue(new Date());
    const visible = selected === null ? items : groups.find(g => g.key === selected)!.items;

    const run = useCallback(
        async (task: UpNextTask, updates: Record<string, unknown>, success: string) => {
            setBusyId(task.id);
            try {
                await crmService.updateTask(task.id, updates);
                toast.success(success);
                setMenuFor(null);
                onChanged();
            } catch (err) {
                console.error('Up Next quick action failed', err);
                toast.error('Could not update the task');
            } finally {
                setBusyId(null);
            }
        },
        [onChanged],
    );

    const reschedule = (task: UpNextTask, choice: RescheduleChoice) =>
        run(task, { due_date: rescheduleDueDate(task, choice, new Date()) }, 'Task rescheduled');

    return (
        <section className="mb-6 rounded-xl border border-slate-700/50 bg-slate-900/60 p-4" data-testid="up-next" aria-label="Up Next">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-200">Up Next</h2>
                    <p className="text-xs text-slate-400">Booked calls, meetings and reminders for the next 7 days</p>
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Up Next days">
                    {groups.map(group => {
                        if (group.key === 'overdue' && group.items.length === 0) return null;
                        const label = dayLabel(group.key, today, formatDay);
                        const active = selected === group.key;
                        return (
                            <button
                                key={String(group.key)}
                                type="button"
                                aria-pressed={active}
                                aria-label={`${label}: ${group.items.length}`}
                                onClick={() => setSelected(active ? null : group.key)}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${active
                                    ? 'border-blue-500 bg-blue-600/20 text-slate-50'
                                    : group.key === 'overdue'
                                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                                    }`}
                            >
                                {label} <span className="ml-1 opacity-80">{group.items.length}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {loading ? (
                <p className="text-xs text-slate-400">Loading...</p>
            ) : error ? (
                <p className="text-xs text-rose-300" role="alert">Could not load Up Next.</p>
            ) : visible.length === 0 ? (
                <p className="text-xs text-slate-400">Nothing booked for this period.</p>
            ) : (
                <ul className="max-h-72 divide-y divide-slate-800 overflow-y-auto">
                    {visible.map(task => {
                        const entity = task.deal
                            ? task.deal.name || task.deal.company_name
                            : task.lead
                                ? task.lead.company_name || task.lead.contact_name
                                : null;
                        return (
                            <li key={task.id} className="py-2" data-testid={`up-next-${task.id}`}>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className={`w-20 shrink-0 text-xs font-semibold ${task.overdue ? 'text-rose-300' : 'text-slate-200'}`}>
                                        {hasTimeComponent(task.at) ? formatTime(task.at) : 'All day'}
                                    </span>
                                    <TaskTypeBadge type={task.type} />
                                    {task.kind === 'reminder' && <Bell size={12} className="text-amber-400" aria-label="Reminder" />}
                                    <button type="button" onClick={() => onOpen(task)} className="min-w-0 truncate text-left text-sm font-semibold text-slate-50 hover:text-blue-300">
                                        {task.title}
                                    </button>
                                    {task.overdue && (
                                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">Overdue</span>
                                    )}
                                    {entity && (
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                            <Building2 size={12} />
                                            {entity}
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-400">{task.assigned_to?.full_name}</span>
                                    <span className="ml-auto flex items-center gap-1">
                                        <button type="button" onClick={() => onOpen(task)} className="rounded px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                                            Open
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busyId === task.id}
                                            onClick={() => run(task, { status: 'DONE' }, 'Task marked done')}
                                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
                                            aria-label={`Mark ${task.title} done`}
                                        >
                                            <Check size={12} />
                                            Done
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMenuFor(menuFor === task.id ? null : task.id)}
                                            aria-expanded={menuFor === task.id}
                                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                                            aria-label={`Reschedule ${task.title}`}
                                        >
                                            <CalendarClock size={12} />
                                            Reschedule
                                        </button>
                                    </span>
                                </div>
                                {menuFor === task.id && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-20" data-testid={`reschedule-${task.id}`}>
                                        <button type="button" disabled={busyId === task.id} onClick={() => reschedule(task, { kind: 'plus_one_day' })} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">
                                            +1 day
                                        </button>
                                        <button type="button" disabled={busyId === task.id} onClick={() => reschedule(task, { kind: 'tomorrow' })} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">
                                            Tomorrow
                                        </button>
                                        <input
                                            type="date"
                                            aria-label={`Pick a date for ${task.title}`}
                                            disabled={busyId === task.id}
                                            onChange={e => e.target.value && reschedule(task, { kind: 'date', date: e.target.value })}
                                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
