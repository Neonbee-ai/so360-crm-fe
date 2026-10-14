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
            expect(screen.getAllByText('2 BR · 1200 sq ft · $950000')).toHaveLength(2);
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

describe('Given matching units with varied scores and sparse facts', () => {
    describe('When scores fall in each band', () => {
        it('Then 75+ is emerald, 50–74 amber and below 50 slate, rounded', async () => {
            svc.for.mockResolvedValueOnce([
                unit({ item_id: 'hi', unit_number: 'HI', score: 75 }),
                unit({ item_id: 'mid', unit_number: 'MID', score: 50 }),
                unit({ item_id: 'lo', unit_number: 'LO', score: 49.6 }),
            ]);
            render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
            expect((await screen.findByText('75% match')).className).toMatch(/emerald/);
            const fifties = screen.getAllByText('50% match');
            expect(fifties).toHaveLength(2);
            expect(fifties[0].className).toMatch(/amber/);
            expect(fifties[1].className).toMatch(/slate/);
        });
    });

    describe('When a unit has no number, project, tower, facts or reasons', () => {
        it('Then it is named by item id and the optional lines are empty or hidden', async () => {
            svc.for.mockResolvedValueOnce([
                unit({ item_id: 'bare', unit_number: null, project: null, tower: null, bedrooms: null, area_sqft: null, price: null, reasons: undefined }),
            ]);
            render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
            const row = await screen.findByTestId('matching-unit');
            expect(screen.getByText('bare')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Attach bare' })).toBeInTheDocument();
            expect(row.querySelector('.truncate')).toBeNull();
            expect(row.querySelector('.text-\\[11px\\]')).toBeNull();
        });
    });

    describe('When only the project or only the tower is known', () => {
        it('Then just that part is shown', async () => {
            svc.for.mockResolvedValueOnce([
                unit({ item_id: 'p', unit_number: 'P-1', project: 'Marina', tower: null, reasons: [] }),
                unit({ item_id: 't', unit_number: 'T-1', project: null, tower: 'C', reasons: [] }),
            ]);
            render(<MatchingUnitsPanel entity="deal" id="deal-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
            expect(await screen.findByText('Marina')).toBeInTheDocument();
            expect(screen.getByText('Tower C')).toBeInTheDocument();
        });
    });
});

describe('Given an attach that is still in flight', () => {
    it('When the button is tapped / Then it disables with a spinner until onAttach settles', async () => {
        let finish: () => void = () => {};
        const onAttach = vi.fn(() => new Promise<void>((r) => { finish = r; }));
        render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={onAttach} />);
        const btn = await screen.findByRole('button', { name: 'Attach A-101' });
        fireEvent.click(btn);
        await waitFor(() => expect(btn).toBeDisabled());
        expect(screen.getByTestId('icon-Loader2')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Attach B-202' })).toBeEnabled();
        finish();
        await waitFor(() => expect(btn).toBeEnabled());
        expect(screen.queryByTestId('icon-Loader2')).not.toBeInTheDocument();
    });

    it('When onAttach returns synchronously / Then the button re-enables', async () => {
        const onAttach = vi.fn(() => undefined);
        render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={onAttach} />);
        const btn = await screen.findByRole('button', { name: 'Attach A-101' });
        fireEvent.click(btn);
        await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(btn).toBeEnabled());
    });
});

describe('Given the panel lifecycle', () => {
    it('When it unmounts before the lookup settles / Then late results and failures are ignored', async () => {
        let resolveFor: (v: unknown) => void = () => {};
        svc.for.mockReturnValueOnce(new Promise((r) => { resolveFor = r; }));
        render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />).unmount();
        resolveFor([unit()]);

        let rejectFor: (e: unknown) => void = () => {};
        svc.for.mockReturnValueOnce(new Promise((_, rej) => { rejectFor = rej; }));
        render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />).unmount();
        rejectFor(new Error('late'));

        await Promise.resolve();
        expect(screen.queryByTestId('matching-units-panel')).not.toBeInTheDocument();
    });

    it('When the record id changes / Then matches are fetched again for the new id', async () => {
        const view = render(<MatchingUnitsPanel entity="lead" id="lead-1" existingItemIds={new Set()} onAttach={vi.fn()} />);
        await screen.findAllByTestId('matching-unit');
        svc.for.mockResolvedValueOnce([unit({ item_id: 'item-9', unit_number: 'Z-9' })]);
        view.rerender(<MatchingUnitsPanel entity="lead" id="lead-2" existingItemIds={new Set()} onAttach={vi.fn()} />);
        expect(await screen.findByText('Z-9')).toBeInTheDocument();
        expect(svc.for).toHaveBeenLastCalledWith('lead', 'lead-2');
        expect(screen.getByText('Matching units (1)')).toBeInTheDocument();
    });
});
