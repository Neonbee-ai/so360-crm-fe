import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const api = vi.hoisted(() => ({ getBlob: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import { downloadExport, EXPORT_FORMATS, EXPORT_FORMAT_LABELS, exportService, saveBlob } from './exportService';

/**
 * Feature: RE §48 file exports. The server applies the caller's tenant / org
 * (headers set by crmApiClient) and RBAC record scope; this client only asks
 * for the file and saves it — it never sends tenant or org ids itself.
 */
let clicked: string[] = [];
let createUrl: ReturnType<typeof vi.fn>;
let revokeUrl: ReturnType<typeof vi.fn>;
const blob = new Blob(['a,b']);

beforeEach(() => {
    api.getBlob.mockReset();
    api.getBlob.mockResolvedValue({ blob, filename: null });
    clicked = [];
    createUrl = vi.fn(() => 'blob:x');
    revokeUrl = vi.fn();
    (window.URL as any).createObjectURL = createUrl;
    (window.URL as any).revokeObjectURL = revokeUrl;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download);
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

const lastParams = () => api.getBlob.mock.calls.at(-1)?.[1];

describe('Feature: export service', () => {
    describe('Given the supported formats', () => {
        it('then CSV, Excel and PDF are offered', () => {
            expect(EXPORT_FORMATS).toEqual(['csv', 'xlsx', 'pdf']);
            expect(EXPORT_FORMATS.map((f) => EXPORT_FORMAT_LABELS[f])).toEqual(['CSV', 'Excel', 'PDF']);
        });
    });

    describe('When a blob is saved', () => {
        it('then an anchor is clicked with the filename, removed, and the object URL revoked', () => {
            saveBlob(blob, 'x.csv');
            expect(createUrl).toHaveBeenCalledWith(blob);
            expect(clicked).toEqual(['x.csv']);
            expect(revokeUrl).toHaveBeenCalledWith('blob:x');
            expect(document.querySelectorAll('a[download]')).toHaveLength(0);
        });
    });

    describe('When a file is downloaded', () => {
        it('then the format is sent and the server filename is preferred', async () => {
            api.getBlob.mockResolvedValue({ blob, filename: 'server.xlsx' });
            await downloadExport('/x/export', { a: 1 }, 'fallback', 'xlsx');
            expect(api.getBlob).toHaveBeenCalledWith('/x/export', { a: 1, format: 'xlsx' });
            expect(clicked).toEqual(['server.xlsx']);
        });

        it('then without a server filename the fallback name and format extension are used', async () => {
            await downloadExport('/x/export', {}, 'fallback', 'pdf');
            expect(clicked).toEqual(['fallback.pdf']);
        });

        it('then a server error propagates and nothing is saved', async () => {
            api.getBlob.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
            await expect(downloadExport('/x/export', {}, 'f', 'csv')).rejects.toThrow('Forbidden');
            expect(clicked).toEqual([]);
        });
    });

    describe('Given the sales register and commission report', () => {
        it('then only the set filters are sent to their export endpoints', async () => {
            await exportService.sales({ project_id: 'p1', agent_id: '', from: '2026-01-01' } as any, 'csv');
            expect(api.getBlob).toHaveBeenLastCalledWith('/sales/export', { project_id: 'p1', from: '2026-01-01', format: 'csv' });
            expect(clicked.at(-1)).toBe('sales_register.csv');

            await exportService.commission({ agent_id: 'a1' } as any, 'pdf');
            expect(api.getBlob).toHaveBeenLastCalledWith('/reports/commission/export', { agent_id: 'a1', format: 'pdf' });
            expect(clicked.at(-1)).toBe('commission_report.pdf');
        });
    });

    describe('Given the leads list', () => {
        it('then the "All" stage is not sent as a filter', async () => {
            await exportService.leads({ status: 'All' }, 'csv');
            expect(lastParams()).toEqual({ status: undefined, source: undefined, format: 'csv' });
            expect(api.getBlob.mock.calls.at(-1)?.[0]).toBe('/leads/export');
        });

        it('then a specific stage and source are sent', async () => {
            await exportService.leads({ status: 'Qualified', source: 'Website' }, 'xlsx');
            expect(lastParams()).toEqual({ status: 'Qualified', source: 'Website', format: 'xlsx' });
            expect(clicked.at(-1)).toBe('leads.xlsx');
        });
    });

    describe('Given the deals list', () => {
        it('then custom dates are sent only for a custom range', async () => {
            await exportService.deals({ date_range: 'custom', start_date: '2026-01-01', end_date: '2026-02-01' }, 'csv');
            expect(lastParams()).toMatchObject({ date_range: 'custom', start_date: '2026-01-01', end_date: '2026-02-01' });

            await exportService.deals({ date_range: 'this_month', start_date: '2026-01-01', end_date: '2026-02-01' }, 'csv');
            expect(lastParams()).toMatchObject({ date_range: 'this_month', start_date: undefined, end_date: undefined });
        });

        it('then list-only filters are dropped and only DTO fields are sent', async () => {
            await exportService.deals({ owner_id: 'u1', stage_id: 's1', status: 'won', company_name: 'X', lead_id: 'l1' } as any, 'pdf');
            expect(lastParams()).toEqual({
                date_range: undefined, start_date: undefined, end_date: undefined,
                owner_id: 'u1', stage_id: 's1', status: 'won', format: 'pdf',
            });
            expect(api.getBlob.mock.calls.at(-1)?.[0]).toBe('/deals/export');
            expect(clicked.at(-1)).toBe('deals.pdf');
        });
    });

    describe('Given tenant / org isolation', () => {
        it('then no export request carries tenant or org ids in its params (headers carry them)', async () => {
            await exportService.leads({ status: 'New' }, 'csv');
            await exportService.deals({ status: 'open' }, 'csv');
            await exportService.sales({} as any, 'csv');
            for (const [, params] of api.getBlob.mock.calls) {
                expect(Object.keys(params)).not.toContain('tenant_id');
                expect(Object.keys(params)).not.toContain('org_id');
            }
        });
    });
});
