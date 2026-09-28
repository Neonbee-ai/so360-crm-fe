import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetProductCategories = vi.hoisted(() => vi.fn());
vi.mock('../../services/crmService', () => ({
    crmService: { getProductCategories: (...a: unknown[]) => mockGetProductCategories(...a) },
}));

import { UnitBookingControls } from './UnitBookingControls';

const setup = (over: Partial<React.ComponentProps<typeof UnitBookingControls>> = {}) => {
    const props = {
        projectId: '',
        onProjectChange: vi.fn(),
        onlyAvailable: false,
        onOnlyAvailableChange: vi.fn(),
        holdHours: 48,
        onHoldHoursChange: vi.fn(),
        ...over,
    };
    render(<UnitBookingControls {...props} />);
    return props;
};

beforeEach(() => {
    mockGetProductCategories.mockReset();
    mockGetProductCategories.mockResolvedValue([
        { id: 'p1', name: 'Palm Heights' },
        { id: 'p2', name: 'Marina Towers' },
    ]);
});

describe('Given the unit booking controls in a product picker', () => {
    describe('When they mount', () => {
        it('Then the projects load from Inventory categories after an All projects option', async () => {
            setup();
            expect(await screen.findByRole('option', { name: 'Palm Heights' })).toBeInTheDocument();
            const options = screen.getAllByRole('option').map(o => o.textContent);
            expect(options[0]).toBe('All projects');
            expect(options).toContain('Marina Towers');
        });

        it('Then the hold select defaults to the value passed in', () => {
            setup();
            expect((screen.getByLabelText('Hold for') as HTMLSelectElement).value).toBe('48');
            expect(screen.getByRole('option', { name: 'Hold 2 days' })).toBeInTheDocument();
        });
    });

    describe('When the projects request fails', () => {
        it('Then only All projects is offered and nothing throws', async () => {
            mockGetProductCategories.mockRejectedValue(new Error('down'));
            setup();
            await waitFor(() => expect(mockGetProductCategories).toHaveBeenCalled());
            expect(screen.getByRole('option', { name: 'All projects' })).toBeInTheDocument();
            expect(screen.queryByRole('option', { name: 'Palm Heights' })).not.toBeInTheDocument();
        });
    });

    describe('When the user changes each control', () => {
        it('Then each change is reported to the parent', async () => {
            const props = setup();
            await screen.findByRole('option', { name: 'Palm Heights' });
            fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p1' } });
            expect(props.onProjectChange).toHaveBeenCalledWith('p1');
            fireEvent.click(screen.getByLabelText('Only available'));
            expect(props.onOnlyAvailableChange).toHaveBeenCalledWith(true);
            fireEvent.change(screen.getByLabelText('Hold for'), { target: { value: '168' } });
            expect(props.onHoldHoursChange).toHaveBeenCalledWith(168);
        });
    });
});

describe('Given unusual category responses', () => {
    describe('When Inventory returns something other than a list', () => {
        it('Then only All projects is offered', async () => {
            mockGetProductCategories.mockResolvedValue({ data: [] });
            setup();
            await waitFor(() => expect(mockGetProductCategories).toHaveBeenCalled());
            await Promise.resolve();
            expect((screen.getByLabelText('Project') as HTMLSelectElement).options).toHaveLength(1);
        });
    });

    describe('When the picker closes before categories resolve or fail', () => {
        it('Then late results are ignored without errors', async () => {
            let resolveCats: (v: unknown) => void = () => {};
            mockGetProductCategories.mockReturnValueOnce(new Promise((r) => { resolveCats = r; }));
            const first = render(<UnitBookingControls projectId="" onProjectChange={vi.fn()} onlyAvailable onOnlyAvailableChange={vi.fn()} holdHours={24} onHoldHoursChange={vi.fn()} />);
            first.unmount();
            resolveCats([{ id: 'late', name: 'Late Project' }]);

            let rejectCats: (e: unknown) => void = () => {};
            mockGetProductCategories.mockReturnValueOnce(new Promise((_, rej) => { rejectCats = rej; }));
            const second = render(<UnitBookingControls projectId="" onProjectChange={vi.fn()} onlyAvailable={false} onOnlyAvailableChange={vi.fn()} holdHours={24} onHoldHoursChange={vi.fn()} />);
            second.unmount();
            rejectCats(new Error('late failure'));

            await Promise.resolve();
            expect(screen.queryByText('Late Project')).not.toBeInTheDocument();
        });
    });

    describe('When the checkbox is already on and gets unticked', () => {
        it('Then false is reported', () => {
            const props = setup({ onlyAvailable: true });
            fireEvent.click(screen.getByLabelText('Only available'));
            expect(props.onOnlyAvailableChange).toHaveBeenCalledWith(false);
        });
    });
});
