import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { KanbanBoard, AUTO_SCROLL_EDGE_PX } from './KanbanBoard';
import { Deal } from '../../types/crm';

vi.mock('@so360/shell-context', () => ({
    useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US', timezone: 'UTC' } }),
}));
vi.mock('@so360/formatters', () => ({
    useFormatters: () => ({ formatCurrency: (v: number) => `$${v}` }),
}));

// jsdom's DragEvent constructor doesn't reliably surface clientX through
// fireEvent's eventInit, so dispatch a plain Event with clientX defined
// directly on it for the edge-proximity auto-scroll assertions.
function dragOverAt(el: HTMLElement, clientX: number) {
    const event = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clientX', { value: clientX, configurable: true });
    fireEvent(el, event);
}

const STAGES = [
    { id: 'new', name: 'New' },
    { id: 'qualified', name: 'Qualified' },
    { id: 'won', name: 'Won', is_terminal: true },
];

function makeDeal(overrides: Partial<Deal> = {}): Deal {
    return {
        id: 'deal-1',
        name: 'Acme Refit',
        company_name: 'Acme Co',
        value: 1000,
        expected_close_date: '2026-10-01',
        stage: 'New' as any,
        current_flow_state: 'new',
        owner: { id: 'u1', full_name: 'Jane Doe' } as any,
        notes: [],
        activities: [],
        ...overrides,
    } as Deal;
}

describe('Given a Pipeline board with more stages than fit the viewport', () => {
    let onDealClick: ReturnType<typeof vi.fn>;
    let onStageChange: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onDealClick = vi.fn();
        onStageChange = vi.fn();
    });

    test('When rendered, Then the scroll container uses the visible pipeline-scrollbar class, not scrollbar-hide', () => {
        const { container } = render(
            <KanbanBoard deals={[makeDeal()]} stages={STAGES} onDealClick={onDealClick} onStageChange={onStageChange} />
        );
        const board = container.firstElementChild as HTMLElement;
        expect(board.className).toContain('pipeline-scrollbar');
        expect(board.className).not.toContain('scrollbar-hide');
        expect(board.className).toContain('overflow-x-auto');
    });

    test('When rendered, Then every configured stage appears as a column regardless of count', () => {
        render(<KanbanBoard deals={[]} stages={STAGES} onDealClick={onDealClick} onStageChange={onStageChange} />);
        for (const stage of STAGES) {
            expect(screen.getByText(stage.name)).toBeInTheDocument();
        }
    });

    test('When a deal card is clicked, Then onDealClick fires with that deal', () => {
        const deal = makeDeal();
        render(<KanbanBoard deals={[deal]} stages={STAGES} onDealClick={onDealClick} onStageChange={onStageChange} />);
        fireEvent.click(screen.getByText('Acme Refit'));
        expect(onDealClick).toHaveBeenCalledWith(deal);
    });

    test('When a card is dropped on a different stage column, Then onStageChange fires with the target stage', () => {
        const deal = makeDeal({ current_flow_state: 'new' });
        const { container } = render(
            <KanbanBoard deals={[deal]} stages={STAGES} onDealClick={onDealClick} onStageChange={onStageChange} />
        );
        const dropZones = container.querySelectorAll('[class*="min-h-0"]');
        const qualifiedDropZone = dropZones[1] as HTMLElement;

        const dataTransfer = { getData: () => 'deal-1', setData: () => {}, dropEffect: '', effectAllowed: '' };
        fireEvent.drop(qualifiedDropZone, { dataTransfer });

        expect(onStageChange).toHaveBeenCalledWith(deal, 'qualified');
    });

    test('When a card is dropped back on its own current stage, Then onStageChange does not fire', () => {
        const deal = makeDeal({ current_flow_state: 'new' });
        const { container } = render(
            <KanbanBoard deals={[deal]} stages={STAGES} onDealClick={onDealClick} onStageChange={onStageChange} />
        );
        const dropZones = container.querySelectorAll('[class*="min-h-0"]');
        const newDropZone = dropZones[0] as HTMLElement;

        const dataTransfer = { getData: () => 'deal-1', setData: () => {}, dropEffect: '', effectAllowed: '' };
        fireEvent.drop(newDropZone, { dataTransfer });

        expect(onStageChange).not.toHaveBeenCalled();
    });

    describe('Given a card is being dragged near the board edge', () => {
        test('When dragOver fires within AUTO_SCROLL_EDGE_PX of the right edge, Then the board auto-scrolls right', () => {
            const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1 as any);
            const deal = makeDeal();
            const { container } = render(
                <KanbanBoard deals={[deal]} stages={STAGES} onDealClick={onDealClick} onStageChange={onStageChange} />
            );
            const board = container.firstElementChild as HTMLElement;
            vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 1000, top: 0, bottom: 100, width: 1000, height: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect);

            dragOverAt(board, 1000 - (AUTO_SCROLL_EDGE_PX - 10));

            expect(rafSpy).toHaveBeenCalled();
            rafSpy.mockRestore();
        });

        test('When dragOver fires well within the board (not near an edge), Then no auto-scroll frame is scheduled', () => {
            const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1 as any);
            const deal = makeDeal();
            const { container } = render(
                <KanbanBoard deals={[deal]} stages={STAGES} onDealClick={onDealClick} onStageChange={onStageChange} />
            );
            const board = container.firstElementChild as HTMLElement;
            vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 1000, top: 0, bottom: 100, width: 1000, height: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect);

            dragOverAt(board, 500);

            expect(rafSpy).not.toHaveBeenCalled();
            rafSpy.mockRestore();
        });

        test('When the drag ends, Then any in-flight auto-scroll animation frame is cancelled', () => {
            const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 42 as any);
            const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
            const deal = makeDeal();
            const { container } = render(
                <KanbanBoard deals={[deal]} stages={STAGES} onDealClick={onDealClick} onStageChange={onStageChange} />
            );
            const board = container.firstElementChild as HTMLElement;
            vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 1000, top: 0, bottom: 100, width: 1000, height: 100, x: 0, y: 0, toJSON: () => {} } as DOMRect);

            dragOverAt(board, 1000 - (AUTO_SCROLL_EDGE_PX - 10));
            expect(rafSpy).toHaveBeenCalled();

            const card = screen.getByText('Acme Refit').closest('[draggable]') as HTMLElement;
            fireEvent.dragEnd(card);

            expect(cafSpy).toHaveBeenCalledWith(42);
            rafSpy.mockRestore();
            cafSpy.mockRestore();
        });
    });
});
