import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReservationChip } from './ReservationChip';

describe('Given a product line ReservationChip', () => {
    describe('When the line has no reservation', () => {
        it('Then nothing renders', () => {
            const { container } = render(<ReservationChip status={null} expiresAt={null} />);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('When the unit is sold', () => {
        it('Then the chip reads Sold', () => {
            render(<ReservationChip status="sold" />);
            expect(screen.getByTestId('reservation-chip')).toHaveTextContent('Sold');
        });
    });

    describe('When the unit is held with a future expiry', () => {
        it('Then the chip shows the time left and the expiry in its title', () => {
            const expiresAt = new Date(Date.now() + 5 * 3_600_000 + 60_000).toISOString();
            render(<ReservationChip status="held" expiresAt={expiresAt} />);
            const chip = screen.getByTestId('reservation-chip');
            expect(chip).toHaveTextContent(/Held · 5h left/);
            expect(chip.getAttribute('title')).toMatch(/^Hold expires /);
        });
    });

    describe('When the hold has lapsed', () => {
        it('Then the chip reads Hold expired', () => {
            render(<ReservationChip status="held" expiresAt={new Date(Date.now() - 60_000).toISOString()} />);
            expect(screen.getByTestId('reservation-chip')).toHaveTextContent('Hold expired');
        });
    });
});
