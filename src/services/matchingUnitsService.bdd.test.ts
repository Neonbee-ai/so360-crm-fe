import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import { matchingUnitsService, unitLabel, unitShareText, MatchingUnit } from './matchingUnitsService';

const unit = (over: Partial<MatchingUnit> = {}): MatchingUnit => ({
    item_id: 'item-1',
    unit_number: 'A-101',
    project: 'Palm Heights',
    tower: 'A',
    bedrooms: 2,
    area_sqft: 1200,
    price: 950000,
    score: 82,
    reasons: ['Within budget'],
    ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('Given the matching units service', () => {
    describe('When matches are fetched for a lead', () => {
        it('Then GET /leads/:id/matching-units is called with the default limit', async () => {
            api.get.mockResolvedValueOnce([unit()]);
            expect(await matchingUnitsService.forLead('lead-1')).toEqual([unit()]);
            expect(api.get).toHaveBeenCalledWith('/leads/lead-1/matching-units', { limit: 10 });
        });
    });

    describe('When matches are fetched for a deal with an out-of-range limit', () => {
        it('Then the deal route is used and the limit is clamped to 1–100', async () => {
            api.get.mockResolvedValue([]);
            await matchingUnitsService.forDeal('deal-1', 500);
            expect(api.get).toHaveBeenCalledWith('/deals/deal-1/matching-units', { limit: 100 });
            await matchingUnitsService.forDeal('deal-1', 0);
            expect(api.get).toHaveBeenLastCalledWith('/deals/deal-1/matching-units', { limit: 1 });
        });
    });

    describe('When crm-be returns something other than a list', () => {
        it('Then it reads as no matches', async () => {
            api.get.mockResolvedValueOnce(null);
            expect(await matchingUnitsService.for('lead', 'lead-1')).toEqual([]);
        });
    });
});

describe('Given a matching unit', () => {
    describe('When it is labelled for attaching', () => {
        it('Then unit number and project are joined, falling back to the item id', () => {
            expect(unitLabel(unit())).toBe('A-101 · Palm Heights');
            expect(unitLabel(unit({ unit_number: null, project: null }))).toBe('item-1');
        });
    });

    describe('When it is turned into share text', () => {
        it('Then each known fact gets a line and missing facts are dropped', () => {
            expect(unitShareText(unit(), (n) => `$${n}`)).toBe(
                'Unit A-101\nPalm Heights, Tower A\n2 BR · 1200 sq ft\nPrice: $950000',
            );
            expect(unitShareText(unit({ tower: null, bedrooms: null, area_sqft: null, price: null }), String)).toBe(
                'Unit A-101\nPalm Heights',
            );
        });
    });
});
