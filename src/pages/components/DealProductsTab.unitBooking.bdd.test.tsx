/**
 * BDD Spec — DealProductsTab unit booking (flag `submodule:crm:unit_booking`)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    flag: { on: true },
    getDealProducts: vi.fn(),
    searchInventoryItems: vi.fn(),
    getProductCategories: vi.fn(),
    addDealProduct: vi.fn(),
}));

vi.mock('../../hooks/useCrmFeatureFlag', () => ({
    RE_FLAGS: { UNIT_BOOKING: 'submodule:crm:unit_booking' },
    useCrmFeatureFlag: () => mocks.flag.on,
}));

vi.mock('../../services/crmService', () => ({
    crmService: {
        getDealProducts: (...a: any[]) => mocks.getDealProducts(...a),
        searchInventoryItems: (...a: any[]) => mocks.searchInventoryItems(...a),
        getProductCategories: (...a: any[]) => mocks.getProductCategories(...a),
        getLeadProducts: vi.fn().mockResolvedValue([]),
        addDealProduct: (...a: any[]) => mocks.addDealProduct(...a),
        updateDealProduct: vi.fn().mockResolvedValue({}),
        removeDealProduct: vi.fn().mockResolvedValue({}),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `$${v}`, formatDate: (d: string) => d }),
}));

import DealProductsTab from './DealProductsTab';

const unit = (id: string, name: string, available_stock: number) =>
    ({ id, name, sku: id, price: 1000, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [], available_stock });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.flag.on = true;
    mocks.getDealProducts.mockResolvedValue([]);
    mocks.getProductCategories.mockResolvedValue([{ id: 'proj-1', name: 'Palm Heights' }]);
    mocks.searchInventoryItems.mockResolvedValue({
        items: [unit('u1', 'Unit B-201', 2), unit('u2', 'Unit B-202', 0)],
        total: 2, has_more: false,
    });
    mocks.addDealProduct.mockResolvedValue({});
});

const openPicker = async () => {
    render(<DealProductsTab dealId="deal-1" />);
    const btn = await screen.findByRole('button', { name: /Add Product/i });
    fireEvent.click(btn);
};

const pickProject = async () => {
    await screen.findByRole('option', { name: 'Palm Heights' });
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'proj-1' } });
    await screen.findByText('Unit B-201');
};

describe('Given unit booking is enabled for the tenant', () => {
    describe('When a project is picked before typing anything', () => {
        it('Then that project\'s units are listed straight away', async () => {
            await openPicker();
            await pickProject();
            expect(mocks.searchInventoryItems).toHaveBeenCalledWith('', 'proj-1');
        });
    });

    describe('When Only available is ticked', () => {
        it('Then sold-out units are hidden', async () => {
            await openPicker();
            await pickProject();
            fireEvent.click(screen.getByLabelText('Only available'));
            expect(screen.queryByText('Unit B-202')).not.toBeInTheDocument();
            expect(screen.getByText('Unit B-201')).toBeInTheDocument();
        });
    });

    describe('When a unit is attached with the default hold', () => {
        it('Then hold_hours 48 is sent', async () => {
            await openPicker();
            await pickProject();
            fireEvent.click(screen.getByText('Unit B-201'));
            const addButtons = screen.getAllByRole('button', { name: /^Add Product$/i });
            fireEvent.click(addButtons[addButtons.length - 1]);
            await waitFor(() => {
                expect(mocks.addDealProduct).toHaveBeenCalledWith('deal-1', expect.objectContaining({ item_id: 'u1', hold_hours: 48 }));
            });
        });

        it('Then a 409 shows the backend message', async () => {
            mocks.addDealProduct.mockRejectedValue(Object.assign(new Error('Unit B-201 is already sold'), { status: 409 }));
            await openPicker();
            await pickProject();
            fireEvent.click(screen.getByText('Unit B-201'));
            const addButtons = screen.getAllByRole('button', { name: /^Add Product$/i });
            fireEvent.click(addButtons[addButtons.length - 1]);
            expect(await screen.findByRole('alert')).toHaveTextContent('Unit B-201 is already sold');
        });
    });

    describe('When a deal line is held', () => {
        it('Then the hold chip is shown', async () => {
            mocks.getDealProducts.mockResolvedValue([
                { id: 'dp1', deal_id: 'deal-1', item_id: 'u1', item_name: 'Unit B-201', quantity: 1, unit_price: 1000, status: 'interested', created_at: '', updated_at: '', reservation_status: 'held', reservation_expires_at: new Date(Date.now() + 3 * 3_600_000 + 60_000).toISOString() },
            ]);
            render(<DealProductsTab dealId="deal-1" />);
            expect(await screen.findByTestId('reservation-chip')).toHaveTextContent(/Held · 3h left/);
        });
    });
});

describe('Given unit booking is disabled for the tenant', () => {
    beforeEach(() => { mocks.flag.on = false; });

    it('When the picker opens / Then it keeps the plain search with no unit booking controls', async () => {
        await openPicker();
        expect(screen.queryByTestId('unit-booking-controls')).not.toBeInTheDocument();
        expect(screen.getByText(/Start typing to search inventory/i)).toBeInTheDocument();
    });

    it('When searching / Then the original single-argument search is used', async () => {
        await openPicker();
        fireEvent.change(screen.getByPlaceholderText(/Search product name or SKU/i), { target: { value: 'unit' } });
        await screen.findByText('Unit B-201');
        expect(mocks.searchInventoryItems).toHaveBeenCalledWith('unit');
        fireEvent.click(screen.getByText('Unit B-201'));
        const addButtons = screen.getAllByRole('button', { name: /^Add Product$/i });
        fireEvent.click(addButtons[addButtons.length - 1]);
        await waitFor(() => expect(mocks.addDealProduct).toHaveBeenCalled());
        expect(mocks.addDealProduct.mock.calls[0][1]).not.toHaveProperty('hold_hours');
    });
});
