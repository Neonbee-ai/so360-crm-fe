/**
 * BDD Spec — LeadProductsTab / AddProductModal
 *
 * Covers: products load on mount, empty state rendered, Add Product button opens modal,
 * modal container has max-h-[90vh] overflow-y-auto, modal closes on Cancel.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetLeadProducts = vi.fn();
const mockSearchInventoryItems = vi.fn();

vi.mock('../../services/crmService', () => ({
    crmService: {
        getLeadProducts: (...a: any[]) => mockGetLeadProducts(...a),
        searchInventoryItems: (...a: any[]) => mockSearchInventoryItems(...a),
        addLeadProduct: vi.fn().mockResolvedValue({}),
        updateLeadProduct: vi.fn().mockResolvedValue({}),
        removeLeadProduct: vi.fn().mockResolvedValue({}),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatCurrency: (v: number) => `$${v}`,
        formatDate: (d: string) => d,
    }),
}));

import LeadProductsTab from './LeadProductsTab';

beforeEach(() => {
    vi.clearAllMocks();
    mockGetLeadProducts.mockResolvedValue([]);
    mockSearchInventoryItems.mockResolvedValue({ items: [], total: 0, has_more: false });
});

describe('Given LeadProductsTab', () => {
    describe('Given no products exist', () => {
        it('When rendered / Then shows empty state message', async () => {
            render(<LeadProductsTab leadId="lead-1" />);
            await waitFor(() => {
                expect(screen.getByText(/No products added yet/i)).toBeInTheDocument();
            });
        });
    });

    describe('Given Add Product button is clicked', () => {
        it('When clicked / Then AddProductModal appears', async () => {
            render(<LeadProductsTab leadId="lead-1" />);
            await waitFor(() => screen.getByRole('button', { name: /Add Product/i }));
            fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));
            expect(screen.getByText(/Add Product/i, { selector: 'h3' })).toBeInTheDocument();
        });

        it('When modal opens / Then container has max-h-[90vh] and overflow-y-auto', async () => {
            render(<LeadProductsTab leadId="lead-1" />);
            await waitFor(() => screen.getByRole('button', { name: /Add Product/i }));
            fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));
            const panels = Array.from(document.querySelectorAll('div')).filter(
                el => el.className.includes('max-h-[90vh]'),
            );
            expect(panels.length).toBeGreaterThan(0);
            expect(panels[0].className).toContain('overflow-y-auto');
        });

        it('When the close button is clicked inside modal / Then modal closes', async () => {
            render(<LeadProductsTab leadId="lead-1" />);
            await waitFor(() => screen.getByRole('button', { name: /Add Product/i }));
            fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));
            fireEvent.click(screen.getByText('✕'));
            const panels = Array.from(document.querySelectorAll('div')).filter(
                el => el.className.includes('max-h-[90vh]'),
            );
            expect(panels.length).toBe(0);
        });
    });
});

describe('Given the Add Product modal opens', () => {
    const openModal = async () => {
        render(<LeadProductsTab leadId="lead-1" />);
        await waitFor(() => screen.getByRole('button', { name: /Add Product/i }));
        fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));
    };

    it('When it opens / Then inventory is fetched with no search term so products show immediately', async () => {
        mockSearchInventoryItems.mockResolvedValue({
            items: [{ id: 'i1', name: 'Blue Widget', sku: 'BW-1', price: 100, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [], available_stock: 7 }],
            total: 1, has_more: false,
        });
        await openModal();
        await waitFor(() => {
            expect(mockSearchInventoryItems).toHaveBeenCalledWith('', undefined, expect.objectContaining({ offset: 0 }));
        });
        expect(await screen.findByText('Blue Widget')).toBeInTheDocument();
    });

    it('When products carry stock / Then availability is displayed alongside name, SKU and price', async () => {
        mockSearchInventoryItems.mockResolvedValue({
            items: [{ id: 'i1', name: 'Blue Widget', sku: 'BW-1', price: 100, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [], available_stock: 7 }],
            total: 1, has_more: false,
        });
        await openModal();
        expect(await screen.findByText('7 in stock')).toBeInTheDocument();
        expect(screen.getByText('SKU: BW-1')).toBeInTheDocument();
    });

    it('When a search term matches nothing on screen / Then the displayed list filters without waiting on a request', async () => {
        mockSearchInventoryItems.mockResolvedValue({
            items: [
                { id: 'i1', name: 'Blue Widget', sku: 'BW-1', price: 100, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [] },
                { id: 'i2', name: 'Red Gadget', sku: 'RG-9', price: 50, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [] },
            ],
            total: 2, has_more: false,
        });
        await openModal();
        expect(await screen.findByText('Red Gadget')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText(/Search product name or SKU/i), { target: { value: 'blue' } });
        expect(screen.queryByText('Red Gadget')).not.toBeInTheDocument();
        expect(screen.getByText('Blue Widget')).toBeInTheDocument();
    });

    it('When inventory fails to load / Then an error with Retry is shown instead of a misleading empty state', async () => {
        mockSearchInventoryItems.mockRejectedValue(new Error('inventory is down'));
        await openModal();
        expect(await screen.findByText('inventory is down')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
        expect(screen.queryByText(/No products in inventory/i)).not.toBeInTheDocument();
    });

    it('When a product is already on the record / Then it is shown as added and cannot be selected again', async () => {
        mockGetLeadProducts.mockResolvedValue([
            { id: 'lp1', lead_id: 'lead-1', item_id: 'i1', item_name: 'Blue Widget', quantity: 1, unit_price: 100, status: 'interested', created_at: '', updated_at: '' },
        ]);
        mockSearchInventoryItems.mockResolvedValue({
            items: [{ id: 'i1', name: 'Blue Widget', sku: 'BW-1', price: 100, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [] }],
            total: 1, has_more: false,
        });
        await openModal();
        const row = await screen.findByTitle('Already added to this record');
        expect(row).toBeDisabled();
    });
});
