import { dueDateCalendarDay, hasTimeComponent, toDateInputValue } from './datetime';
import { isTaskLocked, isTaskOverdue } from './taskUtils';

export type DueTone = 'overdue' | 'today' | 'upcoming' | 'none' | 'done';

export interface DueFormatters {
    /** Render a `YYYY-MM-DD` calendar day, e.g. "14 Oct 2026". */
    formatDay: (calendarDay: string) => string;
    /** Render the time-of-day of a stored instant, e.g. "4:05 PM". */
    formatTime: (isoInstant: string) => string;
}

export interface DueDescription {
    /** Short, single-line label for the Due Date cell. */
    label: string;
    /** Full date (and time) shown on hover. */
    title: string;
    tone: DueTone;
    /** Whole days past due, set only for overdue tasks (0 = overdue earlier today). */
    overdueDays: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(calendarDay: string): number {
    const [y, m, d] = calendarDay.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / DAY_MS;
}

/**
 * Describes a task's due date for a one-line cell: "Today 4:05 PM",
 * "Tomorrow", "2 days overdue", "14 Oct 2026".
 *
 * Date-only tasks (stored at UTC midnight) carry no time of day, so none is
 * ever invented for them. `serverBucket` is the list endpoint's verdict
 * (`list_bucket`); when present it decides "overdue" so the label can never
 * disagree with the section the row sits in. Without it the client-side
 * deadline rule (isTaskOverdue) applies.
 */
export function describeTaskDue(
    task: { due_date?: string | null; status?: string | null },
    now: Date,
    fmt: DueFormatters,
    serverBucket?: string | null,
): DueDescription {
    if (!task.due_date) {
        return { label: 'No due date', title: 'No due date', tone: 'none', overdueDays: null };
    }
    const dueDay = dueDateCalendarDay(task.due_date);
    const time = hasTimeComponent(task.due_date) ? fmt.formatTime(task.due_date) : '';
    const withTime = (text: string) => (time ? `${text} ${time}` : text);
    const fullDate = withTime(fmt.formatDay(dueDay));

    if (isTaskLocked(task.status)) {
        return { label: fullDate, title: fullDate, tone: 'done', overdueDays: null };
    }

    const diff = dayNumber(dueDay) - dayNumber(toDateInputValue(now));
    const overdue = serverBucket ? serverBucket === 'overdue' : isTaskOverdue(task, now);
    if (overdue) {
        const days = Math.max(0, -diff);
        const label =
            days === 0 ? withTime('Overdue today') : `${days} ${days === 1 ? 'day' : 'days'} overdue`;
        return { label, title: fullDate, tone: 'overdue', overdueDays: days };
    }
    if (diff === 0) return { label: withTime('Today'), title: fullDate, tone: 'today', overdueDays: null };
    if (diff === 1) return { label: withTime('Tomorrow'), title: fullDate, tone: 'upcoming', overdueDays: null };
    return { label: fullDate, title: fullDate, tone: 'upcoming', overdueDays: null };
}
