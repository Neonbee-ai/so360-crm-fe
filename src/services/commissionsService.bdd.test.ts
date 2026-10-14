import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    commissionsService, normalizeCommissionLines, normalizeCommissionLine, legalTransitions, canOverride,
    validateOverride, maskedMoney, TRANSITION_LABELS, type CommissionLine,
} from './commissionsService';

beforeEach(() => { api.get.mockReset(); api.post.mockReset(); api.patch.mockReset(); });

const line = (over: Partial<CommissionLine> = {}): CommissionLine => ({
    ...normalizeCommissionLine({ id: 'l1', name: 'Asha', participant_type: 'agent', amount: 1000, status: 'pending' }),
    ...over,
});

describe('Given the commissions service', () => {
    describe('When a deal\'s lines are listed', () => {
        it('Then GET /deals/:id/commissions is called and values normalised', async () => {
            api.get.mockResolvedValueOnce([{
                id: 'l1', participant_type: 'team_leader', name: 'Ravi', basis_amount: '100000', percent: '1.5',
                amount: '1500', vat_amount: 75, status: 'approved', user_id: 'u1',
                audit: [{ at: '2026-09-01', by: 'u9', from: 'pending', to: 'approved', note: 'ok' }, {}],
            }]);
            const [l] = await commissionsService.list('d 1');
            expect(api.get).toHaveBeenCalledWith('/deals/d%201/commissions');
            expect(l).toMatchObject({ participant_type: 'team_leader', basis_amount: 100000, percent: 1.5, amount: 1500, vat_amount: 75, status: 'approved' });
            expect(l.audit).toEqual([
                { at: '2026-09-01', by: 'u9', from: 'pending', to: 'approved', note: 'ok' },
                { at: null, by: null, from: null, to: null, note: null },
            ]);
        });
        it('Then masked (null) amounts stay null and unknown enums fall back', () => {
            const [l] = normalizeCommissionLines({ lines: [{ amount: null, status: 'weird', participant_type: 'alien' }] });
            expect(l).toMatchObject({ id: 'line-0', amount: null, status: 'pending', participant_type: 'agent', name: '' });
        });
        it('Then {data} envelopes and junk are accepted', () => {
            expect(normalizeCommissionLines({ data: [{ id: 'a' }] })).toHaveLength(1);
            expect(normalizeCommissionLines(null)).toEqual([]);
            expect(normalizeCommissionLine(undefined).amount).toBeNull();
            expect(normalizeCommissionLine({ amount: 'abc' }).amount).toBeNull();
        });
    });

    describe('When lines are generated, added, overridden or moved', () => {
        it('Then each hits its crm-be route', async () => {
            api.post.mockResolvedValueOnce({ lines: [{ id: 'g1' }] });
            expect((await commissionsService.generate('d1')).map((l) => l.id)).toEqual(['g1']);
            expect(api.post).toHaveBeenLastCalledWith('/deals/d1/commissions/generate', {});

            api.post.mockResolvedValueOnce({});
            await commissionsService.add('d1', { participant_type: 'referral', name: 'Ref', amount: 50 });
            expect(api.post).toHaveBeenLastCalledWith('/deals/d1/commissions', { participant_type: 'referral', name: 'Ref', amount: 50 });

            api.patch.mockResolvedValueOnce({});
            await commissionsService.update('d1', 'l1', { amount: 900, override_reason: 'deal discount' });
            expect(api.patch).toHaveBeenCalledWith('/deals/d1/commissions/l1', { amount: 900, override_reason: 'deal discount' });

            api.post.mockResolvedValueOnce({});
            await commissionsService.transition('d1', 'l1', 'approved', '  ok  ');
            expect(api.post).toHaveBeenLastCalledWith('/deals/d1/commissions/l1/transition', { to: 'approved', note: 'ok' });

            api.post.mockResolvedValueOnce({});
            await commissionsService.transition('d1', 'l1', 'cancelled', '   ');
            expect(api.post).toHaveBeenLastCalledWith('/deals/d1/commissions/l1/transition', { to: 'cancelled' });
        });
    });
});

describe('Given the commission state machine', () => {
    it('When approval is required, Then pending may only go to approved or cancelled', () => {
        expect(legalTransitions('pending', true)).toEqual(['approved', 'cancelled']);
    });
    it('When approval is not required, Then pending skips straight to payable', () => {
        expect(legalTransitions('pending', false)).toEqual(['payable', 'cancelled']);
    });
    it('Then approved → payable, payable → paid, and paid/cancelled are terminal', () => {
        expect(legalTransitions('approved', true)).toEqual(['payable', 'cancelled']);
        expect(legalTransitions('payable', false)).toEqual(['paid', 'cancelled']);
        expect(legalTransitions('paid', true)).toEqual([]);
        expect(legalTransitions('cancelled', false)).toEqual([]);
    });
    it('Then every target has a button label', () => {
        expect(TRANSITION_LABELS.approved).toBe('Approve');
        expect(TRANSITION_LABELS.paid).toBe('Mark paid');
    });
});

describe('Given a commission override', () => {
    it('When the line is pending with a visible amount, Then it can be overridden', () => {
        expect(canOverride(line())).toBe(true);
        expect(canOverride(line({ status: 'approved' }))).toBe(false);
        expect(canOverride(line({ amount: null }))).toBe(false);
    });
    it('When the reason is blank, Then a reason is required', () => {
        expect(validateOverride({ amount: 900, reason: '  ' }, line())).toBe('A reason is required to override a commission.');
    });
    it('When the amount is invalid or unchanged, Then it is rejected', () => {
        expect(validateOverride({ amount: -1, reason: 'x' }, line())).toBe('Enter an amount of 0 or more.');
        expect(validateOverride({ amount: null, reason: 'x' }, line())).toBe('Enter an amount of 0 or more.');
        expect(validateOverride({ amount: 1000, reason: 'x' }, line())).toBe('The amount has not changed.');
    });
    it('When amount and reason are good, Then there is no error', () => {
        expect(validateOverride({ amount: 800, reason: 'discount' }, line())).toBeNull();
    });
});

describe('Given a possibly masked amount', () => {
    it('When it is null or undefined, Then it shows an em dash; otherwise it is formatted', () => {
        const fmt = (n: number) => `$${n}`;
        expect(maskedMoney(null, fmt)).toBe('—');
        expect(maskedMoney(undefined, fmt)).toBe('—');
        expect(maskedMoney(0, fmt)).toBe('$0');
    });
});
