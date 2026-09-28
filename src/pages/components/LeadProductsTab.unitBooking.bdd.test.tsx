/**
 * BDD Spec — LeadProductsTab unit booking (flag `submodule:crm:unit_booking`)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    flag: { on: true },
    getLeadProducts: vi.fn(),
    searchInventoryItems: vi.fn(),
    getProductCategories: vi.fn(),
    addLeadProduct: vi.fn(),
}));

vi.mock('../../hooks/useCrmFeatureFlag', () => ({
    RE_FLAGS: { UNIT_BOOKING: 'submodule:crm:unit_booking' },
    useCrmFeatureFlag: () => mocks.flag.on,
}));

vi.mock('../../services/crmService', () => ({
    crmService: {
        getLeadProducts: (...a: any[]) => mocks.getLeadProducts(...a),
        searchInventoryItems: (...a: any[]) => mocks.searchInventoryItems(...a),
        getProductCategories: (...a: any[]) => mocks.getProductCategories(...a),
        addLeadProduct: (...a: any[]) => mocks.addLeadProduct(...a),
        updateLeadProduct: vi.fn().mockResolvedValue({}),
        removeLeadProduct: vi.fn().mockResolvedValue({}),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `$${v}`, formatDate: (d: string) => d }),
}));

import LeadProductsTab from './LeadProductsTab';

const unit = (id: string, name: string, available_stock: number) =>
    ({ id, name, sku: id, price: 1000, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [], available_stock });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.flag.on = true;
    mocks.getLeadProducts.mockResolvedValue([]);
    mocks.getProductCategories.mockResolvedValue([{ id: 'proj-1', name: 'Palm Heights' }]);
    mocks.searchInventoryItems.mockResolvedValue({
        items: [unit('u1', 'Unit A-101', 1), unit('u2', 'Unit A-102', 0)],
        total: 2, has_more: false,
    });
    mocks.addLeadProduct.mockResolvedValue({});
});

const openPicker = async () => {
    render(<LeadProductsTab leadId="lead-1" />);
    const btn = await screen.findByRole('button', { name: /Add Product/i });
    fireEvent.click(btn);
    await screen.findByText('Unit A-101');
};

describe('Given unit booking is enabled for the tenant', () => {
    describe('When the Add Product picker opens', () => {
        it('Then Project, Only available and Hold controls are shown', async () => {
            await openPicker();
            expect(screen.getByTestId('unit-booking-controls')).toBeInTheDocument();
            expect(await screen.findByRole('option', { name: 'Palm Heights' })).toBeInTheDocument();
        });
    });

    describe('When a project is picked', () => {
        it('Then inventory is searched within that category', async () => {
            await openPicker();
            await screen.findByRole('option', { name: 'Palm Heights' });
            fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'proj-1' } });
            await waitFor(() => {
                expect(mocks.searchInventoryItems).toHaveBeenCalledWith('', 'proj-1', expect.objectContaining({ offset: 0 }));
            });
        });
    });

    describe('When Only available is ticked', () => {
        it('Then sold-out units are hidden', async () => {
            await openPicker();
            expect(screen.getByText('Unit A-102')).toBeInTheDocument();
            fireEvent.click(screen.getByLabelText('Only available'));
            expect(screen.queryByText('Unit A-102')).not.toBeInTheDocument();
            expect(screen.getByText('Unit A-101')).toBeInTheDocument();
        });
    });

    describe('When a unit is attached', () => {
        it('Then the chosen hold is sent as hold_hours', async () => {
            await openPicker();
            fireEvent.change(screen.getByLabelText('Hold for'), { target: { value: '72' } });
            fireEvent.click(screen.getByText('Unit A-101'));
            const addButtons = screen.getAllByRole('button', { name: /^Add Product$/i });
            fireEvent.click(addButtons[addButtons.length - 1]);
            await waitFor(() => {
                expect(mocks.addLeadProduct).toHaveBeenCalledWith('lead-1', expect.objectContaining({ item_id: 'u1', hold_hours: 72 }));
            });
        });

        it('Then a 409 from an already-held unit shows its message', async () => {
            mocks.addLeadProduct.mockRejectedValue(Object.assign(new Error('Unit A-101 is held on another lead until 30 Sep'), { status: 409 }));
            await openPicker();
            fireEvent.click(screen.getByText('Unit A-101'));
            const addButtons = screen.getAllByRole('button', { name: /^Add Product$/i });
            fireEvent.click(addButtons[addButtons.length - 1]);
            expect(await screen.findByRole('alert')).toHaveTextContent('Unit A-101 is held on another lead until 30 Sep');
        });
    });

    describe('When a product line carries a reservation', () => {
        it('Then a hold/sold chip is shown on the line', async () => {
            mocks.getLeadProducts.mockResolvedValue([
                { id: 'lp1', lead_id: 'lead-1', item_id: 'u1', item_name: 'Unit A-101', quantity: 1, unit_price: 1000, status: 'interested', created_at: '', updated_at: '', reservation_status: 'sold' },
            ]);
            render(<LeadProductsTab leadId="lead-1" />);
            expect(await screen.findByTestId('reservation-chip')).toHaveTextContent('Sold');
        });
    });
});

describe('Given unit booking is disabled for the tenant', () => {
    beforeEach(() => { mocks.flag.on = false; });

    it('When the picker opens / Then no unit booking controls render', async () => {
        await openPicker();
        expect(screen.queryByTestId('unit-booking-controls')).not.toBeInTheDocument();
    });

    it('When a product is attached / Then no hold_hours is sent', async () => {
        await openPicker();
        fireEvent.click(screen.getByText('Unit A-101'));
        const addButtons = screen.getAllByRole('button', { name: /^Add Product$/i });
        fireEvent.click(addButtons[addButtons.length - 1]);
        await waitFor(() => expect(mocks.addLeadProduct).toHaveBeenCalled());
        expect(mocks.addLeadProduct.mock.calls[0][1]).not.toHaveProperty('hold_hours');
    });

    it('When a line carries a reservation / Then no chip renders', async () => {
        mocks.getLeadProducts.mockResolvedValue([
            { id: 'lp1', lead_id: 'lead-1', item_id: 'u1', item_name: 'Unit A-101', quantity: 1, unit_price: 1000, status: 'interested', created_at: '', updated_at: '', reservation_status: 'held' },
        ]);
        render(<LeadProductsTab leadId="lead-1" />);
        await screen.findByText('Unit A-101');
        expect(screen.queryByTestId('reservation-chip')).not.toBeInTheDocument();
    });
});
