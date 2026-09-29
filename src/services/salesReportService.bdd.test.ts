import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    salesReportService, normalizeSalesPage, normalizeCommissionReport, toQuery, validateDateRange, PAYMENT_STATUS_LABELS,
} from './salesReportService';

beforeEach(() => { api.get.mockReset(); });

const row = { deal_id: 'd1', project_id: 'p1', project_name: 'Marina', unit_number: '1204', client_name: 'Omar', agent_name: 'Asha', sale_price: '1500000', sale_date: '2026-09-01', payment_status: 'partial', agent_commission: '15000', company_commission: null };

describe('Given the sales register service', () => {
    describe('When sales are listed with filters', () => {
        it('Then GET /sales carries only non-blank filters plus paging', async () => {
            api.get.mockResolvedValueOnce({ rows: [row], total: 42 });
            const page = await salesReportService.listSales({ project_id: 'p1', agent_id: '', from: '2026-09-01' }, 2, 25);
            expect(api.get).toHaveBeenCalledWith('/sales', { project_id: 'p1', from: '2026-09-01', page: 2, limit: 25 });
            expect(page.total).toBe(42);
            expect(page.rows[0]).toMatchObject({ sale_price: 1500000, payment_status: 'partial', agent_commission: 15000, company_commission: null, developer_id: null });
        });
    });
    it('When the envelope is a bare array, {data}, {items} or junk, Then rows and total are derived', () => {
        expect(normalizeSalesPage([row]).total).toBe(1);
        expect(normalizeSalesPage({ data: [row, row], meta: { total: 9 } }).total).toBe(9);
        expect(normalizeSalesPage({ items: [row] }).rows).toHaveLength(1);
        expect(normalizeSalesPage(null)).toEqual({ rows: [], total: 0 });
    });
    it('When a row is sparse or carries an unknown status, Then it falls back safely', () => {
        const [r] = normalizeSalesPage([{ payment_status: 'weird', sale_price: 'x' }]).rows;
        expect(r).toMatchObject({ deal_id: '', payment_status: 'none', sale_price: null, agent_commission: null });
        expect(normalizeSalesPage([undefined]).rows[0].deal_id).toBe('');
    });
    it('Then every payment status has a label', () => {
        expect(Object.keys(PAYMENT_STATUS_LABELS)).toEqual(['none', 'pending', 'partial', 'paid', 'overdue']);
    });
});

describe('Given the commission report service', () => {
    it('When the report is fetched, Then GET /reports/commission is called with the filters', async () => {
        api.get.mockResolvedValueOnce({
            totals: { gross: '100', agent: 60, company: 40, pending: 10, approved: 20, payable: 30, paid: 40 },
            by_project: [{ project_id: 'p1', project_name: 'Marina', gross: 100, agent: 60, company: 40, count: 2 }],
            by_agent: [{ agent_id: 'u1', agent_name: 'Asha', gross: 60, agent: 60, company: 0, deals: '3' }],
            by_month: [{ month: '2026-09', gross: 100, agent: 60, company: 40 }],
        });
        const r = await salesReportService.commissionReport({ developer_id: 'dev1' });
        expect(api.get).toHaveBeenCalledWith('/reports/commission', { developer_id: 'dev1' });
        expect(r.totals.gross).toBe(100);
        expect(r.by_project[0]).toEqual({ key: 'p1', label: 'Marina', gross: 100, agent: 60, company: 40, count: 2 });
        expect(r.by_agent[0]).toMatchObject({ key: 'u1', label: 'Asha', count: 3 });
        expect(r.by_month[0]).toMatchObject({ key: '2026-09', label: '2026-09', count: null });
    });
    it('When the report is empty or buckets lack names, Then zeros and fallbacks apply', () => {
        const r = normalizeCommissionReport({ by_project: [{ gross: 'x' }, { key: 'k' }], by_agent: 'no' });
        expect(r.totals).toEqual({ gross: 0, agent: 0, company: 0, pending: 0, approved: 0, payable: 0, paid: 0 });
        expect(r.by_project[0]).toMatchObject({ key: '', label: 'Unassigned', gross: 0 });
        expect(r.by_project[1]).toMatchObject({ key: 'k', label: 'k' });
        expect(r.by_agent).toEqual([]);
        expect(normalizeCommissionReport(null).by_month).toEqual([]);
    });
    it('When the caller lacks commission view, Then the 403 propagates', async () => {
        api.get.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
        await expect(salesReportService.commissionReport({})).rejects.toMatchObject({ status: 403 });
    });
});

describe('Given sales filters', () => {
    it('When blanks are present, Then toQuery drops them', () => {
        expect(toQuery({ project_id: '', to: '2026-09-30' })).toEqual({ to: '2026-09-30' });
    });
    it('When from is after to, Then the range is rejected; otherwise it passes', () => {
        expect(validateDateRange({ from: '2026-10-01', to: '2026-09-01' })).toBe('The start date must be on or before the end date.');
        expect(validateDateRange({ from: '2026-09-01', to: '2026-09-01' })).toBeNull();
        expect(validateDateRange({ from: '2026-09-01' })).toBeNull();
    });
});
