import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { SaleRow } from '../services/salesReportService';

/**
 * Feature: Sales register (RE Phase C §27, `submodule:crm:commissions`).
 * Filters by project / agent / developer / dates, pages 25 at a time, shows a
 * payment-status badge per sale and masks commission the caller may not see.
 */

const report = vi.hoisted(() => ({ listSales: vi.fn(), commissionReport: vi.fn() }));
const crm = vi.hoisted(() => ({ getProductCategories: vi.fn(), getUsers: vi.fn() }));

vi.mock('../services/salesReportService', async (importActual) => {
    const actual = await importActual<typeof import('../services/salesReportService')>();
    return { ...actual, salesReportService: report };
});
vi.mock('../services/crmService', () => ({ crmService: crm }));
vi.mock('../utils/formatters', () => ({
    useCRMFormatters: () => ({
        formatCurrency: (v: number) => `AED ${v}`,
        formatDate: (d: string) => `D:${d}`,
    }),
}));

import SalesPage, { SALES_PAGE_SIZE } from './SalesPage';

const row = (over: Partial<SaleRow> = {}): SaleRow => ({
    deal_id: 'd1',
    developer_id: 'dev1',
    developer_name: 'Emaar',
    project_id: 'p1',
    project_name: 'Marina Heights',
    unit_id: 'unit1',
    unit_number: 'A-101',
    client_name: 'Omar',
    agent_id: 'u1',
    agent_name: 'Asha',
    sale_price: 1000000,
    sale_date: '2026-05-01',
    payment_status: 'partial',
    agent_commission: 20000,
    company_commission: 30000,
    ...over,
});

const renderPage = () => render(<MemoryRouter><SalesPage /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
    report.listSales.mockReset();
    crm.getProductCategories.mockResolvedValue([{ id: 'p1', name: 'Marina Heights' }]);
    crm.getUsers.mockResolvedValue([{ id: 'u1', full_name: 'Asha', email: 'a@x' }]);
});

describe('Feature: Sales register', () => {
    describe('Given the list is still loading', () => {
        it('When the page opens / Then a loading status is announced and page 1 is requested with no filters', async () => {
            report.listSales.mockReturnValue(new Promise(() => {}));
            renderPage();
            expect(screen.getByRole('status')).toHaveTextContent('Loading sales…');
            expect(report.listSales).toHaveBeenCalledWith({}, 1, SALES_PAGE_SIZE);
        });
    });

    describe('Given sales are returned', () => {
        it('When rendered / Then each sale shows its details, a link to the deal and a payment badge', async () => {
            report.listSales.mockResolvedValue({ rows: [row()], total: 1 });
            renderPage();
            const tr = await screen.findByTestId('sale-d1');
            const cells = within(tr);
            expect(cells.getByText('D:2026-05-01')).toBeInTheDocument();
            expect(cells.getByText('Marina Heights')).toBeInTheDocument();
            expect(cells.getByText('Omar')).toBeInTheDocument();
            expect(cells.getByText('Emaar')).toBeInTheDocument();
            expect(cells.getByText('Asha')).toBeInTheDocument();
            expect(cells.getByText('AED 1000000')).toBeInTheDocument();
            expect(cells.getByRole('link', { name: 'A-101' })).toHaveAttribute('href', '/deal/d1');
            expect(screen.getByTestId('sale-status-d1')).toHaveTextContent('Partial');
            expect(screen.getByTestId('sale-agent-commission-d1')).toHaveTextContent('AED 20000');
            expect(screen.getByTestId('sale-company-commission-d1')).toHaveTextContent('AED 30000');
            expect(screen.getByTestId('sales-paging')).toHaveTextContent('Page 1 of 1 · 1 sale');
        });

        it.each([
            ['none', 'No plan'],
            ['pending', 'Pending'],
            ['partial', 'Partial'],
            ['paid', 'Paid'],
            ['overdue', 'Overdue'],
        ] as const)('When payment_status is %s / Then the badge reads "%s"', async (status, label) => {
            report.listSales.mockResolvedValue({ rows: [row({ payment_status: status })], total: 1 });
            renderPage();
            expect(await screen.findByTestId('sale-status-d1')).toHaveTextContent(label);
        });

        it('When optional fields are missing / Then dashes stand in and the unit link reads "View deal"', async () => {
            report.listSales.mockResolvedValue({
                rows: [row({
                    sale_date: null, project_name: null, client_name: null, developer_name: null,
                    agent_name: null, unit_number: null, sale_price: null,
                })],
                total: 1,
            });
            renderPage();
            const tr = await screen.findByTestId('sale-d1');
            expect(within(tr).getByRole('link', { name: 'View deal' })).toBeInTheDocument();
            expect(within(tr).getAllByText('—').length).toBe(6);
        });
    });

    describe('Given the caller may not see commission', () => {
        it('When commission values arrive null / Then both commission columns are masked with "—"', async () => {
            report.listSales.mockResolvedValue({ rows: [row({ agent_commission: null, company_commission: null })], total: 1 });
            renderPage();
            expect(await screen.findByTestId('sale-agent-commission-d1')).toHaveTextContent('—');
            expect(screen.getByTestId('sale-company-commission-d1')).toHaveTextContent('—');
            expect(screen.queryByText('AED 20000')).not.toBeInTheDocument();
        });
    });

    describe('Given no sales match', () => {
        it('When the list is empty / Then the empty state is shown', async () => {
            report.listSales.mockResolvedValue({ rows: [], total: 0 });
            renderPage();
            expect(await screen.findByTestId('sales-empty')).toHaveTextContent('No sales match these filters.');
        });
    });

    describe('Given the request fails', () => {
        it('When a 500 arrives / Then the fallback message and Retry are shown, and Retry reloads', async () => {
            report.listSales.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
            report.listSales.mockResolvedValueOnce({ rows: [row()], total: 1 });
            renderPage();
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not load sales.');
            fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
            expect(await screen.findByTestId('sale-d1')).toBeInTheDocument();
            expect(report.listSales).toHaveBeenCalledTimes(2);
        });

        it('When a 400 explains itself / Then the backend message is shown verbatim', async () => {
            report.listSales.mockRejectedValue(Object.assign(new Error('Invalid date range'), { status: 400 }));
            renderPage();
            expect(await screen.findByRole('alert')).toHaveTextContent('Invalid date range');
        });
    });

    describe('Given more than one page of sales', () => {
        it('When Next and Previous are pressed / Then the matching pages are requested and bounds disable the buttons', async () => {
            report.listSales.mockResolvedValue({ rows: [row()], total: 60 });
            renderPage();
            await screen.findByTestId('sale-d1');
            expect(screen.getByTestId('sales-paging')).toHaveTextContent('Page 1 of 3 · 60 sales');
            expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

            fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
            await waitFor(() => expect(report.listSales).toHaveBeenLastCalledWith({}, 2, SALES_PAGE_SIZE));
            await screen.findByText(/Page 2 of 3/);

            fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
            await screen.findByText(/Page 3 of 3/);
            expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

            fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
            await waitFor(() => expect(report.listSales).toHaveBeenLastCalledWith({}, 2, SALES_PAGE_SIZE));
        });
    });

    describe('Given filters', () => {
        it('When a filter changes on page 2 / Then paging resets to page 1 with the filter applied', async () => {
            report.listSales.mockResolvedValue({ rows: [row()], total: 60 });
            renderPage();
            await screen.findByTestId('sale-d1');
            fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
            await screen.findByText(/Page 2 of 3/);
            await screen.findByRole('option', { name: 'Asha' });
            fireEvent.change(screen.getByLabelText('Agent'), { target: { value: 'u1' } });
            await waitFor(() => expect(report.listSales).toHaveBeenLastCalledWith({ agent_id: 'u1' }, 1, SALES_PAGE_SIZE));
        });

        it('When sales from several developers load / Then the developer filter lists each once, and keeps them after filtering', async () => {
            report.listSales.mockResolvedValueOnce({
                rows: [
                    row({ deal_id: 'd1' }),
                    row({ deal_id: 'd2', developer_id: 'dev2', developer_name: null }),
                    row({ deal_id: 'd3' }),
                    row({ deal_id: 'd4', developer_id: null, developer_name: null }),
                ],
                total: 4,
            });
            report.listSales.mockResolvedValueOnce({ rows: [row({ deal_id: 'd1' })], total: 1 });
            renderPage();
            await screen.findByTestId('sale-d1');
            const dev = screen.getByLabelText('Developer');
            expect(within(dev).getAllByRole('option').map((o) => o.textContent)).toEqual(['All developers', 'Emaar', 'dev2']);

            fireEvent.change(dev, { target: { value: 'dev1' } });
            await waitFor(() => expect(report.listSales).toHaveBeenLastCalledWith({ developer_id: 'dev1' }, 1, SALES_PAGE_SIZE));
            await waitFor(() => expect(screen.queryByTestId('sale-d2')).not.toBeInTheDocument());
            expect(within(screen.getByLabelText('Developer')).getAllByRole('option')).toHaveLength(3);
        });

        it('When the date range is inverted / Then no request is sent and only the validation message shows', async () => {
            report.listSales.mockResolvedValue({ rows: [row()], total: 1 });
            renderPage();
            await screen.findByTestId('sale-d1');
            fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-06-10' } });
            fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-06-01' } });
            expect(screen.getByRole('alert')).toHaveTextContent('The start date must be on or before the end date.');
            expect(screen.queryByTestId('sale-d1')).not.toBeInTheDocument();
            expect(report.listSales).toHaveBeenCalledTimes(2); // initial + the valid "from" only
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });

    describe('Given the page unmounts mid-request', () => {
        it('When the request settles late / Then nothing is rendered or thrown', async () => {
            let settle: (v: unknown) => void = () => {};
            let fail: (e: unknown) => void = () => {};
            report.listSales.mockReturnValueOnce(new Promise((res) => { settle = res; }));
            const first = renderPage();
            first.unmount();
            settle({ rows: [row()], total: 1 });

            report.listSales.mockReturnValueOnce(new Promise((_res, rej) => { fail = rej; }));
            const second = renderPage();
            second.unmount();
            fail(new Error('late'));
            await Promise.resolve();
            expect(screen.queryByTestId('sale-d1')).not.toBeInTheDocument();
        });
    });
});
