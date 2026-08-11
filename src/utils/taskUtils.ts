import { User, Task } from '../types/crm';

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
