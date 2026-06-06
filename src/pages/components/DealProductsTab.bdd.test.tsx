/**
 * BDD Spec — DealProductsTab / AddProductModal
 *
 * Covers: products load on mount, empty state rendered, Add Product button opens modal,
 * modal container has max-h-[90vh] overflow-y-auto, modal closes on Cancel.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGetDealProducts = vi.fn();
const mockSearchInventoryItems = vi.fn();

vi.mock('../../services/crmService', () => ({
    crmService: {
        getDealProducts: (...a: any[]) => mockGetDealProducts(...a),
        searchInventoryItems: (...a: any[]) => mockSearchInventoryItems(...a),
        getLeadProducts: vi.fn().mockResolvedValue([]),
        addDealProduct: vi.fn().mockResolvedValue({}),
        updateDealProduct: vi.fn().mockResolvedValue({}),
        removeDealProduct: vi.fn().mockResolvedValue({}),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatCurrency: (v: number) => `$${v}`,
        formatDate: (d: string) => d,
    }),
}));

import DealProductsTab from './DealProductsTab';

beforeEach(() => {
    vi.clearAllMocks();
    mockGetDealProducts.mockResolvedValue([]);
    mockSearchInventoryItems.mockResolvedValue({ items: [] });
});

describe('Given DealProductsTab', () => {
    describe('Given no products exist', () => {
        it('When rendered / Then shows empty state message', async () => {
            render(<DealProductsTab dealId="deal-1" />);
            await waitFor(() => {
                expect(screen.getByText(/No products in this deal/i)).toBeInTheDocument();
            });
        });
    });

    describe('Given Add Product button is clicked', () => {
        it('When clicked / Then AddProductModal appears', async () => {
            render(<DealProductsTab dealId="deal-1" />);
            await waitFor(() => screen.getByRole('button', { name: /Add Product/i }));
            fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));
            expect(screen.getByText(/Add Product to Deal/i)).toBeInTheDocument();
        });

        it('When modal opens / Then container has max-h-[90vh] and overflow-y-auto', async () => {
            render(<DealProductsTab dealId="deal-1" />);
            await waitFor(() => screen.getByRole('button', { name: /Add Product/i }));
            fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));
            const panels = Array.from(document.querySelectorAll('div')).filter(
                el => el.className.includes('max-h-[90vh]'),
            );
            expect(panels.length).toBeGreaterThan(0);
            expect(panels[0].className).toContain('overflow-y-auto');
        });

        it('When the close button is clicked inside modal / Then modal closes', async () => {
            render(<DealProductsTab dealId="deal-1" />);
            await waitFor(() => screen.getByRole('button', { name: /Add Product/i }));
            fireEvent.click(screen.getByRole('button', { name: /Add Product/i }));
            expect(screen.getByText(/Add Product to Deal/i)).toBeInTheDocument();
            fireEvent.click(screen.getByText('✕'));
            expect(screen.queryByText(/Add Product to Deal/i)).not.toBeInTheDocument();
        });
    });
});
