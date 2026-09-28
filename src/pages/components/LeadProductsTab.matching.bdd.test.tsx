/**
 * BDD Spec — LeadProductsTab property matching (flag `submodule:crm:property_matching`)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    flags: new Set<string>(),
    getLeadProducts: vi.fn(),
    addLeadProduct: vi.fn(),
}));

vi.mock('../../hooks/useCrmFeatureFlag', () => ({
    RE_FLAGS: { UNIT_BOOKING: 'submodule:crm:unit_booking', PROPERTY_MATCHING: 'submodule:crm:property_matching' },
    useCrmFeatureFlag: (key: string) => mocks.flags.has(key),
}));

vi.mock('../../services/crmService', () => ({
    crmService: {
        getLeadProducts: (...a: any[]) => mocks.getLeadProducts(...a),
        addLeadProduct: (...a: any[]) => mocks.addLeadProduct(...a),
        searchInventoryItems: vi.fn().mockResolvedValue({ items: [], total: 0, has_more: false }),
        getProductCategories: vi.fn().mockResolvedValue([]),
        updateLeadProduct: vi.fn().mockResolvedValue({}),
        removeLeadProduct: vi.fn().mockResolvedValue({}),
        updateDealProduct: vi.fn().mockResolvedValue({}),
        removeDealProduct: vi.fn().mockResolvedValue({}),
    },
}));

vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `$${v}`, formatDate: (d: string) => d }),
}));

// The panel has its own spec; here it stands in as one Attach button.
vi.mock('../../components/matching/MatchingUnitsPanel', () => ({
    MatchingUnitsPanel: ({ entity, id, existingItemIds, onAttach }: any) => (
        <div data-testid="matching-panel" data-entity={entity} data-id={id} data-existing={[...existingItemIds].join(',')}>
            <button onClick={() => onAttach({
                item_id: 'unit-9', unit_number: 'A-101', project: 'Palm Heights', tower: 'A',
                bedrooms: 2, area_sqft: 1200, price: 950000, score: 80, reasons: [],
            })}>Attach A-101</button>
        </div>
    ),
}));

import LeadProductsTab from './LeadProductsTab';

const MATCHING = 'submodule:crm:property_matching';
const BOOKING = 'submodule:crm:unit_booking';
const renderTab = () => render(<LeadProductsTab leadId="lead-1" />);

beforeEach(() => {
    vi.clearAllMocks();
    mocks.flags.clear();
    mocks.getLeadProducts.mockResolvedValue([{ id: 'p1', item_id: 'item-1', item_name: 'Existing', quantity: 1, unit_price: 10, status: 'interested' }]);
    mocks.addLeadProduct.mockResolvedValue({});
});

describe('Given a lead products tab', () => {
    describe('When property matching is off (non-RE tenant)', () => {
        it('Then no matching panel renders', async () => {
            renderTab();
            await waitFor(() => expect(mocks.getLeadProducts).toHaveBeenCalled());
            expect(screen.queryByTestId('matching-panel')).not.toBeInTheDocument();
        });
    });

    describe('When property matching is on', () => {
        it('Then the panel is shown for this lead with the items already added', async () => {
            mocks.flags.add(MATCHING);
            renderTab();
            const panel = await screen.findByTestId('matching-panel');
            expect(panel).toHaveAttribute('data-entity', 'lead');
            expect(panel).toHaveAttribute('data-id', 'lead-1');
            await waitFor(() => expect(panel).toHaveAttribute('data-existing', 'item-1'));
        });

        it('Then attaching a unit adds it as a product (no hold without unit booking) and reloads', async () => {
            mocks.flags.add(MATCHING);
            renderTab();
            fireEvent.click(await screen.findByRole('button', { name: 'Attach A-101' }));
            await waitFor(() => expect(mocks.addLeadProduct).toHaveBeenCalledWith('lead-1', {
                item_id: 'unit-9',
                item_name: 'A-101 · Palm Heights',
                quantity: 1,
                unit_price: 950000,
            }));
            await waitFor(() => expect(mocks.getLeadProducts).toHaveBeenCalledTimes(2));
        });

        it('Then with unit booking on the attach carries the default 48h hold', async () => {
            mocks.flags.add(MATCHING);
            mocks.flags.add(BOOKING);
            renderTab();
            fireEvent.click(await screen.findByRole('button', { name: 'Attach A-101' }));
            await waitFor(() => expect(mocks.addLeadProduct).toHaveBeenCalledWith('lead-1', expect.objectContaining({ hold_hours: 48 })));
        });

        it('Then a rejected attach explains why', async () => {
            mocks.flags.add(MATCHING);
            mocks.addLeadProduct.mockRejectedValueOnce(new Error('Unit is already held'));
            renderTab();
            fireEvent.click(await screen.findByRole('button', { name: 'Attach A-101' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Unit is already held');
        });
    });
});
