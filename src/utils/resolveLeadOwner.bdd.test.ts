import { describe, it, expect } from 'vitest';
import { resolveLeadOwner, withResolvedOwner } from './resolveLeadOwner';
import type { User } from '../types/crm';

const praveen: User = { id: 'u1', full_name: 'Praveen', email: 'p@x.io', avatar_url: 'p.png' } as User;
const zarin: User = { id: 'u2', full_name: 'Zarin', email: 'z@x.io', avatar_url: 'z.png' } as User;
const placeholder = { id: 'u1', full_name: 'Unknown User', email: '', avatar_url: '' } as User;

describe('resolveLeadOwner', () => {
    it('Given a stale placeholder owner / When the users list has that id / Then name, email and avatar come from the user', () => {
        expect(resolveLeadOwner(placeholder, [zarin, praveen])).toBe(praveen);
    });

    it('Given an owner id missing from the users list / When resolved / Then the carried owner is kept', () => {
        expect(resolveLeadOwner(placeholder, [zarin])).toBe(placeholder);
    });

    it('Given an owner without an id / When resolved / Then it is returned untouched', () => {
        const noId = { id: undefined as unknown as string, full_name: 'Unknown User' } as User;
        expect(resolveLeadOwner(noId, [praveen])).toBe(noId);
    });

    it('Given no owner at all / When resolved / Then undefined comes back', () => {
        expect(resolveLeadOwner(undefined, [praveen])).toBeUndefined();
    });
});

describe('withResolvedOwner', () => {
    it('Given a lead with a placeholder owner / When users load / Then a copy carries the real owner', () => {
        const lead = { id: 'l1', owner: placeholder };
        const out = withResolvedOwner(lead, [praveen]);
        expect(out).not.toBe(lead);
        expect(out.owner).toBe(praveen);
    });

    it('Given a lead whose owner is already the resolved user / When resolved / Then the same lead object is returned', () => {
        const lead = { id: 'l1', owner: praveen };
        expect(withResolvedOwner(lead, [praveen])).toBe(lead);
    });
});
