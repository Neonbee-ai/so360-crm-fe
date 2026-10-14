import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import type { PaymentScheduleLine, PaymentScheduleResponse } from '../../services/paymentScheduleService';

/**
 * Feature: Deal → Payment plan (RE Phase C, `submodule:crm:payment_plans`).
 *
 * A deal without a plan offers "Create from template" (project plans) or
 * manual instalments. A deal with a plan shows totals and a lines table with
 * inline edit; "Raise invoice" appears only when the plan bills per instalment.
 */

const svc = vi.hoisted(() => ({
    get: vi.fn(),
    createFromTemplate: vi.fn(),
    createManual: vi.fn(),
    updateLine: vi.fn(),
    raiseInvoice: vi.fn(),
}));
const resolve = vi.hoisted(() => ({ fn: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../../services/paymentScheduleService', async (importActual) => {
    const actual = await importActual<typeof import('../../services/paymentScheduleService')>();
    return {
        ...actual,
        paymentScheduleService: svc,
        resolveDealTemplates: (...a: unknown[]) => resolve.fn(...a),
    };
});
vi.mock('../../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatCurrency: (v: number) => `AED ${v}`,
        formatDate: (d: string) => `D:${d}`,
    }),
}));
vi.mock('@so360/design-system', () => ({ toast: toasts }));

import DealPaymentPlanPanel, { diffLine } from './DealPaymentPlanPanel';

const line = (over: Partial<PaymentScheduleLine> = {}): PaymentScheduleLine => ({
    id: 'l1',
    seq: 1,
    label: 'Booking',
    amount: 100,
    percent: null,
    trigger: 'booking',
    due_date: '2026-10-01',
    payment_mode: 'bank_transfer',
    cheque_number: null,
    cheque_date: null,
    cheque_bank: null,
    status: 'due',
    invoice_id: null,
    paid_at: null,
    reminded_days: [],
    ...over,
});

const plan = (lines: PaymentScheduleLine[], billing_mode: 'full_invoice' | 'invoice_per_instalment' | 'schedule_only' = 'invoice_per_instalment', template_name: string | null = '60/40 plan'): PaymentScheduleResponse => ({
    schedule: { id: 's1', template_id: 't1', template_name, billing_mode, currency: 'AED', total_amount: 0 },
    lines,
});
const empty = (): PaymentScheduleResponse => ({ schedule: null, lines: [] });

const loaded = async () => {
    render(<DealPaymentPlanPanel dealId="d1" />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
};

beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    resolve.fn.mockReset();
    toasts.success.mockReset();
    resolve.fn.mockResolvedValue([]);
    svc.updateLine.mockResolvedValue(undefined);
    svc.raiseInvoice.mockResolvedValue({ invoice_id: 'inv-1' });
});

describe('Given the deal payment plan panel', () => {
    describe('When the plan is loading', () => {
        it('Then a loading indicator is shown', () => {
            svc.get.mockReturnValue(new Promise(() => {}));
            render(<DealPaymentPlanPanel dealId="d1" />);
            expect(screen.getByRole('status')).toHaveTextContent(/loading payment plan/i);
        });
    });

    describe('When loading fails', () => {
        it('Then a generic error shows and Retry reloads', async () => {
            svc.get.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
            svc.get.mockResolvedValueOnce(empty());
            await loaded();
            expect(screen.getByRole('alert')).toHaveTextContent('Could not load the payment plan.');
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
            await waitFor(() => expect(screen.getByTestId('payment-plan-empty')).toBeInTheDocument());
            expect(svc.get).toHaveBeenCalledTimes(2);
        });

        it('Then a 4xx message from the backend is shown verbatim', async () => {
            svc.get.mockRejectedValueOnce(Object.assign(new Error('Payment plans are disabled'), { status: 403 }));
            await loaded();
            expect(screen.getByRole('alert')).toHaveTextContent('Payment plans are disabled');
        });
    });

    describe('When the deal has no plan and the project has templates', () => {
        beforeEach(() => {
            svc.get.mockResolvedValue({ ...empty(), templates: [{ id: 't1' }] });
            resolve.fn.mockResolvedValue([
                { id: 't1', name: '60/40', is_default: true, lines: [] },
                { id: 't2', name: 'Post-handover', lines: [] },
            ]);
        });

        it('Then templates are resolved with the GET payload and the default is preselected', async () => {
            await loaded();
            expect(resolve.fn).toHaveBeenCalledWith('d1', [{ id: 't1' }]);
            const select = screen.getByLabelText('Project plan') as HTMLSelectElement;
            expect(select.value).toBe('t1');
            expect(screen.getByRole('option', { name: '60/40 (default)' })).toBeInTheDocument();
        });

        it('Then Create from template posts the chosen template and shows the plan', async () => {
            svc.createFromTemplate.mockResolvedValue(plan([line()]));
            await loaded();
            fireEvent.change(screen.getByLabelText('Project plan'), { target: { value: 't2' } });
            fireEvent.click(screen.getByRole('button', { name: /create from template/i }));
            await waitFor(() => expect(screen.getByRole('table', { name: 'Instalments' })).toBeInTheDocument());
            expect(svc.createFromTemplate).toHaveBeenCalledWith('d1', 't2');
            expect(toasts.success).toHaveBeenCalledWith('Payment plan created');
        });

        it('Then a failed create shows the fallback error and stays on the empty state', async () => {
            svc.createFromTemplate.mockRejectedValue(new Error('x'));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: /create from template/i }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not create the payment plan.'));
            expect(screen.getByTestId('payment-plan-empty')).toBeInTheDocument();
        });
    });

    describe('When the deal has no plan and no templates exist', () => {
        beforeEach(() => {
            svc.get.mockResolvedValue(empty());
        });

        it('Then only manual entry is offered', async () => {
            await loaded();
            expect(resolve.fn).toHaveBeenCalledWith('d1', undefined);
            expect(screen.getByText(/no payment plans set up/i)).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /create from template/i })).not.toBeInTheDocument();
        });

        it('Then manual instalments can be added, edited, removed and created', async () => {
            svc.createManual.mockResolvedValue(plan([line()], 'schedule_only'));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: /enter instalments manually/i }));
            fireEvent.change(screen.getByLabelText('Instalment 1 label'), { target: { value: 'Booking' } });
            fireEvent.change(screen.getByLabelText('Instalment 1 amount'), { target: { value: '100' } });
            fireEvent.change(screen.getByLabelText('Instalment 1 due date'), { target: { value: '2026-10-01' } });
            fireEvent.change(screen.getByLabelText('Instalment 1 payment mode'), { target: { value: 'cheque' } });
            fireEvent.click(screen.getByRole('button', { name: /add instalment/i }));
            fireEvent.change(screen.getByLabelText('Instalment 2 label'), { target: { value: 'Handover' } });
            fireEvent.change(screen.getByLabelText('Instalment 2 amount'), { target: { value: '50' } });
            fireEvent.change(screen.getByLabelText('Instalment 2 payment mode'), { target: { value: 'bogus' } });
            fireEvent.click(screen.getByRole('button', { name: /add instalment/i }));
            fireEvent.click(screen.getByRole('button', { name: 'Remove instalment 3' }));
            expect(screen.queryByLabelText('Instalment 3 label')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /create plan/i }));
            await waitFor(() => expect(svc.createManual).toHaveBeenCalled());
            expect(svc.createManual).toHaveBeenCalledWith('d1', [
                { label: 'Booking', amount: 100, due_date: '2026-10-01', payment_mode: 'cheque' },
                { label: 'Handover', amount: 50, due_date: null, payment_mode: null },
            ]);
            await waitFor(() => expect(screen.getByRole('table', { name: 'Instalments' })).toBeInTheDocument());
        });

        it('Then a blank amount is rejected before anything is sent, and editing clears the error', async () => {
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: /enter instalments manually/i }));
            fireEvent.change(screen.getByLabelText('Instalment 1 label'), { target: { value: 'Booking' } });
            fireEvent.click(screen.getByRole('button', { name: /create plan/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('Instalment 1: amount must be greater than 0.');
            expect(svc.createManual).not.toHaveBeenCalled();
            fireEvent.change(screen.getByLabelText('Instalment 1 amount'), { target: { value: '5' } });
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('Then removing every row is rejected', async () => {
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: /enter instalments manually/i }));
            fireEvent.click(screen.getByRole('button', { name: 'Remove instalment 1' }));
            fireEvent.click(screen.getByRole('button', { name: /create plan/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('Add at least one instalment.');
        });

        it('Then Cancel returns to the choice', async () => {
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: /enter instalments manually/i }));
            fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
            expect(screen.queryByLabelText('Instalment 1 label')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: /enter instalments manually/i })).toBeInTheDocument();
        });

        it('Then a rejected manual create shows the backend reason', async () => {
            svc.createManual.mockRejectedValue(Object.assign(new Error('Lines exceed deal value'), { status: 400 }));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: /enter instalments manually/i }));
            fireEvent.change(screen.getByLabelText('Instalment 1 label'), { target: { value: 'A' } });
            fireEvent.change(screen.getByLabelText('Instalment 1 amount'), { target: { value: '9' } });
            fireEvent.click(screen.getByRole('button', { name: /create plan/i }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Lines exceed deal value'));
        });
    });

    describe('When the deal has a plan', () => {
        const lines = [
            line(),
            line({ id: 'l2', seq: 2, label: 'Handover', amount: 300, status: 'paid', trigger: null, due_date: null, payment_mode: 'pdc', cheque_number: '77', cheque_bank: 'ENBD', cheque_date: '2026-12-01' }),
            line({ id: 'l3', seq: 3, label: 'Extra', amount: 999, status: 'cancelled', payment_mode: null }),
            line({ id: 'l4', seq: 4, label: 'Second', amount: 50, status: 'invoiced', invoice_id: 'inv-9' }),
        ];

        it('Then the header, totals, chips and details are shown (cancelled excluded from totals)', async () => {
            svc.get.mockResolvedValue(plan(lines));
            await loaded();
            expect(screen.getByText('60/40 plan')).toBeInTheDocument();
            expect(screen.getByText('Invoice each instalment')).toBeInTheDocument();
            expect(screen.getByTestId('pp-total-total')).toHaveTextContent('AED 450');
            expect(screen.getByTestId('pp-total-paid')).toHaveTextContent('AED 300');
            expect(screen.getByTestId('pp-total-outstanding')).toHaveTextContent('AED 150');
            const handover = within(screen.getByTestId('pp-line-l2'));
            expect(handover.getByText('Paid')).toBeInTheDocument();
            expect(handover.getByText('PDC')).toBeInTheDocument();
            expect(handover.getByText('#77 · ENBD · D:2026-12-01')).toBeInTheDocument();
            expect(handover.getByText('—')).toBeInTheDocument();
            expect(within(screen.getByTestId('pp-line-l1')).getByText('On booking')).toBeInTheDocument();
            expect(within(screen.getByTestId('pp-line-l1')).getByText('D:2026-10-01')).toBeInTheDocument();
            expect(within(screen.getByTestId('pp-line-l3')).getByText('—')).toBeInTheDocument();
            expect(within(screen.getByTestId('pp-line-l4')).getByText('Invoice raised')).toBeInTheDocument();
        });

        it('Then an unnamed template falls back to "Payment plan"', async () => {
            svc.get.mockResolvedValue(plan([line()], 'full_invoice', null));
            await loaded();
            expect(screen.getByText('Payment plan')).toBeInTheDocument();
            expect(screen.getByText('One invoice for the full price')).toBeInTheDocument();
        });

        it('Then Raise invoice shows only for due, un-invoiced lines when billing per instalment', async () => {
            svc.get.mockResolvedValue(plan(lines));
            await loaded();
            expect(screen.getByRole('button', { name: 'Raise invoice for Booking' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Raise invoice for Handover' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Raise invoice for Second' })).not.toBeInTheDocument();
        });

        it.each(['full_invoice', 'schedule_only'] as const)('Then no Raise invoice is offered for %s plans', async (mode) => {
            svc.get.mockResolvedValue(plan([line()], mode));
            await loaded();
            expect(screen.queryByRole('button', { name: /raise invoice/i })).not.toBeInTheDocument();
        });

        it('Then raising an invoice calls the API and reloads', async () => {
            svc.get.mockResolvedValueOnce(plan([line()]));
            svc.get.mockResolvedValueOnce(plan([line({ status: 'invoiced', invoice_id: 'inv-1' })]));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Raise invoice for Booking' }));
            await waitFor(() => expect(screen.getByText('Invoice raised')).toBeInTheDocument());
            expect(svc.raiseInvoice).toHaveBeenCalledWith('d1', 'l1');
            expect(toasts.success).toHaveBeenCalledWith('Invoice raised for Booking');
        });

        it('Then a failed invoice shows an error', async () => {
            svc.get.mockResolvedValue(plan([line()]));
            svc.raiseInvoice.mockRejectedValue(new Error('x'));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Raise invoice for Booking' }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not raise the invoice.'));
        });

        it('Then inline edit sends only the changed fields and reloads', async () => {
            svc.get.mockResolvedValue(plan([line()]));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Edit Booking' }));
            fireEvent.change(screen.getByLabelText('Booking amount'), { target: { value: '120' } });
            fireEvent.change(screen.getByLabelText('Booking due date'), { target: { value: '' } });
            fireEvent.change(screen.getByLabelText('Booking payment mode'), { target: { value: 'cheque' } });
            fireEvent.change(screen.getByLabelText('Booking cheque number'), { target: { value: ' 123 ' } });
            fireEvent.change(screen.getByLabelText('Booking cheque date'), { target: { value: '2026-11-01' } });
            fireEvent.change(screen.getByLabelText('Booking cheque bank'), { target: { value: 'FAB' } });
            fireEvent.change(screen.getByLabelText('Booking status'), { target: { value: 'paid' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            await waitFor(() => expect(svc.updateLine).toHaveBeenCalled());
            expect(svc.updateLine).toHaveBeenCalledWith('d1', 'l1', {
                amount: 120,
                due_date: null,
                payment_mode: 'cheque',
                cheque_number: '123',
                cheque_date: '2026-11-01',
                cheque_bank: 'FAB',
                status: 'paid',
            });
            await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Instalment updated'));
            expect(svc.get).toHaveBeenCalledTimes(2);
            expect(screen.queryByLabelText('Booking amount')).not.toBeInTheDocument();
        });

        it('Then cheque fields are hidden for non-cheque modes and an unknown mode clears it', async () => {
            svc.get.mockResolvedValue(plan([line()]));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Edit Booking' }));
            expect(screen.queryByLabelText('Booking cheque number')).not.toBeInTheDocument();
            fireEvent.change(screen.getByLabelText('Booking payment mode'), { target: { value: '' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            await waitFor(() => expect(svc.updateLine).toHaveBeenCalledWith('d1', 'l1', { payment_mode: null }));
        });

        it('Then "Invoiced" is not offered as a manual status for a line that is not invoiced', async () => {
            svc.get.mockResolvedValue(plan([line(), line({ id: 'l4', seq: 2, label: 'Second', status: 'invoiced', invoice_id: 'i' })]));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Edit Booking' }));
            const opts = within(screen.getByLabelText('Booking status')).getAllByRole('option').map((o) => o.textContent);
            expect(opts).toEqual(['Due', 'Paid', 'Bounced', 'Cancelled']);
            fireEvent.change(screen.getByLabelText('Booking status'), { target: { value: 'nonsense' } });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            fireEvent.click(screen.getByRole('button', { name: 'Edit Second' }));
            const opts2 = within(screen.getByLabelText('Second status')).getAllByRole('option').map((o) => o.textContent);
            expect(opts2).toContain('Invoiced');
        });

        it('Then saving with no changes just closes the editor', async () => {
            svc.get.mockResolvedValue(plan([line()]));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Edit Booking' }));
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            expect(svc.updateLine).not.toHaveBeenCalled();
            expect(screen.queryByLabelText('Booking amount')).not.toBeInTheDocument();
        });

        it('Then an invalid amount is rejected and editing clears the error', async () => {
            svc.get.mockResolvedValue(plan([line()]));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Edit Booking' }));
            fireEvent.change(screen.getByLabelText('Booking amount'), { target: { value: '0' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            expect(screen.getByRole('alert')).toHaveTextContent('Amount must be greater than 0.');
            expect(svc.updateLine).not.toHaveBeenCalled();
            fireEvent.change(screen.getByLabelText('Booking amount'), { target: { value: '7' } });
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('Then a rejected update keeps the editor open with the reason', async () => {
            svc.get.mockResolvedValue(plan([line()]));
            svc.updateLine.mockRejectedValue(Object.assign(new Error('Paid lines are locked'), { status: 409 }));
            await loaded();
            fireEvent.click(screen.getByRole('button', { name: 'Edit Booking' }));
            fireEvent.change(screen.getByLabelText('Booking amount'), { target: { value: '5' } });
            fireEvent.click(screen.getByRole('button', { name: /save/i }));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Paid lines are locked'));
            expect(screen.getByLabelText('Booking amount')).toBeInTheDocument();
        });
    });
});

describe('Given diffLine', () => {
    it('When a cheque line switches to cash, Then the cheque fields are cleared', () => {
        const l = line({ payment_mode: 'cheque', cheque_number: '1', cheque_date: '2026-01-01', cheque_bank: 'B' });
        expect(diffLine(l, {
            amount: '100', due_date: '2026-10-01', payment_mode: 'cash',
            cheque_number: '1', cheque_date: '2026-01-01', cheque_bank: 'B', status: 'due',
        })).toEqual({ payment_mode: 'cash', cheque_number: null, cheque_date: null, cheque_bank: null });
    });

    it('When the amount is blank, Then it is an error', () => {
        expect(diffLine(line(), {
            amount: ' ', due_date: '', payment_mode: '', cheque_number: '', cheque_date: '', cheque_bank: '', status: 'due',
        })).toBe('Amount must be greater than 0.');
    });
});
