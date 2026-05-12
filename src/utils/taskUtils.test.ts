import { describe, it, expect } from 'vitest';
import { canCurrentUserBeAssigned, isTaskAssignedToUser, getCurrentUserFromList } from './taskUtils';
import type { User, Task } from '../types/crm';

const makeUser = (id: string, name = 'Test User'): User => ({
  id,
  full_name: name,
  email: `${name.toLowerCase().replace(/\s/g, '.')}@test.com`,
});

const makeTask = (assignedToId: string | null): Task =>
  ({
    id: 'task-1',
    title: 'Test Task',
    due_date: '2026-01-01',
    status: 'Open',
    type: 'TODO',
    assigned_to: assignedToId ? makeUser(assignedToId) : undefined,
    created_at: '2026-01-01',
  }) as Task;

describe('canCurrentUserBeAssigned', () => {
  const usersList: User[] = [makeUser('u-1'), makeUser('u-2'), makeUser('u-3')];

  it('returns true when current user exists in users list', () => {
    expect(canCurrentUserBeAssigned({ id: 'u-1' }, usersList)).toBe(true);
  });

  it('returns false when current user is NOT in users list', () => {
    expect(canCurrentUserBeAssigned({ id: 'u-99' }, usersList)).toBe(false);
  });

  it('returns false when currentUser is null', () => {
    expect(canCurrentUserBeAssigned(null, usersList)).toBe(false);
  });

  it('returns false when currentUser is undefined', () => {
    expect(canCurrentUserBeAssigned(undefined, usersList)).toBe(false);
  });

  it('returns false when currentUser has no id', () => {
    expect(canCurrentUserBeAssigned({}, usersList)).toBe(false);
  });

  it('returns false when currentUser.id is empty string', () => {
    // empty string is falsy, so should return false
    expect(canCurrentUserBeAssigned({ id: '' }, usersList)).toBe(false);
  });

  it('returns false when usersList is empty', () => {
    expect(canCurrentUserBeAssigned({ id: 'u-1' }, [])).toBe(false);
  });
});

describe('isTaskAssignedToUser', () => {
  it('returns true when task is assigned to the given user', () => {
    expect(isTaskAssignedToUser(makeTask('u-1'), 'u-1')).toBe(true);
  });

  it('returns false when task is assigned to a different user', () => {
    expect(isTaskAssignedToUser(makeTask('u-1'), 'u-2')).toBe(false);
  });

  it('returns false when task is null', () => {
    expect(isTaskAssignedToUser(null, 'u-1')).toBe(false);
  });

  it('returns false when task is undefined', () => {
    expect(isTaskAssignedToUser(undefined, 'u-1')).toBe(false);
  });

  it('returns false when currentUserId is undefined', () => {
    expect(isTaskAssignedToUser(makeTask('u-1'), undefined)).toBe(false);
  });

  it('returns false when task has no assigned_to', () => {
    expect(isTaskAssignedToUser(makeTask(null), 'u-1')).toBe(false);
  });
});

describe('getCurrentUserFromList', () => {
  const usersList: User[] = [makeUser('u-1', 'Alice'), makeUser('u-2', 'Bob')];

  it('returns the matching user from the list', () => {
    const result = getCurrentUserFromList('u-2', usersList);
    expect(result).toBeDefined();
    expect(result!.id).toBe('u-2');
    expect(result!.full_name).toBe('Bob');
  });

  it('returns undefined when user is not in the list', () => {
    expect(getCurrentUserFromList('u-99', usersList)).toBeUndefined();
  });

  it('returns undefined when currentUserId is undefined', () => {
    expect(getCurrentUserFromList(undefined, usersList)).toBeUndefined();
  });

  it('returns undefined when usersList is empty', () => {
    expect(getCurrentUserFromList('u-1', [])).toBeUndefined();
  });
});
