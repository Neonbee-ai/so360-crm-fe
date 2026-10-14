/**
 * BDD Spec — LeadProductsTab RE branches not covered by the matching / unitBooking specs:
 * fallback error copy, null unit facts, the existing-items filter, and infinite
 * scroll carrying the picked project.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    flags: new Set<string>(),
    unit: {} as Record<string, unknown>,
    getLeadProducts: vi.fn(),
    addLeadProduct: vi.fn(),
    searchInventoryItems: vi.fn(),
    getProductCategories: vi.fn(),
}));

vi.mock('../../hooks/useCrmFeatureFlag', () => ({
    RE_FLAGS: { UNIT_BOOKING: 'submodule:crm:unit_booking', PROPERTY_MATCHING: 'submodule:crm:property_matching' },
    useCrmFeatureFlag: (key: string) => mocks.flags.has(key),
}));

vi.mock('../../services/crmService', () => ({
    crmService: {
        getLeadProducts: (...a: any[]) => mocks.getLeadProducts(...a),
        addLeadProduct: (...a: any[]) => mocks.addLeadProduct(...a),
        searchInventoryItems: (...a: any[]) => mocks.searchInventoryItems(...a),
        getProductCategories: (...a: any[]) => mocks.getProductCategories(...a),
        updateLeadProduct: vi.fn().mockResolvedValue({}),
        removeLeadProduct: vi.fn().mockResolvedValue({}),
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

import LeadProductsTab from './LeadProductsTab';

const MATCHING = 'submodule:crm:property_matching';
const BOOKING = 'submodule:crm:unit_booking';

const inv = (id: string, name: string, available_stock: number | null) =>
    ({ id, name, sku: id, price: 1000, cost: 0, image_url: null, metadata: {}, has_variants: false, variants: [], available_stock });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.flags.clear();
    mocks.unit = {
        item_id: 'unit-9', unit_number: 'A-101', project: 'Palm Heights', tower: 'A',
        bedrooms: 2, area_sqft: 1200, price: 950000, score: 80, reasons: [],
    };
    mocks.getLeadProducts.mockResolvedValue([]);
    mocks.addLeadProduct.mockResolvedValue({});
    mocks.getProductCategories.mockResolvedValue([{ id: 'proj-1', name: 'Palm Heights' }]);
    mocks.searchInventoryItems.mockResolvedValue({
        items: [inv('u1', 'Unit A-101', 1), inv('u2', 'Unit A-102', 1)], total: 2, has_more: false,
    });
});

const openPicker = async () => {
    render(<LeadProductsTab leadId="lead-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Add Product/i }));
    await screen.findByText('Unit A-101');
};

const confirmAdd = () => {
    const addButtons = screen.getAllByRole('button', { name: /^Add Product$/i });
    fireEvent.click(addButtons[addButtons.length - 1]);
};

describe('Given property matching is on for a lead', () => {
    beforeEach(() => { mocks.flags.add(MATCHING); });

    describe('When attaching a unit fails without a message', () => {
        it('Then the generic attach error is shown', async () => {
            mocks.addLeadProduct.mockRejectedValue({});
            render(<LeadProductsTab leadId="lead-1" />);
            fireEvent.click(await screen.findByRole('button', { name: 'Attach unit' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not attach the unit.');
        });
    });

    describe('When the matched unit has no price, number or project', () => {
        it('Then it is attached as its item id at price 0, with no hold while booking is off', async () => {
            mocks.unit = { item_id: 'unit-bare', unit_number: null, project: null, price: null, score: 10, reasons: [] };
            render(<LeadProductsTab leadId="lead-1" />);
            fireEvent.click(await screen.findByRole('button', { name: 'Attach unit' }));
            await waitFor(() => expect(mocks.addLeadProduct).toHaveBeenCalledWith('lead-1', {
                item_id: 'unit-bare', item_name: 'unit-bare', quantity: 1, unit_price: 0,
            }));
        });
    });

    describe('When unit booking is also on', () => {
        it('Then an attached unit carries the default 48h hold and its label', async () => {
            mocks.flags.add(BOOKING);
            render(<LeadProductsTab leadId="lead-1" />);
            fireEvent.click(await screen.findByRole('button', { name: 'Attach unit' }));
            await waitFor(() => expect(mocks.addLeadProduct).toHaveBeenCalledWith('lead-1', expect.objectContaining({
                item_id: 'unit-9', item_name: 'A-101 · Palm Heights', unit_price: 950000, hold_hours: 48,
            })));
        });
    });

    describe('When some lead lines have no inventory item', () => {
        it('Then only real item ids are passed as already added', async () => {
            mocks.getLeadProducts.mockResolvedValue([
                { id: 'p1', item_id: 'item-1', item_name: 'Linked', quantity: 1, unit_price: 10, status: 'interested' },
                { id: 'p2', item_id: null, item_name: 'Custom build', quantity: 1, unit_price: 0, status: 'interested' },
            ]);
            render(<LeadProductsTab leadId="lead-1" />);
            await screen.findByText('Custom build');
            expect(screen.getByTestId('matching-panel')).toHaveAttribute('data-existing', 'item-1');
        });
    });
});

describe('Given the Add Product picker', () => {
    describe('When the add call fails without a message', () => {
        it('Then the generic add error is shown', async () => {
            mocks.addLeadProduct.mockRejectedValue({});
            await openPicker();
            fireEvent.click(screen.getByText('Unit A-101'));
            confirmAdd();
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not add the product.');
        });
    });

    describe('When unit booking is on, a project is picked and the list scrolls to its end', () => {
        it('Then the next page is requested within that project', async () => {
            mocks.flags.add(BOOKING);
            mocks.searchInventoryItems.mockImplementation(async (_q: string, _cat: string | undefined, page: { offset: number }) => (
                page.offset === 0
                    ? { items: [inv('u1', 'Unit A-101', 1), inv('u2', 'Unit A-102', 1)], total: 3, has_more: true }
                    : { items: [inv('u3', 'Unit A-103', 1)], total: 3, has_more: false }
            ));
            await openPicker();
            await screen.findByRole('option', { name: 'Palm Heights' });
            fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'proj-1' } });
            await waitFor(() => expect(mocks.searchInventoryItems).toHaveBeenCalledWith('', 'proj-1', { limit: 25, offset: 0 }));
            const list = screen.getByText('Unit A-101').closest('div.overflow-y-auto') as HTMLElement;
            // jsdom reports 0 for every scroll metric, so any scroll counts as "near the end".
            await waitFor(() => {
                fireEvent.scroll(list);
                expect(mocks.searchInventoryItems).toHaveBeenCalledWith('', 'proj-1', { limit: 25, offset: 2 });
            });
            expect(await screen.findByText('Unit A-103')).toBeInTheDocument();
        });
    });

    describe('When unit booking is off and the list scrolls to its end', () => {
        it('Then the next page is requested with no project', async () => {
            mocks.searchInventoryItems.mockImplementation(async (_q: string, _cat: string | undefined, page: { offset: number }) => (
                page.offset === 0
                    ? { items: [inv('u1', 'Unit A-101', 1)], total: 2, has_more: true }
                    : { items: [inv('u3', 'Unit A-103', 1)], total: 2, has_more: false }
            ));
            await openPicker();
            const list = screen.getByText('Unit A-101').closest('div.overflow-y-auto') as HTMLElement;
            await waitFor(() => {
                fireEvent.scroll(list);
                expect(mocks.searchInventoryItems).toHaveBeenCalledWith('', undefined, { limit: 25, offset: 1 });
            });
            expect(screen.queryByTestId('unit-booking-controls')).not.toBeInTheDocument();
        });
    });
});
