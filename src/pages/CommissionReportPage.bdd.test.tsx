import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import type { CommissionBucket, CommissionReport } from '../services/salesReportService';

/**
 * Feature: Commission report (RE Phase C §28, `submodule:crm:commissions`).
 * Totals by state, then breakdowns by project, agent and month. Roles without
 * commission visibility get a 403, shown as a plain no-access message.
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

import CommissionReportPage, { TOTAL_CARDS, isEmptyReport } from './CommissionReportPage';

const bucket = (over: Partial<CommissionBucket> = {}): CommissionBucket => ({
    key: 'k1', label: 'Marina Heights', gross: 50000, agent: 20000, company: 30000, count: 2, ...over,
});

const fullReport = (): CommissionReport => ({
    totals: { gross: 50000, agent: 20000, company: 30000, pending: 1, approved: 2, payable: 3, paid: 4 },
    by_project: [bucket()],
    by_agent: [bucket({ key: 'u1', label: 'Asha', count: null })],
    by_month: [],
});

const emptyReport = (): CommissionReport => ({
    totals: { gross: 0, agent: 0, company: 0, pending: 0, approved: 0, payable: 0, paid: 0 },
    by_project: [], by_agent: [], by_month: [],
});

beforeEach(() => {
    vi.clearAllMocks();
    report.commissionReport.mockReset();
    crm.getProductCategories.mockResolvedValue([{ id: 'p1', name: 'Marina Heights' }]);
    crm.getUsers.mockResolvedValue([{ id: 'u1', full_name: 'Asha', email: 'a@x' }]);
});

describe('Feature: Commission report', () => {
    describe('Given the report is loading', () => {
        it('When the page opens / Then a loading status shows and the unfiltered report is requested', () => {
            report.commissionReport.mockReturnValue(new Promise(() => {}));
            render(<CommissionReportPage />);
            expect(screen.getByRole('status')).toHaveTextContent('Loading commission report…');
            expect(report.commissionReport).toHaveBeenCalledWith({});
        });
    });

    describe('Given a populated report', () => {
        it('When rendered / Then every total card shows its amount', async () => {
            report.commissionReport.mockResolvedValue(fullReport());
            render(<CommissionReportPage />);
            await screen.findByTestId('cr-total-gross');
            const expected: Record<string, string> = {
                gross: 'AED 50000', agent: 'AED 20000', company: 'AED 30000',
                pending: 'AED 1', approved: 'AED 2', payable: 'AED 3', paid: 'AED 4',
            };
            TOTAL_CARDS.forEach((c) => {
                expect(screen.getByText(c.label)).toBeInTheDocument();
                expect(screen.getByTestId(`cr-total-${c.key}`)).toHaveTextContent(expected[c.key]);
            });
        });

        it('When rendered / Then project and agent breakdowns list their buckets and an empty month section says so', async () => {
            report.commissionReport.mockResolvedValue(fullReport());
            render(<CommissionReportPage />);
            const byProject = await screen.findByRole('table', { name: 'By project' });
            const pRow = within(byProject).getAllByRole('row')[1];
            expect(within(pRow).getAllByRole('cell').map((c) => c.textContent))
                .toEqual(['Marina Heights', '2', 'AED 50000', 'AED 20000', 'AED 30000']);
            expect(within(byProject).getByRole('columnheader', { name: 'Project' })).toBeInTheDocument();

            const byAgent = screen.getByRole('table', { name: 'By agent' });
            const aRow = within(byAgent).getAllByRole('row')[1];
            expect(within(aRow).getAllByRole('cell')[1]).toHaveTextContent('—');
            expect(within(byAgent).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Agent', 'Deals', 'Gross', 'Agent', 'Company']);

            expect(screen.queryByRole('table', { name: 'By month' })).not.toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'By month' })).toBeInTheDocument();
            expect(screen.getByText('Nothing to show.')).toBeInTheDocument();
        });

        it('When a bucket has no key / Then it still renders (index key fallback)', async () => {
            const r = fullReport();
            r.by_month = [bucket({ key: '', label: '2026-05' }), bucket({ key: '', label: '2026-06' })];
            report.commissionReport.mockResolvedValue(r);
            render(<CommissionReportPage />);
            const byMonth = await screen.findByRole('table', { name: 'By month' });
            expect(within(byMonth).getByText('2026-05')).toBeInTheDocument();
            expect(within(byMonth).getByText('2026-06')).toBeInTheDocument();
            expect(within(byMonth).getByRole('columnheader', { name: 'Month' })).toBeInTheDocument();
        });
    });

    describe('Given nothing has been earned', () => {
        it('When all totals are zero and no buckets exist / Then the empty state is shown instead of tables', async () => {
            report.commissionReport.mockResolvedValue(emptyReport());
            render(<CommissionReportPage />);
            expect(await screen.findByTestId('commission-report-empty')).toHaveTextContent('No commission recorded for these filters.');
            expect(screen.queryByTestId('cr-total-gross')).not.toBeInTheDocument();
        });
    });

    describe('Given the caller cannot see commission', () => {
        it('When the API answers 403 / Then a no-access message shows with no Retry', async () => {
            report.commissionReport.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
            render(<CommissionReportPage />);
            expect(await screen.findByTestId('commission-report-forbidden'))
                .toHaveTextContent("You don't have access to commission figures. Ask your manager if you need them.");
            expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
        });
    });

    describe('Given the request fails', () => {
        it('When a 500 arrives / Then the fallback message shows and Retry reloads the report', async () => {
            report.commissionReport.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
            report.commissionReport.mockResolvedValueOnce(fullReport());
            render(<CommissionReportPage />);
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the commission report.');
            fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
            expect(await screen.findByTestId('cr-total-gross')).toBeInTheDocument();
            expect(report.commissionReport).toHaveBeenCalledTimes(2);
        });

        it('When a 400 explains itself / Then the backend message is shown verbatim', async () => {
            report.commissionReport.mockRejectedValue(Object.assign(new Error('Bad agent id'), { status: 400 }));
            render(<CommissionReportPage />);
            expect(await screen.findByRole('alert')).toHaveTextContent('Bad agent id');
        });

        it('When an error has no status / Then the fallback message is shown', async () => {
            report.commissionReport.mockRejectedValue(undefined);
            render(<CommissionReportPage />);
            expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the commission report.');
        });
    });

    describe('Given filters', () => {
        it('When a project is chosen / Then the report is refetched for that project', async () => {
            report.commissionReport.mockResolvedValue(fullReport());
            render(<CommissionReportPage />);
            await screen.findByRole('option', { name: 'Marina Heights' });
            fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p1' } });
            await waitFor(() => expect(report.commissionReport).toHaveBeenLastCalledWith({ project_id: 'p1' }));
        });

        it('When the page renders / Then no developer filter is offered (the report has no developer list)', async () => {
            report.commissionReport.mockResolvedValue(fullReport());
            render(<CommissionReportPage />);
            await screen.findByTestId('cr-total-gross');
            expect(screen.queryByLabelText('Developer')).not.toBeInTheDocument();
        });

        it('When the date range is inverted / Then no request is sent and only the validation message shows', async () => {
            report.commissionReport.mockResolvedValue(fullReport());
            render(<CommissionReportPage />);
            await screen.findByTestId('cr-total-gross');
            fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-06-01' } });
            await waitFor(() => expect(report.commissionReport).toHaveBeenCalledTimes(2));
            fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-06-10' } });
            expect(screen.getByRole('alert')).toHaveTextContent('The start date must be on or before the end date.');
            expect(screen.queryByTestId('cr-total-gross')).not.toBeInTheDocument();
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
            expect(report.commissionReport).toHaveBeenCalledTimes(2);
        });
    });

    describe('Given the page unmounts mid-request', () => {
        it('When the request settles late / Then nothing renders or throws', async () => {
            let settle: (v: unknown) => void = () => {};
            let fail: (e: unknown) => void = () => {};
            report.commissionReport.mockReturnValueOnce(new Promise((res) => { settle = res; }));
            render(<CommissionReportPage />).unmount();
            settle(fullReport());

            report.commissionReport.mockReturnValueOnce(new Promise((_res, rej) => { fail = rej; }));
            render(<CommissionReportPage />).unmount();
            fail(Object.assign(new Error('x'), { status: 403 }));
            await Promise.resolve();
            expect(screen.queryByTestId('commission-report-forbidden')).not.toBeInTheDocument();
        });
    });

    describe('isEmptyReport', () => {
        it.each([
            ['all zero, no buckets', emptyReport(), true],
            ['a project bucket', { ...emptyReport(), by_project: [bucket()] }, false],
            ['an agent bucket', { ...emptyReport(), by_agent: [bucket()] }, false],
            ['a month bucket', { ...emptyReport(), by_month: [bucket()] }, false],
            ['a non-zero paid total', { ...emptyReport(), totals: { ...emptyReport().totals, paid: 5 } }, false],
        ] as Array<[string, CommissionReport, boolean]>)('Given %s / Then isEmptyReport is %s', (_n, r, expected) => {
            expect(isEmptyReport(r)).toBe(expected);
        });
    });
});
