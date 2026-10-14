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
import type { Lead } from '../types/crm';

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

describe('Given more shapes of a DUPLICATE_LEAD rejection', () => {
    describe('When the error carries no status at all', () => {
        it('Then the body alone is trusted', () => {
            expect(parseDuplicateLead({ body: { code: 'DUPLICATE_LEAD', existing: { id: 'l2', name: 'Beta' } } }))
                .toEqual({ id: 'l2', name: 'Beta', owner_name: null });
        });
    });
    describe('When existing.id is blank or not a string', () => {
        it('Then null is returned', () => {
            expect(parseDuplicateLead(apiError(409, { code: 'DUPLICATE_LEAD', existing: { id: '' } }))).toBeNull();
            expect(parseDuplicateLead(apiError(409, { code: 'DUPLICATE_LEAD', existing: { id: 42 } }))).toBeNull();
        });
    });
    describe('When name and owner are blank strings or wrong types', () => {
        it('Then the fallbacks are used', () => {
            expect(parseDuplicateLead(apiError(409, { code: 'DUPLICATE_LEAD', existing: { id: 'l3', name: '', owner_name: '' } })))
                .toEqual({ id: 'l3', name: 'Existing lead', owner_name: null });
            expect(parseDuplicateLead(apiError(409, { code: 'DUPLICATE_LEAD', existing: { id: 'l3', name: 7, owner_name: {} } })))
                .toEqual({ id: 'l3', name: 'Existing lead', owner_name: null });
        });
    });
    describe('When the error is null or has no body', () => {
        it('Then null is returned', () => {
            expect(parseDuplicateLead(null)).toBeNull();
            expect(parseDuplicateLead({ status: 409 })).toBeNull();
        });
    });
});

describe('Given displayFieldValue edge values', () => {
    it('When the lead or value is missing / Then a dash is shown', () => {
        expect(displayFieldValue(null, 'phone')).toBe('—');
        expect(displayFieldValue(undefined, 'phone')).toBe('—');
        expect(displayFieldValue({ phone: null } as unknown as Partial<Lead>, 'phone')).toBe('—');
        expect(displayFieldValue({}, 'phone')).toBe('—');
    });
    it('When the value is an object / Then full_name is used, else a dash', () => {
        expect(displayFieldValue({ owner: { full_name: 'Ravi K' } } as unknown as Partial<Lead>, 'owner')).toBe('Ravi K');
        expect(displayFieldValue({ owner: { id: 'u1' } } as unknown as Partial<Lead>, 'owner')).toBe('—');
    });
    it('When the value is a number / Then it is stringified', () => {
        expect(displayFieldValue({ score: 0 } as unknown as Partial<Lead>, 'score')).toBe('0');
    });
});

describe('Given leadDisplayName edge values', () => {
    it('When the lead is null / Then an empty string is returned', () => {
        expect(leadDisplayName(null)).toBe('');
        expect(leadDisplayName(undefined)).toBe('');
    });
    it('When only contact_name exists / Then it is used', () => {
        expect(leadDisplayName({ contact_name: 'Meera' } as unknown as Partial<Lead>)).toBe('Meera');
    });
    it('When only a first name exists / Then it alone is used', () => {
        expect(leadDisplayName({ first_name: 'Solo', last_name: null } as unknown as Partial<Lead>)).toBe('Solo');
    });
});
