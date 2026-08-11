import { describe, it, expect } from 'vitest';
import { canCurrentUserBeAssigned, isTaskAssignedToUser, getCurrentUserFromList, isTaskLocked, canRescheduleTask, canEditTask, canAddTaskNote } from './taskUtils';
import type { User, Task } from '../types/crm';

const makeUser = (id: string, name = 'Test User'): User => ({
  id,
  full_name: name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@test.com`,
});

const makeTask = (assignedToId: string | null): Task =>
  ({
    id: 'task-1',
    title: 'Test Task',
    due_date: '2026-01-01',
    status: 'OPEN',
    type: 'TODO',
    assigned_to: assignedToId ? makeUser(assignedToId) : undefined,
    created_at: '2026-01-01',
  }) as Task;

describe('canCurrentUserBeAssigned', () => {
  const orgMembers: User[] = [makeUser('u-1', 'Alice'), makeUser('u-2', 'Bob')];

  describe('Given a current user who is a member of the org', () => {
    it('When checked against the members list / Then returns true', () => {
      expect(canCurrentUserBeAssigned({ id: 'u-1' }, orgMembers)).toBe(true);
    });
  });

  describe('Given a current user who is NOT a member of the org', () => {
    it('When checked against the members list / Then returns false', () => {
      expect(canCurrentUserBeAssigned({ id: 'u-99' }, orgMembers)).toBe(false);
    });
  });

  describe('Given no current user is logged in', () => {
    it('When checked with null / Then returns false', () => {
      expect(canCurrentUserBeAssigned(null, orgMembers)).toBe(false);
    });

    it('When checked with undefined / Then returns false', () => {
      expect(canCurrentUserBeAssigned(undefined, orgMembers)).toBe(false);
    });

    it('When user object has no id property / Then returns false', () => {
      expect(canCurrentUserBeAssigned({}, orgMembers)).toBe(false);
    });

    it('When user id is empty string / Then returns false', () => {
      expect(canCurrentUserBeAssigned({ id: '' }, orgMembers)).toBe(false);
    });
  });

  describe('Given an empty org members list', () => {
    it('When checked / Then returns false regardless of user', () => {
      expect(canCurrentUserBeAssigned({ id: 'u-1' }, [])).toBe(false);
    });
  });
});

describe('isTaskAssignedToUser', () => {
  describe('Given a task assigned to a specific user', () => {
    it('When checked with the same user id / Then returns true', () => {
      expect(isTaskAssignedToUser(makeTask('u-1'), 'u-1')).toBe(true);
    });

    it('When checked with a different user id / Then returns false', () => {
      expect(isTaskAssignedToUser(makeTask('u-1'), 'u-2')).toBe(false);
    });
  });

  describe('Given a task with no assignee', () => {
    it('When checked / Then returns false', () => {
      expect(isTaskAssignedToUser(makeTask(null), 'u-1')).toBe(false);
    });
  });

  describe('Given no task is provided', () => {
    it('When task is null / Then returns false', () => {
      expect(isTaskAssignedToUser(null, 'u-1')).toBe(false);
    });

    it('When task is undefined / Then returns false', () => {
      expect(isTaskAssignedToUser(undefined, 'u-1')).toBe(false);
    });
  });

  describe('Given no user id is provided', () => {
    it('When currentUserId is undefined / Then returns false', () => {
      expect(isTaskAssignedToUser(makeTask('u-1'), undefined)).toBe(false);
    });
  });
});

describe('getCurrentUserFromList', () => {
  const members: User[] = [makeUser('u-1', 'Alice'), makeUser('u-2', 'Bob')];

  describe('Given the user exists in the list', () => {
    it('When looked up by id / Then returns the matching User object', () => {
      const result = getCurrentUserFromList('u-2', members);
      expect(result).toBeDefined();
      expect(result!.full_name).toBe('Bob');
    });
  });

  describe('Given the user does not exist in the list', () => {
    it('When looked up by an unknown id / Then returns undefined', () => {
      expect(getCurrentUserFromList('u-99', members)).toBeUndefined();
    });
  });

  describe('Given no current user id is provided', () => {
    it('When id is undefined / Then returns undefined', () => {
      expect(getCurrentUserFromList(undefined, members)).toBeUndefined();
    });
  });

  describe('Given the members list is empty', () => {
    it('When looked up in an empty list / Then returns undefined', () => {
      expect(getCurrentUserFromList('u-1', [])).toBeUndefined();
    });
  });
});

describe('Task status-based action rules', () => {
  describe('Given a task that is still open', () => {
    it.each(['OPEN', 'TODO', 'IN_PROGRESS', 'ON_HOLD'])('When status is %s / Then the task is not locked', (status) => {
      expect(isTaskLocked(status)).toBe(false);
      expect(canRescheduleTask(status)).toBe(true);
      expect(canEditTask(status)).toBe(true);
    });
  });

  describe('Given a task that has closed its lifecycle', () => {
    it.each(['DONE', 'CANCELLED'])('When status is %s / Then the task is locked for edits', (status) => {
      expect(isTaskLocked(status)).toBe(true);
      expect(canRescheduleTask(status)).toBe(false);
      expect(canEditTask(status)).toBe(false);
    });

    it('When status casing or whitespace varies / Then the rule still applies', () => {
      expect(isTaskLocked(' done ')).toBe(true);
      expect(isTaskLocked('Done')).toBe(true);
    });

    it('When adding a note / Then it stays permitted so audit history can grow', () => {
      expect(canAddTaskNote('DONE')).toBe(true);
      expect(canAddTaskNote('CANCELLED')).toBe(true);
    });
  });

  describe('Given a missing status', () => {
    it('When status is null or undefined / Then the task is treated as editable', () => {
      expect(isTaskLocked(null)).toBe(false);
      expect(isTaskLocked(undefined)).toBe(false);
      expect(isTaskLocked('')).toBe(false);
    });
  });
});
