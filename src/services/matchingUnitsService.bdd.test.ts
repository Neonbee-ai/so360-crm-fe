import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import { matchingUnitsService, unitLabel, unitShareText, DEFAULT_MATCH_LIMIT } from './matchingUnitsService';
import type { MatchingUnit } from './matchingUnitsService';

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

describe('Given unusual ids and limits', () => {
    describe('When the id needs URL encoding and the limit is fractional', () => {
        it('Then the id is encoded and the limit floored', async () => {
            api.get.mockResolvedValue([]);
            await matchingUnitsService.forLead('a/b c', 7.9);
            expect(api.get).toHaveBeenCalledWith('/leads/a%2Fb%20c/matching-units', { limit: 7 });
        });
    });
    describe('When the generic entry is used for a deal without a limit', () => {
        it('Then the deal route gets the default limit', async () => {
            api.get.mockResolvedValue([]);
            await matchingUnitsService.for('deal', 'd1');
            expect(api.get).toHaveBeenCalledWith('/deals/d1/matching-units', { limit: DEFAULT_MATCH_LIMIT });
        });
    });
});

describe('Given sparse matching units', () => {
    describe('When unit number or project is whitespace', () => {
        it('Then only the real parts are joined', () => {
            expect(unitLabel(unit({ unit_number: '  ', project: 'Palm' }))).toBe('Palm');
            expect(unitLabel(unit({ unit_number: 'B-2', project: ' ' }))).toBe('B-2');
            expect(unitLabel(unit({ unit_number: ' ', project: '' }))).toBe('item-1');
        });
    });
    describe('When the share text has no unit number and no project but a tower', () => {
        it('Then the item id is used and the tower stands alone', () => {
            expect(unitShareText(unit({ unit_number: null, project: null, bedrooms: null, price: null }), String))
                .toBe('Unit item-1\nTower A\n1200 sq ft');
        });
    });
    describe('When only bedrooms and a zero price are known', () => {
        it('Then a zero price is still shown', () => {
            expect(unitShareText(unit({ project: null, tower: null, area_sqft: null, price: 0 }), (n) => `AED ${n}`))
                .toBe('Unit A-101\n2 BR\nPrice: AED 0');
        });
    });
});
