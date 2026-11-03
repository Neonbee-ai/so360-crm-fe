import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    lossReasonsService, ratingService, duplicateRulesService, dealCloseService, stageKind, ratingForScore,
} from './salesConfigService';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

describe('Given the loss reasons service', () => {
    describe('When listing', () => {
        it('Then it returns the rows, or [] for a non-array reply', async () => {
            api.get.mockResolvedValueOnce([{ id: 'a' }]).mockResolvedValueOnce(null);
            expect(await lossReasonsService.list()).toEqual([{ id: 'a' }]);
            expect(await lossReasonsService.list()).toEqual([]);
            expect(api.get).toHaveBeenCalledWith('/settings/loss-reasons');
        });
    });
    describe('When writing', () => {
        it('Then create, update and remove hit the loss-reason routes', async () => {
            await lossReasonsService.create({ label: 'Price' });
            await lossReasonsService.update('a', { is_active: false });
            await lossReasonsService.remove('a');
            expect(api.post).toHaveBeenCalledWith('/settings/loss-reasons', { label: 'Price' });
            expect(api.patch).toHaveBeenCalledWith('/settings/loss-reasons/a', { is_active: false });
            expect(api.delete).toHaveBeenCalledWith('/settings/loss-reasons/a');
        });
    });
});

describe('Given the rating service', () => {
    describe('When used', () => {
        it('Then it lists, creates, updates and removes score categories', async () => {
            api.get.mockResolvedValueOnce([{ id: 'r' }]);
            expect(await ratingService.list()).toEqual([{ id: 'r' }]);
            await ratingService.create({ label: 'Hot', min_score: 61, max_score: null, color_token: 'danger' });
            await ratingService.update('r', { label: 'X' });
            await ratingService.remove('r');
            expect(api.post).toHaveBeenCalledWith('/settings/score-categories', expect.objectContaining({ label: 'Hot' }));
            expect(api.patch).toHaveBeenCalledWith('/settings/score-categories/r', { label: 'X' });
            expect(api.delete).toHaveBeenCalledWith('/settings/score-categories/r');
        });
    });
});

describe('Given the duplicate rules service', () => {
    describe('When getting and putting', () => {
        it('Then it wraps the body in { rules } and returns arrays', async () => {
            api.get.mockResolvedValueOnce([{ field: 'email' }]);
            api.put.mockResolvedValueOnce(undefined);
            expect(await duplicateRulesService.get()).toEqual([{ field: 'email' }]);
            expect(await duplicateRulesService.put([{ field: 'phone', action: 'warn', is_active: true }])).toEqual([]);
            expect(api.put).toHaveBeenCalledWith('/settings/duplicate-rules', { rules: [{ field: 'phone', action: 'warn', is_active: true }] });
        });
    });
});

describe('Given the deal close service', () => {
    describe('When winning or losing', () => {
        it('Then it posts to the win and lose routes', async () => {
            await dealCloseService.win('d1', { final_value: 5 });
            await dealCloseService.lose('d1', { lost_reason_id: 'x' });
            expect(api.post).toHaveBeenCalledWith('/deals/d1/win', { final_value: 5 });
            expect(api.post).toHaveBeenCalledWith('/deals/d1/lose', { lost_reason_id: 'x' });
        });
    });
});

describe('Given stageKind', () => {
    describe('When the stage has a type', () => {
        it('Then the type wins over the name', () => {
            expect(stageKind({ name: 'Lost cause', type: 'won' })).toBe('won');
            expect(stageKind({ name: 'Closed', type: 'LOST' })).toBe('lost');
        });
    });
    describe('When only the name is known', () => {
        it('Then won/lost names are detected and others are open', () => {
            expect(stageKind({ name: 'Closed Won' })).toBe('won');
            expect(stageKind({ name: 'Closed Lost' })).toBe('lost');
            expect(stageKind({ name: 'Proposal', type: 'OPEN' })).toBe('open');
            expect(stageKind(undefined)).toBe('open');
            expect(stageKind({})).toBe('open');
        });
    });
});

describe('Given ratingForScore', () => {
    const bands = [
        { id: 'c', label: 'Cold', min_score: 0, max_score: 30 },
        { id: 'w', label: 'Warm', min_score: 31, max_score: 60 },
        { id: 'h', label: 'Hot', min_score: 61, max_score: null },
        { id: 'x', label: 'Off', min_score: 0, max_score: null, is_active: false },
    ];
    describe('When scoring', () => {
        it('Then it picks the band, ignores inactive ones, and handles no score', () => {
            expect(ratingForScore(bands, 10)?.id).toBe('c');
            expect(ratingForScore(bands, 45)?.id).toBe('w');
            expect(ratingForScore(bands, 500)?.id).toBe('h');
            expect(ratingForScore([], 5)).toBeNull();
            expect(ratingForScore(bands, null)).toBeNull();
            expect(ratingForScore(bands, undefined)).toBeNull();
        });
    });
});
