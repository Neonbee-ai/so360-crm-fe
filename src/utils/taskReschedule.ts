import { composeDueDate, splitStoredDueDate, toDateInputValue } from './datetime';

export type RescheduleChoice =
    | { kind: 'plus_one_day' }
    | { kind: 'tomorrow' }
    | { kind: 'date'; date: string };

/** `YYYY-MM-DD` plus whole calendar days (pure date arithmetic, so DST cannot shift it). */
export function addCalendarDays(day: string, days: number): string {
    const [y, m, d] = day.split('-').map(Number);
    const out = new Date(Date.UTC(y, m - 1, d + days));
    return out.toISOString().slice(0, 10);
}

/**
 * The due_date to send when a task is rescheduled from the Up Next agenda.
 *
 *  - plus_one_day: the task's own calendar day + 1 (an overdue call from three
 *    days ago lands two days ago: use Tomorrow to bring it forward);
 *  - tomorrow: the viewer's tomorrow;
 *  - date: the picked day.
 *
 * The time of day is kept. A task with no time of day stays date-only, so no
 * time is invented for it. The reminder lead time (reminder_minutes_before) is
 * untouched and the server re-derives remind_at from the new due date.
 */
export function rescheduleDueDate(
    task: { due_date?: string | null },
    choice: RescheduleChoice,
    now: Date,
): string {
    const { date: currentDay, time } = splitStoredDueDate(task.due_date);
    const today = toDateInputValue(now);
    let day: string;
    if (choice.kind === 'date') day = choice.date;
    else if (choice.kind === 'tomorrow') day = addCalendarDays(today, 1);
    else day = addCalendarDays(currentDay || today, 1);
    return composeDueDate(day, time);
}
