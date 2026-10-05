import { AlertCircle, Bell, Calendar, CalendarClock, Flag, ListTodo, Mail, Phone, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TASK_PRIORITY_OPTIONS, TASK_PRIORITY_STYLES, TaskPriority, TaskType } from '../../types/crm';
import { DueDescription, DueTone } from '../../utils/taskDueLabel';

const TYPE_META: Record<TaskType, { label: string; Icon: LucideIcon; className: string }> = {
    CALL: { label: 'Call', Icon: Phone, className: 'text-emerald-400' },
    MEETING: { label: 'Meeting', Icon: Users, className: 'text-violet-400' },
    EMAIL: { label: 'Email', Icon: Mail, className: 'text-sky-400' },
    TODO: { label: 'To-do', Icon: ListTodo, className: 'text-slate-300' },
    REMINDER: { label: 'Reminder', Icon: Bell, className: 'text-amber-400' },
};

export const TaskTypeBadge = ({ type }: { type?: string | null }) => {
    const meta = TYPE_META[type as TaskType];
    if (!meta) return <span className="text-slate-600 text-xs">-</span>;
    const { Icon, label, className } = meta;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`} title={label}>
            <Icon size={14} className="shrink-0" />
            {label}
        </span>
    );
};

export const TaskPriorityBadge = ({ priority }: { priority?: string | null }) => {
    const option = TASK_PRIORITY_OPTIONS.find(o => o.value === priority);
    if (!option) return <span className="text-slate-600 text-xs">-</span>;
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${TASK_PRIORITY_STYLES[option.value as TaskPriority]}`}
            title={`${option.label} priority`}
        >
            <Flag size={11} className="shrink-0" />
            {option.label}
        </span>
    );
};

const TONE_CLASS: Record<DueTone, string> = {
    overdue: 'text-rose-400',
    today: 'text-amber-300',
    upcoming: 'text-slate-300',
    none: 'text-slate-500',
    done: 'text-slate-500',
};

/** Single-line due cell: icon, relative label, full date on hover. */
export const TaskDueCell = ({ due }: { due: DueDescription }) => {
    const Icon = due.tone === 'overdue' ? AlertCircle : due.tone === 'today' ? CalendarClock : Calendar;
    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${TONE_CLASS[due.tone]}`}
            title={due.title}
        >
            <Icon size={14} className="shrink-0" />
            {due.label}
        </span>
    );
};

/**
 * Bell + reminder time under a task title, for a task that has a reminder
 * time (remind_at). A Reminder-type task without one already shows the bell in
 * its Type badge, so nothing extra is drawn for it.
 */
export const TaskReminderBadge = ({
    task,
    formatTime,
}: {
    task: { remind_at?: string | null };
    formatTime: (isoInstant: string) => string;
}) => {
    if (!task.remind_at) return null;
    const when = formatTime(task.remind_at);
    return (
        <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400"
            title={`Reminder at ${when}`}
            data-testid="task-reminder"
        >
            <Bell size={11} className="shrink-0" />
            Remind {when}
        </span>
    );
};
