import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import type { CommissionLine } from '../../services/commissionsService';

/**
 * Feature: Deal → Commission (RE Phase C, `submodule:crm:commissions`).
 *
 * One line per participant. Pending lines can be re-priced with a reason;
 * each line offers only the status moves the backend accepts (pending →
 * approved when approval is on, → payable when it is off). Values the caller
 * may not see arrive as null and show "—".
 */

const svc = vi.hoisted(() => ({
    list: vi.fn(),
    generate: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    transition: vi.fn(),
}));
const settingsSvc = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../../services/commissionsService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/commissionsService')>();
    return { ...actual, commissionsService: svc };
});
vi.mock('../../services/salesSettingsService', () => ({ salesSettingsService: settingsSvc }));
vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatCurrency: (v: number) => `AED ${v}`,
        formatDateTime: (d: string) => `T:${d}`,
    }),
}));
vi.mock('@so360/design-system', () => ({ toast: toasts }));

import DealCommissionPanel from './DealCommissionPanel';

const cl = (over: Partial<CommissionLine> = {}): CommissionLine => ({
    id: 'c1',
    participant_type: 'agent',
    user_id: 'u1',
    partner_id: null,
    name: 'Asha',
    basis_amount: 1000,
    percent: 2,
    amount: 20,
    vat_amount: 1,
    status: 'pending',
    override_reason: null,
    approved_by: null,
    approved_at: null,
    paid_at: null,
    audit: [],
    ...over,
});

const loaded = async () => {
    render(<DealCommissionPanel dealId="d1" />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
};

beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    settingsSvc.get.mockReset();
    toasts.success.mockReset();
    settingsSvc.get.mockResolvedValue({ approval_required: true });
    svc.update.mockResolvedValue(undefined);
    svc.transition.mockResolvedValue(undefined);
});

describe('Given the deal commission panel', () => {
    describe('When commissions are loading', () => {
        it('Then a loading indicator is shown', () => {
            svc.list.mockReturnValue(new Promise(() => {}));
            render(<DealCommissionPanel dealId="d1" />);
            expect(screen.getByRole('status')).toHaveTextContent(/loading commissions/i);
        });
    });

    describe('When loading fails', () => {
        it('Then the error shows and Retry reloads', async () => {
            svc.list.mockRejectedValueOnce(new Error('boom'));
            svc.list.mockResolvedValueOnce([]);
            await loaded();
            expect(screen.getByRole('alert')).toHaveTextContent('Could not load commissions.');
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
            await waitFor(() => expect(screen.getByTestId('commission-empty')).toBeInTheDocument());
        });
    });

    describe('When the deal has no commission lines', () => {
        it('Then an empty state and Generate are shown, and Generate fills the list', async () => {
            svc.list.mockResolvedValue([]);
            svc.generate.mockResolvedValue([cl()]);
            await loaded();
            expect(screen.getByTestId('commission-empty')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
            await waitFor(() => expect(screen.getByTestId('commission-c1')).toBeInTheDocument());
            expect(svc.generate).toHaveBeenCalledWith('d1');
            expect(toasts.success).toHaveBeenCalledWith('Commission lines generated');
            expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument();
        });

        it('Then a failed generate shows the backend reason', async () => {
            svc.list.mockResolvedValue([]);
            svc.generate.mockRejectedValue(Object.assign(new Error('Deal is not won'), { status: 400 }));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Deal is not won'));
        });
    });

    describe('When lines are shown', () => {
        it('Then participant, name, values and status are rendered', async () => {
            svc.list.mockResolvedValue([cl({ override_reason: 'Split deal' }), cl({ id: 'c2', participant_type: 'company', name: '', status: 'paid' })]);
            await loaded();
            const row = within(screen.getByTestId('commission-c1'));
            expect(row.getByText('Agent')).toBeInTheDocument();
            expect(row.getByText('Asha')).toBeInTheDocument();
            expect(row.getByText('AED 1000')).toBeInTheDocument();
            expect(row.getByText('2%')).toBeInTheDocument();
            expect(row.getByText('AED 20')).toBeInTheDocument();
            expect(row.getByText('AED 1')).toBeInTheDocument();
            expect(row.getByText('Pending')).toBeInTheDocument();
            expect(row.getByText('Overridden: Split deal')).toBeInTheDocument();
            const company = within(screen.getByTestId('commission-c2'));
            expect(company.getByText('Company')).toBeInTheDocument();
            expect(company.getByText('—')).toBeInTheDocument();
            expect(company.getByText('Paid')).toBeInTheDocument();
        });

        it('Then masked (null) values render as "—" and the line cannot be overridden', async () => {
            svc.list.mockResolvedValue([cl({ basis_amount: null, percent: null, amount: null, vat_amount: null })]);
            await loaded();
            const row = within(screen.getByTestId('commission-c1'));
            expect(row.getAllByText('—')).toHaveLength(4);
            expect(screen.getByTestId('commission-amount-c1')).toHaveTextContent('—');
            expect(screen.queryByRole('button', { name: /override amount/i })).not.toBeInTheDocument();
        });

        it('Then settings failing to load defaults to approval required', async () => {
            settingsSvc.get.mockRejectedValue(new Error('403'));
            svc.list.mockResolvedValue([cl()]);
            await loaded();
            expect(screen.getByText(/need approval/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Approve Asha' })).toBeInTheDocument();
        });
    });

    describe('When choosing a status move', () => {
        it.each([
            ['pending', true, ['Approve Asha', 'Cancel Asha']],
            ['pending', false, ['Mark payable Asha', 'Cancel Asha']],
            ['approved', true, ['Mark payable Asha', 'Cancel Asha']],
            ['payable', true, ['Mark paid Asha', 'Cancel Asha']],
            ['paid', true, []],
            ['cancelled', true, []],
        ] as const)('Then a %s line with approval=%s offers only %j', async (status, approval, names) => {
            settingsSvc.get.mockResolvedValue({ approval_required: approval });
            svc.list.mockResolvedValue([cl({ status })]);
            await loaded();
            const all = ['Approve Asha', 'Mark payable Asha', 'Mark paid Asha', 'Cancel Asha'];
            for (const n of all) {
                if ((names as readonly string[]).includes(n)) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
                else expect(screen.queryByRole('button', { name: n })).not.toBeInTheDocument();
            }
            if (!approval) expect(screen.getByText(/without approval/i)).toBeInTheDocument();
        });

        it('Then confirming sends the move with the note and reloads', async () => {
            svc.list.mockResolvedValueOnce([cl()]);
            svc.list.mockResolvedValueOnce([cl({ status: 'approved' })]);
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Approve Asha' }));
            fireEvent.change(screen.getByLabelText('Note for Asha'), { target: { value: 'ok by GM' } });
            fireEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }));
            await waitFor(() => expect(svc.transition).toHaveBeenCalledWith('d1', 'c1', 'approved', 'ok by GM'));
            await waitFor(() => expect(within(screen.getByTestId('commission-c1')).getByText('Approved')).toBeInTheDocument());
            expect(toasts.success).toHaveBeenCalledWith('Asha: Approved');
        });

        it('Then an unnamed participant is toasted by its role', async () => {
            svc.list.mockResolvedValue([cl({ name: '', participant_type: 'referral' })]);
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
            fireEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }));
            await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Referral: Approved'));
        });

        it('Then Cancel closes the confirmation without calling the API', async () => {
            svc.list.mockResolvedValue([cl()]);
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel Asha' }));
            expect(screen.getByRole('button', { name: 'Confirm: Cancel' })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
            expect(screen.queryByLabelText('Note for Asha')).not.toBeInTheDocument();
            expect(svc.transition).not.toHaveBeenCalled();
        });

        it('Then a rejected move shows the reason', async () => {
            svc.list.mockResolvedValue([cl()]);
            svc.transition.mockRejectedValue(Object.assign(new Error('Illegal transition'), { status: 409 }));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Approve Asha' }));
            fireEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Illegal transition'));
        });
    });

    describe('When overriding an amount', () => {
        beforeEach(() => {
            svc.list.mockResolvedValue([cl()]);
        });

        it('Then only pending lines offer Override', async () => {
            svc.list.mockResolvedValue([cl({ status: 'approved' })]);
            await loaded();
            expect(screen.queryByRole('button', { name: 'Override amount for Asha' })).not.toBeInTheDocument();
        });

        it('Then a reason is required', async () => {
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Override amount for Asha' }));
            fireEvent.change(screen.getByLabelText('New amount for Asha'), { target: { value: '25' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('A reason is required to override a commission.');
            expect(svc.update).not.toHaveBeenCalled();
            fireEvent.change(screen.getByLabelText('Reason for Asha'), { target: { value: 'x' } });
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('Then an unchanged or blank amount is rejected', async () => {
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Override amount for Asha' }));
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('The amount has not changed.');
            fireEvent.change(screen.getByLabelText('New amount for Asha'), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount of 0 or more.');
        });

        it('Then a valid override sends amount + trimmed reason and reloads', async () => {
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Override amount for Asha' }));
            fireEvent.change(screen.getByLabelText('New amount for Asha'), { target: { value: '25' } });
            fireEvent.change(screen.getByLabelText('Reason for Asha'), { target: { value: '  Split with co-broker ' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            await waitFor(() => expect(svc.update).toHaveBeenCalledWith('d1', 'c1', { amount: 25, override_reason: 'Split with co-broker' }));
            await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Commission updated'));
            expect(svc.list).toHaveBeenCalledTimes(2);
            expect(screen.queryByLabelText('New amount for Asha')).not.toBeInTheDocument();
        });

        it('Then Cancel discards the override', async () => {
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Override amount for Asha' }));
            fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
            expect(screen.queryByLabelText('New amount for Asha')).not.toBeInTheDocument();
        });

        it('Then a rejected override shows the fallback for server errors', async () => {
            svc.update.mockRejectedValue(Object.assign(new Error('db down'), { status: 500 }));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Override amount for Asha' }));
            fireEvent.change(screen.getByLabelText('New amount for Asha'), { target: { value: '25' } });
            fireEvent.change(screen.getByLabelText('Reason for Asha'), { target: { value: 'r' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not update the commission.'));
        });
    });

    describe('When a line has an audit trail', () => {
        it('Then History expands and collapses the entries', async () => {
            svc.list.mockResolvedValue([cl({
                status: 'approved',
                audit: [
                    { at: '2026-09-01T10:00:00Z', by: 'Ravi', from: 'pending', to: 'approved', note: 'ok' },
                    { at: null, by: null, from: null, to: 'weird', note: null },
                ],
            })]);
            await loaded();
            const toggle = screen.getByRole('button', { name: 'History for Asha' });
            expect(toggle).toHaveAttribute('aria-expanded', 'false');
            fireEvent.click(toggle);
            const trail = screen.getByRole('list', { name: 'Audit trail for Asha' });
            const items = within(trail).getAllByRole('listitem');
            expect(items[0]).toHaveTextContent('T:2026-09-01T10:00:00Z · Pending → Approved · Ravi · “ok”');
            expect(items[1]).toHaveTextContent('— · — → weird');
            expect(screen.getByRole('button', { name: 'History for Asha' })).toHaveAttribute('aria-expanded', 'true');
            fireEvent.click(screen.getByRole('button', { name: 'History for Asha' }));
            expect(screen.queryByRole('list', { name: 'Audit trail for Asha' })).not.toBeInTheDocument();
        });

        it('Then lines without audit entries offer no History', async () => {
            svc.list.mockResolvedValue([cl()]);
            await loaded();
            expect(screen.queryByRole('button', { name: /history/i })).not.toBeInTheDocument();
        });
    });
});
