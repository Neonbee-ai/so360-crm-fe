/** Up Next agenda panel (Pulse 552552b8). */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import UpNextPanel, { upNextGroupLabel } from './UpNextPanel';

const item = (id: string, extra: any = {}) => ({
    id, title: `Item ${id}`, type: 'CALL', status: 'OPEN', at: '2026-11-05T15:00:00Z',
    kind: 'booked', overdue: false, day_offset: 0, ...extra,
}) as any;
const props = (items: any[], extra: any = {}) => ({
    items, loading: false, formatTime: (iso: string) => `T(${iso.slice(11, 16)})`,
    formatDay: (iso: string) => `D(${iso.slice(0, 10)})`, onOpen: vi.fn(), ...extra,
});

describe('upNextGroupLabel', () => {
    it('Given each group key / When labelled / Then overdue, today, tomorrow, formatted day or fallback', () => {
        expect(upNextGroupLabel('overdue')).toBe('Overdue');
        expect(upNextGroupLabel(0)).toBe('Today');
        expect(upNextGroupLabel(1)).toBe('Tomorrow');
        expect(upNextGroupLabel(3, item('a', { at: '2026-11-08T09:00:00Z' }), (iso) => `D(${iso.slice(0, 10)})`)).toBe('D(2026-11-08)');
        expect(upNextGroupLabel(4)).toBe('In 4 days');
    });
});

describe('UpNextPanel', () => {
    it('Given loading / When rendered / Then a skeleton shows', () => {
        render(<UpNextPanel {...props([], { loading: true })} />);
        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('Given nothing booked / When rendered / Then the empty state shows', () => {
        render(<UpNextPanel {...props([])} />);
        expect(screen.getByText('Nothing booked')).toBeInTheDocument();
    });

    it('Given overdue, today and later items / When rendered / Then only non-empty groups show, overdue first, with counts', () => {
        render(<UpNextPanel {...props([
            item('o', { overdue: true, day_offset: -1 }),
            item('t'),
            item('l', { day_offset: 3, at: '2026-11-08T09:00:00Z' }),
        ])} />);
        const groups = screen.getAllByTestId(/^up-next-group-/).map(g => g.getAttribute('data-testid'));
        expect(groups).toEqual(['up-next-group-overdue', 'up-next-group-0', 'up-next-group-3']);
        expect(screen.getByTestId('up-next-group-3')).toHaveTextContent('D(2026-11-08) · 1');
        expect(screen.queryByTestId('up-next-group-1')).not.toBeInTheDocument();
    });

    it('Given item kinds / When rendered / Then badges read Overdue, Reminder, Meeting or Call', () => {
        render(<UpNextPanel {...props([
            item('o', { overdue: true }),
            item('r', { kind: 'reminder', type: 'EMAIL' }),
            item('m', { type: 'MEETING' }),
            item('c'),
        ])} />);
        expect(screen.getByTestId('up-next-item-o')).toHaveTextContent('Overdue');
        expect(screen.getByTestId('up-next-item-r')).toHaveTextContent('Reminder');
        expect(screen.getByTestId('up-next-item-m')).toHaveTextContent('Meeting');
        expect(screen.getByTestId('up-next-item-c')).toHaveTextContent('Call');
        expect(screen.getByTestId('up-next-item-c')).toHaveTextContent('T(15:00)');
    });

    it('Given an item / When clicked / Then onOpen receives it', () => {
        const p = props([item('c')]);
        render(<UpNextPanel {...p} />);
        fireEvent.click(screen.getByTestId('up-next-item-c'));
        expect(p.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
    });
});
