import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
vi.mock('./crmService', () => ({ crmApiClient: { post: (...a: any[]) => mockPost(...a) } }));

import {
    parseDuplicateLead,
    leadDedupService,
    defaultFieldChoices,
    displayFieldValue,
    leadDisplayName,
    MERGE_FIELDS,
} from './leadDedupService';

const apiError = (status: number, body: any) => Object.assign(new Error('x'), { status, body });

beforeEach(() => vi.clearAllMocks());

describe('Given crm-be rejections (parseDuplicateLead)', () => {
    describe('When a 409 DUPLICATE_LEAD carries the existing lead', () => {
        it('Then id, name and owner are returned', () => {
            expect(parseDuplicateLead(apiError(409, { code: 'DUPLICATE_LEAD', existing: { id: 'l1', name: 'Acme', owner_name: 'Priya' } })))
                .toEqual({ id: 'l1', name: 'Acme', owner_name: 'Priya' });
        });
        it('Then a missing name/owner falls back safely', () => {
            expect(parseDuplicateLead(apiError(409, { code: 'DUPLICATE_LEAD', existing: { id: 'l1' } })))
                .toEqual({ id: 'l1', name: 'Existing lead', owner_name: null });
        });
    });
    describe('When the rejection is anything else', () => {
        it('Then null is returned', () => {
            expect(parseDuplicateLead(apiError(409, { code: 'DUPLICATE_EMAIL', existing_id: 'c1' }))).toBeNull();
            expect(parseDuplicateLead(apiError(400, { code: 'DUPLICATE_LEAD', existing: { id: 'l1' } }))).toBeNull();
            expect(parseDuplicateLead(apiError(409, { code: 'DUPLICATE_LEAD' }))).toBeNull();
            expect(parseDuplicateLead(new Error('network'))).toBeNull();
            expect(parseDuplicateLead(undefined)).toBeNull();
        });
    });
});

describe('Given a merge request (mergeLeads)', () => {
    describe('When two leads are merged', () => {
        it('Then POST /leads/:keepId/merge is sent with merge_id and field_choices', async () => {
            mockPost.mockResolvedValue({ id: 'keep' });
            const res = await leadDedupService.mergeLeads('keep', 'other', { phone: 'other' });
            expect(mockPost).toHaveBeenCalledWith('/leads/keep/merge', { merge_id: 'other', field_choices: { phone: 'other' } });
            expect(res).toEqual({ id: 'keep' });
        });
    });
});

describe('Given the merge field helpers', () => {
    it('When defaults are built / Then every field points at the kept lead', () => {
        const d = defaultFieldChoices('keep');
        expect(Object.keys(d)).toEqual(MERGE_FIELDS.map(f => f.key));
        expect(Object.values(d).every(v => v === 'keep')).toBe(true);
    });
    it('When values are displayed / Then blanks show a dash and the owner shows its name', () => {
        expect(displayFieldValue({ phone: '' } as any, 'phone')).toBe('—');
        expect(displayFieldValue({ owner: { name: 'Priya' } } as any, 'owner')).toBe('Priya');
        expect(displayFieldValue({ source: 'web' } as any, 'source')).toBe('web');
    });
    it('When a lead is named / Then company wins, then the person, then a placeholder', () => {
        expect(leadDisplayName({ company_name: 'Acme' } as any)).toBe('Acme');
        expect(leadDisplayName({ first_name: 'A', last_name: 'B' } as any)).toBe('A B');
        expect(leadDisplayName({} as any)).toBe('Untitled lead');
    });
});
