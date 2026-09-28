import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({ for: vi.fn() }));

vi.mock('../../services/matchingUnitsService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/matchingUnitsService')>();
    return { ...actual, matchingUnitsService: svc };
});
vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `$${v}` }),
}));

import { toast } from '@so360/design-system';
import MatchingUnitsPanel from './MatchingUnitsPanel';

const unit = (over: Record<string, any> = {}) => ({
    item_id: 'item-1',
    unit_number: 'A-101',
    project: 'Palm Heights',
    tower: 'A',
    bedrooms: 2,
    area_sqft: 1200,
    price: 950000,
    score: 82,
    reasons: ['Within budget', '2 BR as asked'],
    ...over,
});

const writeText = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    writeText.mockResolvedValue(undefined);
    svc.for.mockResolvedValue([unit(), unit({ item_id: 'item-2', unit_number: 'B-202', score: 40, reasons: [] })]);
});

describe('Given the matching units panel on a lead', () => {
    describe('When matches load', () => {
        it('Then each unit shows its score, facts and reasons', async () => {
            render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
            const rows = await screen.findAllByTestId('matching-unit');
            expect(svc.for).toHaveBeenCalledWith('lead', 'lead-1');
            expect(rows).toHaveLength(2);
            expect(screen.getByText('Matching units (2)')).toBeInTheDocument();
            expect(screen.getByText('82% match')).toBeInTheDocument();
            expect(screen.getByText('2 BR · 1200 sq ft · $950000')).toBeInTheDocument();
            expect(screen.getByText('Within budget · 2 BR as asked')).toBeInTheDocument();
        });
    });

    describe('When there are no matches, or the lookup fails', () => {
        it('Then nothing renders', async () => {
            svc.for.mockResolvedValueOnce([]);
            const { container, unmount } = render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
            await waitFor(() => expect(svc.for).toHaveBeenCalled());
            expect(container).toBeEmptyDOMElement();
            unmount();

            svc.for.mockRejectedValueOnce(new Error('403'));
            const second = render(<MatchingUnitsPanel entity="deal" id="deal-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
            await waitFor(() => expect(svc.for).toHaveBeenCalledWith('deal', 'deal-1'));
            expect(second.container).toBeEmptyDOMElement();
        });
    });

    describe('When a unit is attached', () => {
        it('Then onAttach receives that unit in one tap', async () => {
            const onAttach = vi.fn().mockResolvedValue(undefined);
            render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={onAttach} />);
            fireEvent.click(await screen.findByRole('button', { name: 'Attach A-101' }));
            await waitFor(() => expect(onAttach).toHaveBeenCalledWith(expect.objectContaining({ item_id: 'item-1' })));
        });
    });

    describe('When a unit is already on the record', () => {
        it('Then its button reads Added and is disabled', async () => {
            render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set(['item-1'])} onAttach={vi.fn()} />);
            expect(await screen.findByRole('button', { name: 'A-101 added' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Attach B-202' })).toBeEnabled();
        });
    });

    describe('When a unit is shared', () => {
        it('Then its summary is copied to the clipboard and confirmed', async () => {
            render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
            fireEvent.click(await screen.findByRole('button', { name: 'Share A-101' }));
            await waitFor(() => expect(writeText).toHaveBeenCalledWith('Unit A-101\nPalm Heights, Tower A\n2 BR · 1200 sq ft\nPrice: $950000'));
            expect(toast.success).toHaveBeenCalled();
        });

        it('Then a blocked clipboard says the copy failed', async () => {
            writeText.mockRejectedValueOnce(new Error('denied'));
            render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
            fireEvent.click(await screen.findByRole('button', { name: 'Share A-101' }));
            await waitFor(() => expect(toast.error).toHaveBeenCalled());
        });
    });
});
