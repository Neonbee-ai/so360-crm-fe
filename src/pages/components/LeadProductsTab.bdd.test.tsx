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
    mockSearchInventoryItems.mockResolvedValue({ items: [] });
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
