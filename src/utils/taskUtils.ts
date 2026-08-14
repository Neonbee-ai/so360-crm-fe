import { User, Task } from '../types/crm';
import { dueDateCalendarDay, hasTimeComponent, parseStoredTimestamp } from './datetime';

/** Statuses that still count as work in flight, and so can run late. */
const TASK_ACTIVE_STATUSES = ['OPEN', 'IN_PROGRESS', 'TODO'];

/**
 * The instant a task actually runs out of time.
 *
 * A task due "20 Aug" with no time of day has the whole day — treating its
 * stored UTC midnight as the deadline marked it overdue before the user had
 * even started work. A task due "20 Aug 4:00 PM" expires at 4:00 PM.
 */
export function taskDeadline(dueDate: string | null | undefined): Date | null {
  if (!dueDate) return null;
  const due = parseStoredTimestamp(dueDate);
  if (isNaN(due.getTime())) return null;
  return hasTimeComponent(dueDate)
    ? due
    : new Date(`${dueDateCalendarDay(dueDate)}T23:59:59`);
}

/** True when an unfinished task's complete due date *and time* have passed. */
export function isTaskOverdue(
  task: { status?: string | null; due_date?: string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!task) return false;
  const status = String(task.status ?? '').trim().toUpperCase();
  if (!TASK_ACTIVE_STATUSES.includes(status)) return false;
  const deadline = taskDeadline(task.due_date);
  return !!deadline && deadline.getTime() < now.getTime();
}

/**
 * Statuses that close a task's lifecycle. Once a task reaches one of these it
 * is treated as a completed record: scheduling/content edits are blocked until
 * the task is reopened.
 */
export const TASK_CLOSED_STATUSES = ['DONE', 'CANCELLED'];

/**
 * A task is "locked" once it is completed/cancelled. Locked tasks are
 * read-only for scheduling and content changes — the user must reopen the
 * task (Mark as Open) before editing it again.
 */
export function isTaskLocked(status: string | null | undefined): boolean {
  if (!status) return false;
  return TASK_CLOSED_STATUSES.includes(String(status).trim().toUpperCase());
}

/** Reschedule is a scheduling change — not permitted on a closed task. */
export function canRescheduleTask(status: string | null | undefined): boolean {
  return !isTaskLocked(status);
}

/** Editing task fields is not permitted on a closed task. */
export function canEditTask(status: string | null | undefined): boolean {
  return !isTaskLocked(status);
}

/**
 * Business rule: notes stay available after completion so the audit/history
 * trail can keep growing. Notes never mutate the task record itself.
 */
export function canAddTaskNote(_status?: string | null | undefined): boolean {
  return true;
}

/** Message explaining why an action is unavailable, for tooltips. */
export const TASK_LOCKED_HINT =
  'Completed tasks are read-only — select "Mark as Open" to make changes.';

/**
 * Checks if current user can be assigned to tasks (exists in org members list)
 */
export function canCurrentUserBeAssigned(
  currentUser: any | null | undefined,
  usersList: User[]
): boolean {
  if (!currentUser || !currentUser.id) return false;
  return usersList.some(u => u.id === currentUser.id);
}

/**
 * Checks if task is currently assigned to specified user
 */
export function isTaskAssignedToUser(
  task: Task | null | undefined,
  currentUserId: string | undefined
): boolean {
  if (!task || !currentUserId) return false;
  return task.assigned_to?.id === currentUserId;
}

/**
 * Finds current user in users list
 */
export function getCurrentUserFromList(
  currentUserId: string | undefined,
  usersList: User[]
): User | undefined {
  if (!currentUserId) return undefined;
  return usersList.find(u => u.id === currentUserId);
}
