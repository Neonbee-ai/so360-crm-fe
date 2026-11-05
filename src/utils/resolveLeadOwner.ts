import type { User } from '../types/crm';

/**
 * Resolve a lead's owner against the org's users list. The owner object baked in
 * at fetch time can be a stale "Unknown User" placeholder when the leads answered
 * before the users did; the users list is the source of truth for name, email and
 * avatar, so every surface resolves through here and shows one identity.
 */
export function resolveLeadOwner<T extends Pick<User, 'id'> | null | undefined>(
    owner: T,
    users: readonly User[],
): T | User {
    if (!owner?.id) return owner;
    return users.find((u) => u.id === owner.id) ?? owner;
}

/** Returns the same lead object when its owner already matches, so memoised rows stay stable. */
export function withResolvedOwner<L extends { owner: User }>(lead: L, users: readonly User[]): L {
    const owner = resolveLeadOwner(lead.owner, users) as User;
    return owner === lead.owner ? lead : { ...lead, owner };
}
