import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import userEvent from '@testing-library/user-event';

/**
 * Feature: Comb adoption (95ffb66) — the error-state Retry is a Comb Button.
 */
const report = vi.hoisted(() => ({ listSales: vi.fn(), commissionReport: vi.fn() }));
const crm = vi.hoisted(() => ({ getProductCategories: vi.fn(), getUsers: vi.fn() }));

vi.mock('../services/salesReportService', async (importActual) => {
    const actual = await importActual<typeof import('../services/salesReportService')>();
    return { ...actual, salesReportService: report };
});
vi.mock('../services/crmService', () => ({ crmService: crm }));
vi.mock('@so360/shell-context', async (importActual) => ({
    ...(await importActual<any>()),
    useShellBridge: () => ({}),
}));
vi.mock('../services/exportService', async (importActual) => ({
    ...(await importActual<any>()),
    exportService: { commission: vi.fn(), sales: vi.fn() },
}));
vi.mock('../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `AED ${v}`, formatDate: (d: string) => d }),
}));

import CommissionReportPage from './CommissionReportPage';

const okReport = () => ({
    totals: { gross: 1, agent: 1, company: 0, pending: 0, approved: 0, payable: 0, paid: 0 },
    by_project: [{ key: 'k', label: 'P', gross: 1, agent: 1, company: 0, count: 1 }], by_agent: [], by_month: [],
});

beforeEach(() => {
    vi.clearAllMocks();
    report.commissionReport.mockReset();
    crm.getProductCategories.mockResolvedValue([]);
    crm.getUsers.mockResolvedValue([]);
});

describe('Feature: Commission report Retry (Comb Button)', () => {
    describe('Scenario: Retry renders as a small secondary Comb Button', () => {
        it('Given the request failed / When the error shows / Then Retry is a named Comb Button of type button', async () => {
            report.commissionReport.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
            render(<CommissionReportPage />);
            await screen.findByRole('alert');
            const retry = screen.getByRole('button', { name: /Retry/ });
            expect(retry).toHaveAttribute('data-comb', 'button');
            expect(retry).toHaveAttribute('data-variant', 'secondary');
            expect(retry).toHaveAttribute('data-size', 'sm');
            expect(retry).toHaveAttribute('type', 'button');
        });
    });

    describe('Scenario: Retry reloads', () => {
        it('Given a failed first load / When Retry is clicked / Then the report is requested again and the error clears', async () => {
            report.commissionReport.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
            report.commissionReport.mockResolvedValueOnce(okReport());
            render(<CommissionReportPage />);
            await screen.findByRole('alert');
            fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
            expect(await screen.findByTestId('cr-total-gross')).toBeInTheDocument();
            expect(report.commissionReport).toHaveBeenCalledTimes(2);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });
    describe('Scenario: Retry failure paths and keyboard', () => {
        const fail = () => Object.assign(new Error('boom'), { status: 500 });
        it('Given Retry fails again / When clicked / Then the error stays and Retry remains available', async () => {
            report.commissionReport.mockRejectedValue(fail());
            render(<CommissionReportPage />);
            await screen.findByRole('alert');
            fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
            await vi.waitFor(() => expect(report.commissionReport).toHaveBeenCalledTimes(2));
            expect(await screen.findByRole('alert')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Retry/ })).toBeEnabled();
        });
        it('Given the error is shown / When Retry is focused and Enter pressed / Then the report reloads', async () => {
            report.commissionReport.mockRejectedValueOnce(fail());
            report.commissionReport.mockResolvedValueOnce(okReport());
            const user = userEvent.setup();
            render(<CommissionReportPage />);
            await screen.findByRole('alert');
            const retry = screen.getByRole('button', { name: /Retry/ });
            retry.focus();
            expect(retry).toHaveFocus();
            await user.keyboard('{Enter}');
            expect(await screen.findByTestId('cr-total-gross')).toBeInTheDocument();
        });
        it('Given the error is shown / When Retry is focused and Space pressed / Then the report reloads', async () => {
            report.commissionReport.mockRejectedValueOnce(fail());
            report.commissionReport.mockResolvedValueOnce(okReport());
            const user = userEvent.setup();
            render(<CommissionReportPage />);
            await screen.findByRole('alert');
            screen.getByRole('button', { name: /Retry/ }).focus();
            await user.keyboard(' ');
            expect(await screen.findByTestId('cr-total-gross')).toBeInTheDocument();
        });
        it('Given the first load succeeded / When the page renders / Then no Retry button is shown', async () => {
            report.commissionReport.mockResolvedValue(okReport());
            render(<CommissionReportPage />);
            await screen.findByTestId('cr-total-gross');
            expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
        });
    });
});
