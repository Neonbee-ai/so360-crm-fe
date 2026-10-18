import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../common/Modal', () => ({
    Modal: ({ isOpen, children, title }: any) => isOpen ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}));
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../hooks/useCrmFeatureFlag', () => ({ useCrmFeatureFlag: () => flag.on }));
const svc = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../../services/salesConfigService', () => ({ lossReasonsService: svc }));

import { DealCloseModal } from './DealCloseModal';

const deal = { id: 'd1', name: 'Big Deal', value: 900 } as any;
const setup = (kind: 'won' | 'lost') => {
    const p = { onClose: vi.fn(), onWin: vi.fn(), onLose: vi.fn() };
    render(<DealCloseModal isOpen kind={kind} deal={deal} stageName={kind === 'won' ? 'Won' : 'Lost'} {...p} />);
    return p;
};
const submit = () => fireEvent.submit(document.querySelector('form')!);

beforeEach(() => { flag.on = true; svc.list.mockReset(); svc.list.mockResolvedValue([]); });

describe('Given a deal dropped on a won stage', () => {
    describe('When confirmed', () => {
        it('Then onWin carries the final value, and the project flag when ticked', () => {
            const p = setup('won');
            fireEvent.click(screen.getByLabelText(/create a project/i));
            fireEvent.change(screen.getByLabelText(/why did we win/i), { target: { value: ' fast ' } });
            submit();
            expect(p.onWin).toHaveBeenCalledWith({ won_reason: 'fast', final_value: 900, create_project: true });
        });
    });
});

describe('Given a deal dropped on a lost stage with configured reasons', () => {
    beforeEach(() => svc.list.mockResolvedValue([
        { id: 'r1', label: 'Price', requires_competitor: false },
        { id: 'r2', label: 'Went elsewhere', requires_competitor: true },
        { id: 'r3', label: 'Retired', is_active: false },
    ]));
    describe('When no reason is picked', () => {
        it('Then it asks for one and does not call onLose', async () => {
            const p = setup('lost');
            await waitFor(() => expect(screen.getByLabelText(/lost reason/i)).toBeInTheDocument());
            submit();
            expect(screen.getByRole('alert')).toHaveTextContent('Choose a lost reason');
            expect(p.onLose).not.toHaveBeenCalled();
        });
    });
    describe('When a competitor-requiring reason is picked without a competitor', () => {
        it('Then it asks for the competitor, then submits with it', async () => {
            const p = setup('lost');
            const select = await screen.findByLabelText(/lost reason/i);
            await waitFor(() => expect(screen.getByText('Went elsewhere')).toBeInTheDocument());
            expect(screen.queryByText('Retired')).toBeNull();
            fireEvent.change(select, { target: { value: 'r2' } });
            submit();
            expect(screen.getByRole('alert')).toHaveTextContent('Name the competitor');
            fireEvent.change(screen.getByLabelText(/competitor/i), { target: { value: ' Rival ' } });
            fireEvent.change(screen.getByLabelText(/feedback/i), { target: { value: 'ok' } });
            submit();
            expect(p.onLose).toHaveBeenCalledWith({ lost_reason_id: 'r2', competitor: 'Rival', feedback: 'ok' });
        });
    });
    describe('When a plain reason is picked', () => {
        it('Then it submits only the reason id', async () => {
            const p = setup('lost');
            const select = await screen.findByLabelText(/lost reason/i);
            await waitFor(() => expect(screen.getByText('Price')).toBeInTheDocument());
            fireEvent.change(select, { target: { value: 'r1' } });
            submit();
            expect(p.onLose).toHaveBeenCalledWith({ lost_reason_id: 'r1' });
        });
    });
});

describe('Given an org with no loss reasons (or the flag off)', () => {
    describe('When the reason is blank', () => {
        it('Then it asks for free text, and submits it when given', async () => {
            const p = setup('lost');
            submit();
            expect(screen.getByRole('alert')).toHaveTextContent('Give a reason');
            fireEvent.change(screen.getByLabelText(/lost reason/i), { target: { value: ' too dear ' } });
            submit();
            expect(p.onLose).toHaveBeenCalledWith({ lost_reason: 'too dear' });
        });
    });
    describe('When the flag is off', () => {
        it('Then reasons are not fetched', () => {
            flag.on = false;
            setup('lost');
            expect(svc.list).not.toHaveBeenCalled();
        });
    });
    describe('When fetching reasons fails', () => {
        it('Then it falls back to free text', async () => {
            svc.list.mockRejectedValue(new Error('x'));
            setup('lost');
            await waitFor(() => expect(svc.list).toHaveBeenCalled());
            expect(screen.getByLabelText(/lost reason/i).tagName).toBe('TEXTAREA');
        });
    });
});

describe('Given no deal', () => {
    describe('When rendered', () => {
        it('Then nothing shows', () => {
            const { container } = render(<DealCloseModal isOpen kind="won" deal={null} stageName="" onClose={vi.fn()} onWin={vi.fn()} onLose={vi.fn()} />);
            expect(container.innerHTML).toBe('');
        });
    });
});
