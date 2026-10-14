import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), getOrgId: vi.fn(() => 'org-1') },
    inv: { get: vi.fn() },
    svc: { getDealProducts: vi.fn() },
}));
vi.mock('./crmService', () => ({ crmApiClient: m.api, crmInventoryClient: m.inv, crmService: m.svc }));

import {
    paymentScheduleService, normalizeSchedule, scheduleTotals, canRaiseInvoice, isChequeMode, validateManualLines,
    resolveDealTemplates, PAYMENT_MODES, LINE_STATUSES, TRIGGER_LABELS, type PaymentScheduleLine,
} from './paymentScheduleService';

beforeEach(() => {
    m.api.get.mockReset(); m.api.post.mockReset(); m.api.patch.mockReset();
    m.inv.get.mockReset(); m.svc.getDealProducts.mockReset();
});

const mkLine = (over: Partial<PaymentScheduleLine> = {}): PaymentScheduleLine => ({
    ...normalizeSchedule({ schedule: {}, lines: [{ id: 'l1', label: 'Booking', amount: 100 }] }).lines[0],
    ...over,
});

describe('Given the payment schedule service', () => {
    describe('When a deal has no schedule', () => {
        it('Then GET returns the empty shape', async () => {
            m.api.get.mockResolvedValueOnce({ schedule: null, lines: [] });
            expect(await paymentScheduleService.get('d1')).toEqual({ schedule: null, lines: [] });
            expect(m.api.get).toHaveBeenCalledWith('/deals/d1/payment-schedule');
        });
    });
    describe('When a deal has a schedule', () => {
        it('Then lines are normalised, sorted by seq and templates passed through', async () => {
            m.api.get.mockResolvedValueOnce({
                schedule: { id: 's1', template_id: 't1', template_name: '60/40', billing_mode: 'invoice_per_instalment', currency: 'AED', total_amount: '1000' },
                lines: [
                    { id: 'b', seq: 2, label: 'Handover', amount: '400', trigger: 'handover', status: 'due', payment_mode: 'pdc', reminded_days: [7] },
                    { id: 'a', seq: 1, label: 'Booking', amount: 600, percent: '60', trigger: 'booking', status: 'paid' },
                ],
                templates: [{ id: 't1', name: '60/40' }],
            });
            const r = await paymentScheduleService.get('d1');
            expect(r.schedule).toEqual({ id: 's1', template_id: 't1', template_name: '60/40', billing_mode: 'invoice_per_instalment', currency: 'AED', total_amount: 1000 });
            expect(r.lines.map((l) => l.id)).toEqual(['a', 'b']);
            expect(r.lines[0]).toMatchObject({ percent: 60, status: 'paid', trigger: 'booking' });
            expect(r.lines[1]).toMatchObject({ payment_mode: 'pdc', reminded_days: [7] });
            expect(r.templates).toEqual([{ id: 't1', name: '60/40' }]);
        });
        it('Then unknown enums and junk fall back', () => {
            const r = normalizeSchedule({ schedule: { billing_mode: 'x', total_amount: 'x' }, lines: [{ status: 'x', trigger: 'x', payment_mode: 'x', amount: '' }] });
            expect(r.schedule).toMatchObject({ billing_mode: 'full_invoice', total_amount: 0, template_id: null, currency: null });
            expect(r.lines[0]).toMatchObject({ id: 'line-0', seq: 1, status: 'due', trigger: null, payment_mode: null, amount: 0, label: '' });
            expect(normalizeSchedule(undefined)).toEqual({ schedule: null, lines: [] });
            expect(normalizeSchedule({ schedule: {}, lines: [undefined] }).lines[0].reminded_days).toEqual([]);
        });
    });
    describe('When a schedule is created', () => {
        it('Then a template create posts only the template_id', async () => {
            m.api.post.mockResolvedValueOnce({ schedule: { billing_mode: 'full_invoice' }, lines: [] });
            await paymentScheduleService.createFromTemplate('d1', 't1');
            expect(m.api.post).toHaveBeenCalledWith('/deals/d1/payment-schedule', { template_id: 't1' });
        });
        it('Then manual lines are trimmed and blank optionals dropped', async () => {
            m.api.post.mockResolvedValueOnce({ schedule: null, lines: [] });
            await paymentScheduleService.createManual('d1', [
                { label: ' Booking ', amount: 10, due_date: '2026-10-01', payment_mode: 'cheque' },
                { label: 'Rest', amount: 90, due_date: '', payment_mode: null },
            ]);
            expect(m.api.post).toHaveBeenCalledWith('/deals/d1/payment-schedule', { lines: [
                { label: 'Booking', amount: 10, due_date: '2026-10-01', payment_mode: 'cheque' },
                { label: 'Rest', amount: 90 },
            ] });
        });
    });
    describe('When a line is edited or invoiced', () => {
        it('Then PATCH and POST hit the line routes', async () => {
            m.api.patch.mockResolvedValueOnce({});
            await paymentScheduleService.updateLine('d1', 'l/1', { status: 'paid' });
            expect(m.api.patch).toHaveBeenCalledWith('/deals/d1/payment-schedule/lines/l%2F1', { status: 'paid' });
            m.api.post.mockResolvedValueOnce({ invoice_id: 'inv1' });
            expect(await paymentScheduleService.raiseInvoice('d1', 'l1')).toEqual({ invoice_id: 'inv1' });
            expect(m.api.post).toHaveBeenCalledWith('/deals/d1/payment-schedule/lines/l1/invoice', {});
            m.api.post.mockResolvedValueOnce({ line: { invoice_id: 'inv2' } });
            expect(await paymentScheduleService.raiseInvoice('d1', 'l1')).toEqual({ invoice_id: 'inv2' });
            m.api.post.mockResolvedValueOnce(null);
            expect(await paymentScheduleService.raiseInvoice('d1', 'l1')).toEqual({ invoice_id: null });
        });
    });
});

describe('Given schedule lines', () => {
    it('When totals are computed, Then cancelled lines are excluded and paid split out', () => {
        expect(scheduleTotals([
            mkLine({ amount: 600, status: 'paid' }), mkLine({ amount: 400, status: 'due' }),
            mkLine({ amount: 50, status: 'cancelled' }), mkLine({ amount: 10, status: 'bounced' }),
        ])).toEqual({ total: 1010, paid: 600, outstanding: 410 });
        expect(scheduleTotals([])).toEqual({ total: 0, paid: 0, outstanding: 0 });
    });
    it('When billing is per instalment and the line is due and un-invoiced, Then an invoice may be raised', () => {
        expect(canRaiseInvoice('invoice_per_instalment', mkLine())).toBe(true);
        expect(canRaiseInvoice('full_invoice', mkLine())).toBe(false);
        expect(canRaiseInvoice('schedule_only', mkLine())).toBe(false);
        expect(canRaiseInvoice(null, mkLine())).toBe(false);
        expect(canRaiseInvoice('invoice_per_instalment', mkLine({ status: 'paid' }))).toBe(false);
        expect(canRaiseInvoice('invoice_per_instalment', mkLine({ invoice_id: 'i' }))).toBe(false);
    });
    it('Then only cheque and PDC carry cheque fields', () => {
        expect(isChequeMode('cheque')).toBe(true);
        expect(isChequeMode('pdc')).toBe(true);
        expect(isChequeMode('cash')).toBe(false);
        expect(isChequeMode(null)).toBe(false);
    });
    it('Then the option lists match the contract enums', () => {
        expect(PAYMENT_MODES.map((p) => p.value)).toEqual(['cash', 'cheque', 'pdc', 'bank_transfer', 'mortgage', 'card', 'escrow']);
        expect(LINE_STATUSES.map((p) => p.value)).toEqual(['due', 'invoiced', 'paid', 'bounced', 'cancelled']);
        expect(Object.keys(TRIGGER_LABELS)).toHaveLength(6);
    });
    it('When manual lines are validated, Then empty, unlabeled or non-positive lines are rejected', () => {
        expect(validateManualLines([])).toBe('Add at least one instalment.');
        expect(validateManualLines([{ label: ' ', amount: 1 }])).toBe('Instalment 1: enter a label.');
        expect(validateManualLines([{ label: 'a', amount: 1 }, { label: 'b', amount: 0 }])).toBe('Instalment 2: amount must be greater than 0.');
        expect(validateManualLines([{ label: 'a', amount: NaN }])).toBe('Instalment 1: amount must be greater than 0.');
        expect(validateManualLines([{ label: 'a', amount: 5 }])).toBeNull();
    });
});

describe('Given a deal whose project templates must be resolved', () => {
    it('When the schedule payload carries templates, Then they are used directly with the default first', async () => {
        const ts = await resolveDealTemplates('d1', [{ id: 1, name: 'A' }, { id: 't2', name: 'B', is_default: true, lines: 'x' }, { name: 'no id' }]);
        expect(ts.map((t) => t.id)).toEqual(['t2', '1']);
        expect(ts[0].lines).toEqual([]);
        expect(m.svc.getDealProducts).not.toHaveBeenCalled();
    });
    it('When they are not, Then the product category tree is walked to the nearest templates', async () => {
        m.svc.getDealProducts.mockResolvedValueOnce([{ category_id: null }, { category_id: 'tower' }]);
        m.inv.get.mockResolvedValueOnce({ categories: [
            { id: 'tower', parent_id: 'project', metadata: {} },
            { id: 'project', parent_id: null, metadata: { payment_plan_templates: [{ id: 'pp', name: 'Post-handover' }] } },
        ] });
        const ts = await resolveDealTemplates('d1');
        expect(m.inv.get).toHaveBeenCalledWith('/v1/inventory/settings/org-1');
        expect(ts.map((t) => t.name)).toEqual(['Post-handover']);
    });
    it('When no category defines templates or the tree loops, Then none are offered', async () => {
        m.svc.getDealProducts.mockResolvedValueOnce([{ category_id: 'a' }]);
        m.inv.get.mockResolvedValueOnce({ categories: [{ id: 'a', parent_id: 'b' }, { id: 'b', parent_id: 'a' }] });
        expect(await resolveDealTemplates('d1')).toEqual([]);
    });
    it('When inventory returns junk or the lookup fails, Then none are offered', async () => {
        m.svc.getDealProducts.mockResolvedValueOnce(null);
        m.inv.get.mockResolvedValueOnce({});
        expect(await resolveDealTemplates('d1', [])).toEqual([]);
        m.svc.getDealProducts.mockRejectedValueOnce(new Error('down'));
        m.inv.get.mockResolvedValueOnce({ categories: [] });
        expect(await resolveDealTemplates('d1')).toEqual([]);
    });
});
