/**
 * BDD Spec — DealProductsTab RE branches not covered by the matching / unitBooking specs:
 * fallback error copy, null unit facts, the existing-items filter, the chip gate,
 * and the picker's search / empty-state branches with unit booking on.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    flags: new Set<string>(),
    unit: {} as Record<string, unknown>,
    getDealProducts: vi.fn(),
    addDealProduct: vi.fn(),
    searchInventoryItems: vi.fn(),
    getProductCategories: vi.fn(),
}));

vi.mock('../../hooks/useCrmFeatureFlag', () => ({
    RE_FLAGS: { UNIT_BOOKING: 'submodule:crm:unit_booking', PROPERTY_MATCHING: 'submodule:crm:property_matching' },
    useCrmFeatureFlag: (key: string) => mocks.flags.has(key),
}));

vi.mock('../../services/crmService', () => ({
    crmService: {
        getDealProducts: (...a: any[]) => mocks.getDealProducts(...a),
        addDealProduct: (...a: any[]) => mocks.addDealProduct(...a),
        searchInventoryItems: (...a: any[]) => mocks.searchInventoryItems(...a),
        getProductCategories: (...a: any[]) => mocks.getProductCategories(...a),
        getLeadProducts: vi.fn().mockResolvedValue([]),
        updateDealProduct: vi.fn().mockResolvedValue({}),
        removeDealProduct: vi.fn().mockResolvedValue({}),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `$${v}`, formatDate: (d: string) => d }),
}));

// The panel has its own spec; here it stands in as one Attach button whose unit is set per test.
vi.mock('../../components/matching/MatchingUnitsPanel', () => ({
    MatchingUnitsPanel: ({ existingItemIds, onAttach }: any) => (
        <div data-testid="matching-panel" data-existing={[...existingItemIds].join(',')}>
            <button onClick={() => onAttach(mocks.unit)}>Attach unit</button>
        </div>
    ),
}));

import DealProductsTab from './DealProductsTab';

const MATCHING = 'submodule:crm:property_matching';
const BOOKING = 'submodule:crm:unit_booking';

const inv = (id: string, name: string, available_stock: number | null) =>
    ({ id, name, sku: id, price: 1000, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [], available_stock });

const heldLine = {
    id: 'dp1', deal_id: 'deal-1', item_id: 'u1', item_name: 'Unit B-201', quantity: 1, unit_price: 1000,
    status: 'interested', created_at: '', updated_at: '', reservation_status: 'held',
    reservation_expires_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.flags.clear();
    mocks.unit = {
        item_id: 'unit-9', unit_number: 'A-101', project: 'Palm Heights', tower: 'A',
        bedrooms: 2, area_sqft: 1200, price: 950000, score: 80, reasons: [],
    };
    mocks.getDealProducts.mockResolvedValue([]);
    mocks.addDealProduct.mockResolvedValue({});
    mocks.getProductCategories.mockResolvedValue([{ id: 'proj-1', name: 'Palm Heights' }]);
    mocks.searchInventoryItems.mockResolvedValue({
        items: [inv('u1', 'Unit B-201', 2), inv('u2', 'Unit B-202', 0)], total: 2, has_more: false,
    });
});

const openPicker = async () => {
    render(<DealProductsTab dealId="deal-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Add Product/i }));
};

const pickProject = async (id = 'proj-1') => {
    await screen.findByRole('option', { name: 'Palm Heights' });
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: id } });
};

const confirmAdd = () => {
    const addButtons = screen.getAllByRole('button', { name: /^Add Product$/i });
    fireEvent.click(addButtons[addButtons.length - 1]);
};

describe('Given property matching is on for a deal', () => {
    beforeEach(() => { mocks.flags.add(MATCHING); });

    describe('When attaching a unit fails without a message', () => {
        it('Then the generic attach error is shown', async () => {
            mocks.addDealProduct.mockRejectedValue({});
            render(<DealProductsTab dealId="deal-1" />);
            fireEvent.click(await screen.findByRole('button', { name: 'Attach unit' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not attach the unit.');
        });
    });

    describe('When the matched unit has no price, number or project', () => {
        it('Then it is attached as its item id at price 0, with no hold while booking is off', async () => {
            mocks.unit = { item_id: 'unit-bare', unit_number: null, project: null, price: null, score: 10, reasons: [] };
            render(<DealProductsTab dealId="deal-1" />);
            fireEvent.click(await screen.findByRole('button', { name: 'Attach unit' }));
            await waitFor(() => expect(mocks.addDealProduct).toHaveBeenCalledWith('deal-1', {
                item_id: 'unit-bare', item_name: 'unit-bare', quantity: 1, unit_price: 0,
            }));
        });
    });

    describe('When some deal lines have no inventory item', () => {
        it('Then only real item ids are passed as already added', async () => {
            mocks.getDealProducts.mockResolvedValue([
                { id: 'p1', item_id: 'item-1', item_name: 'Linked', quantity: 1, unit_price: 10, status: 'interested' },
                { id: 'p2', item_id: null, item_name: 'Custom build', quantity: 1, unit_price: 0, status: 'interested' },
            ]);
            render(<DealProductsTab dealId="deal-1" />);
            await screen.findByText('Custom build');
            expect(screen.getByTestId('matching-panel')).toHaveAttribute('data-existing', 'item-1');
        });
    });
});

describe('Given unit booking is off', () => {
    describe('When a deal line still carries a hold', () => {
        it('Then no reservation chip is rendered', async () => {
            mocks.getDealProducts.mockResolvedValue([heldLine]);
            render(<DealProductsTab dealId="deal-1" />);
            await screen.findByText('Unit B-201');
            expect(screen.queryByTestId('reservation-chip')).not.toBeInTheDocument();
        });
    });

    describe('When the add call fails without a message', () => {
        it('Then the generic add error is shown', async () => {
            mocks.addDealProduct.mockRejectedValue({});
            await openPicker();
            fireEvent.change(screen.getByPlaceholderText(/Search product name or SKU/i), { target: { value: 'unit' } });
            fireEvent.click(await screen.findByText('Unit B-201'));
            confirmAdd();
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not add the product.');
        });
    });
});

describe('Given unit booking is on', () => {
    beforeEach(() => { mocks.flags.add(BOOKING); });

    describe('When a query is typed with no project picked', () => {
        it('Then the single-argument search is used', async () => {
            await openPicker();
            fireEvent.change(screen.getByPlaceholderText(/Search product name or SKU/i), { target: { value: 'unit' } });
            await screen.findByText('Unit B-201');
            expect(mocks.searchInventoryItems).toHaveBeenCalledWith('unit');
            expect(mocks.searchInventoryItems.mock.calls.every((c) => c.length === 1)).toBe(true);
        });
    });

    describe('When Only available hides every unit of the project', () => {
        it('Then "No products found" is shown', async () => {
            mocks.searchInventoryItems.mockResolvedValue({ items: [inv('u2', 'Unit B-202', 0)], total: 1, has_more: false });
            await openPicker();
            await pickProject();
            await screen.findByText('Unit B-202');
            fireEvent.click(screen.getByLabelText('Only available'));
            expect(screen.queryByText('Unit B-202')).not.toBeInTheDocument();
            expect(screen.getByText('No products found')).toBeInTheDocument();
        });
    });

    describe('When the project is cleared again with no query', () => {
        it('Then the list empties and the start-typing hint returns', async () => {
            await openPicker();
            await pickProject();
            await screen.findByText('Unit B-201');
            fireEvent.change(screen.getByLabelText('Project'), { target: { value: '' } });
            expect(await screen.findByText(/Start typing to search inventory/i)).toBeInTheDocument();
            await waitFor(() => expect(screen.queryByText('Unit B-201')).not.toBeInTheDocument());
            expect(screen.queryByText('No products found')).not.toBeInTheDocument();
        });
    });

    describe('When a longer hold is chosen before adding', () => {
        it('Then that hold is sent as hold_hours', async () => {
            await openPicker();
            await pickProject();
            fireEvent.change(screen.getByLabelText('Hold for'), { target: { value: '72' } });
            fireEvent.click(await screen.findByText('Unit B-201'));
            confirmAdd();
            await waitFor(() => expect(mocks.addDealProduct).toHaveBeenCalledWith('deal-1', expect.objectContaining({
                item_id: 'u1', hold_hours: 72,
            })));
        });
    });

    describe('When property matching is also on and a unit is attached', () => {
        it('Then the default 48h hold rides along', async () => {
            mocks.flags.add(MATCHING);
            render(<DealProductsTab dealId="deal-1" />);
            fireEvent.click(await screen.findByRole('button', { name: 'Attach unit' }));
            await waitFor(() => expect(mocks.addDealProduct).toHaveBeenCalledWith('deal-1', expect.objectContaining({
                item_id: 'unit-9', item_name: 'A-101 · Palm Heights', unit_price: 950000, hold_hours: 48,
            })));
        });
    });
});
