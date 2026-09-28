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

describe('Given the remaining ReservationChip tones', () => {
    describe('When a hold carries no expiry', () => {
        it('Then the chip reads Held with the clock icon and no title', () => {
            render(<ReservationChip status="held" />);
            const chip = screen.getByTestId('reservation-chip');
            expect(chip).toHaveTextContent('Held');
            expect(chip).not.toHaveAttribute('title');
            expect(chip.className).toMatch(/amber/);
            expect(screen.getByTestId('icon-Clock')).toBeInTheDocument();
        });
    });

    describe('When the unit is sold', () => {
        it('Then the lock icon and emerald tone are used', () => {
            render(<ReservationChip status="sold" />);
            expect(screen.getByTestId('icon-Lock')).toBeInTheDocument();
            expect(screen.getByTestId('reservation-chip').className).toMatch(/emerald/);
        });
    });

    describe('When the hold was released', () => {
        it('Then the chip is muted', () => {
            render(<ReservationChip status="released" expiresAt={null} />);
            const chip = screen.getByTestId('reservation-chip');
            expect(chip).toHaveTextContent('Released');
            expect(chip.className).toMatch(/slate/);
        });
    });

    describe('When no props are passed at all', () => {
        it('Then nothing renders', () => {
            const { container } = render(<ReservationChip />);
            expect(container).toBeEmptyDOMElement();
        });
    });
});
