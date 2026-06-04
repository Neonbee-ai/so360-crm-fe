/**
 * BDD specs — crmService product API methods
 * Covers: getLeadProducts, addLeadProduct, updateLeadProduct, removeLeadProduct,
 *         getDealProducts, addDealProduct, updateDealProduct, removeDealProduct
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { crmService } from './crmService';

function ok(data: any) {
    fetchMock.mockResolvedValueOnce({
        ok: true, status: 200,
        text: () => Promise.resolve(JSON.stringify(data)),
        json: () => Promise.resolve(data),
    });
}

function fail(status = 500) {
    fetchMock.mockResolvedValueOnce({
        ok: false, status,
        text: () => Promise.resolve(JSON.stringify({ message: 'error' })),
    });
}

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

const LEAD_ID = 'lead-001';
const DEAL_ID = 'deal-001';
const PROD_ID = 'prod-001';
const ITEM_ID = 'item-001';

const sampleLeadProduct = { id: PROD_ID, lead_id: LEAD_ID, item_id: ITEM_ID, item_name: 'Sofa Set', item_sku: 'SF-001', quantity: 2, unit_price: 50000, status: 'interested', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const sampleDealProduct = { id: PROD_ID, deal_id: DEAL_ID, item_id: ITEM_ID, item_name: 'Dining Table', item_sku: 'DT-001', quantity: 1, unit_price: 45000, status: 'quoted', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

describe('crmService — Lead Product APIs', () => {
    describe('Given getLeadProducts is called', () => {
        it('When API returns list / Then resolves with array', async () => {
            ok([sampleLeadProduct]);
            const result = await crmService.getLeadProducts(LEAD_ID);
            expect(Array.isArray(result)).toBe(true);
            expect(result[0]).toMatchObject({ item_name: 'Sofa Set' });
        });

        it('When API returns empty array / Then resolves with []', async () => {
            ok([]);
            const result = await crmService.getLeadProducts(LEAD_ID);
            expect(result).toEqual([]);
        });

        it('When API fails / Then throws', async () => {
            fail(500);
            await expect(crmService.getLeadProducts(LEAD_ID)).rejects.toBeDefined();
        });
    });

    describe('Given addLeadProduct is called', () => {
        it('When API returns new product / Then resolves with product', async () => {
            ok(sampleLeadProduct);
            const result = await crmService.addLeadProduct(LEAD_ID, { item_id: ITEM_ID, item_name: 'Sofa Set', quantity: 2, unit_price: 50000 });
            expect(result).toMatchObject({ item_name: 'Sofa Set', quantity: 2 });
        });

        it('When API fails / Then throws', async () => {
            fail(400);
            await expect(crmService.addLeadProduct(LEAD_ID, { item_id: ITEM_ID, item_name: 'Sofa' })).rejects.toBeDefined();
        });
    });

    describe('Given updateLeadProduct is called', () => {
        it('When API returns updated product / Then resolves with updated product', async () => {
            ok({ ...sampleLeadProduct, quantity: 5, status: 'approved' });
            const result = await crmService.updateLeadProduct(LEAD_ID, PROD_ID, { quantity: 5, status: 'approved' });
            expect(result).toMatchObject({ quantity: 5, status: 'approved' });
        });
    });

    describe('Given removeLeadProduct is called', () => {
        it('When API succeeds / Then resolves with { deleted: true }', async () => {
            ok({ deleted: true });
            const result = await crmService.removeLeadProduct(LEAD_ID, PROD_ID);
            expect(result).toEqual({ deleted: true });
        });
    });
});

describe('crmService — Deal Product APIs', () => {
    describe('Given getDealProducts is called', () => {
        it('When API returns list / Then resolves with array', async () => {
            ok([sampleDealProduct]);
            const result = await crmService.getDealProducts(DEAL_ID);
            expect(Array.isArray(result)).toBe(true);
            expect(result[0]).toMatchObject({ item_name: 'Dining Table' });
        });

        it('When API returns empty array / Then resolves with []', async () => {
            ok([]);
            const result = await crmService.getDealProducts(DEAL_ID);
            expect(result).toEqual([]);
        });

        it('When API fails / Then throws', async () => {
            fail(500);
            await expect(crmService.getDealProducts(DEAL_ID)).rejects.toBeDefined();
        });
    });

    describe('Given addDealProduct is called', () => {
        it('When API returns new product / Then resolves with product', async () => {
            ok(sampleDealProduct);
            const result = await crmService.addDealProduct(DEAL_ID, { item_id: ITEM_ID, item_name: 'Dining Table', quantity: 1, unit_price: 45000 });
            expect(result).toMatchObject({ item_name: 'Dining Table' });
        });
    });

    describe('Given updateDealProduct is called', () => {
        it('When API returns updated product / Then resolves with updated product', async () => {
            ok({ ...sampleDealProduct, quantity: 3, status: 'ordered' });
            const result = await crmService.updateDealProduct(DEAL_ID, PROD_ID, { quantity: 3, status: 'ordered' });
            expect(result).toMatchObject({ quantity: 3, status: 'ordered' });
        });
    });

    describe('Given removeDealProduct is called', () => {
        it('When API succeeds / Then resolves with { deleted: true }', async () => {
            ok({ deleted: true });
            const result = await crmService.removeDealProduct(DEAL_ID, PROD_ID);
            expect(result).toEqual({ deleted: true });
        });
    });

    describe('Given getDealsByProjectId is called', () => {
        it('When API returns deals array / Then resolves with array', async () => {
            ok([{ id: DEAL_ID, company: 'ABC Corp', project_id: 'project-001' }]);
            const result = await crmService.getDealsByProjectId('project-001');
            expect(Array.isArray(result)).toBe(true);
            expect(result[0]).toMatchObject({ id: DEAL_ID });
        });

        it('When API errors / Then resolves with empty array (graceful)', async () => {
            fail(500);
            const result = await crmService.getDealsByProjectId('project-001');
            expect(result).toEqual([]);
        });
    });
});
