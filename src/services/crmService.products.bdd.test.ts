/**
 * BDD specs — crmService product API methods
 * Covers: getLeadProducts, addLeadProduct, updateLeadProduct, removeLeadProduct,
 *         getDealProducts, addDealProduct, updateDealProduct, removeDealProduct,
 *         searchInventoryItems (Add Product modal → Inventory single source of truth)
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

describe('crmService — searchInventoryItems (Add Product modal)', () => {
    const sampleItem = { id: ITEM_ID, name: 'Dining Chair', sku: 'CHR-001', stock: 24, unit_price: 4500 };

    // Returns the URL string fetch() was called with on the most recent call.
    const lastFetchUrl = () => String(fetchMock.mock.calls[0][0]);

    describe('Given the search hits the Inventory integration endpoint', () => {
        it('When a query is provided / Then it calls the integration search-with-variants route (NOT the non-existent /items/ route)', async () => {
            ok([sampleItem]);
            await crmService.searchInventoryItems('chair');

            const url = lastFetchUrl();
            // Regression guard for the 404 bug: must target inventory/integration, never inventory/items
            expect(url).toContain('/v1/inventory/integration/search-with-variants');
            expect(url).not.toContain('/v1/inventory/items/search-with-variants');
        });

        it('When a query is provided / Then it forwards q as a query param', async () => {
            ok([sampleItem]);
            await crmService.searchInventoryItems('dining');
            expect(lastFetchUrl()).toContain('q=dining');
        });

        it('When a categoryId is provided / Then it forwards category_id', async () => {
            ok([sampleItem]);
            await crmService.searchInventoryItems('chair', 'cat-001');
            const url = lastFetchUrl();
            expect(url).toContain('q=chair');
            expect(url).toContain('category_id=cat-001');
        });

        it('When no categoryId is provided / Then category_id is omitted from the request', async () => {
            ok([sampleItem]);
            await crmService.searchInventoryItems('chair');
            expect(lastFetchUrl()).not.toContain('category_id');
        });
    });

    describe('Given the backend returns various response shapes', () => {
        it('When the body is a bare array / Then items resolves to that array', async () => {
            ok([sampleItem]);
            const result = await crmService.searchInventoryItems('chair');
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toMatchObject({ sku: 'CHR-001' });
        });

        it('When the body is wrapped in { items } / Then items unwraps it', async () => {
            ok({ items: [sampleItem] });
            const result = await crmService.searchInventoryItems('chair');
            expect(result.items).toHaveLength(1);
        });

        it('When the body is wrapped in { data } / Then items falls back to data', async () => {
            ok({ data: [sampleItem] });
            const result = await crmService.searchInventoryItems('chair');
            expect(result.items).toHaveLength(1);
        });

        it('When the body has neither items nor data / Then items resolves to []', async () => {
            ok({ total: 0 });
            const result = await crmService.searchInventoryItems('chair');
            expect(result.items).toEqual([]);
        });
    });

    describe('Given the request fails', () => {
        it('When the endpoint 404s / Then it resolves to { items: [] } (graceful, no throw)', async () => {
            fail(404);
            const result = await crmService.searchInventoryItems('chair');
            expect(result).toEqual({ items: [] });
        });

        it('When the endpoint 500s / Then it resolves to { items: [] } (graceful, no throw)', async () => {
            fail(500);
            const result = await crmService.searchInventoryItems('chair');
            expect(result).toEqual({ items: [] });
        });
    });
});
