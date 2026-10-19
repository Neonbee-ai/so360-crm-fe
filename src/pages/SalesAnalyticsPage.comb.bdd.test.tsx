import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

/**
 * Feature: Comb adoption (95ffb66) — the error-state Retry is a Comb Button.
 */
const svc = vi.hoisted(() => ({ get: vi.fn(), exportSection: vi.fn() }));
const crm = vi.hoisted(() => ({ getProductCategories: vi.fn(), getUsers: vi.fn() }));
const bridge = vi.hoisted(() => ({ value: {} as any }));

vi.mock('../services/salesAnalyticsService', async (importActual) => {
    const actual = await importActual<typeof import('../services/salesAnalyticsService')>();
    return { ...actual, salesAnalyticsService: svc };
});
vi.mock('../services/crmService', () => ({ crmService: crm }));
vi.mock('@so360/shell-context', () => ({ useShellBridge: () => bridge.value }));
vi.mock('../utils/formatters', () => ({
    useCRMFormatters: () => ({ formatCurrency: (v: number) => `AED ${v}` }),
}));

import SalesAnalyticsPage from './SalesAnalyticsPage';
import { normalizeSalesAnalytics } from '../services/salesAnalyticsService';

const data = normalizeSalesAnalytics({
    period: 'month',
    totals: { bookings: 2, booking_value: 3000, avg_deal_value: 1500, leads: 10, converted_leads: 4, lost_deals: 1, lost_value: 500 },
    by_agent: [{ agent_id: 'u1', agent_name: 'Asha', deals: 2, sale_value: 3000 }],
});

const renderPage = () => render(<MemoryRouter><SalesAnalyticsPage /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
    svc.get.mockReset();
    crm.getProductCategories.mockResolvedValue([]);
    crm.getUsers.mockResolvedValue([]);
    bridge.value = { permissionsLoaded: true, hasPermission: () => true, isFeatureEnabled: () => true };
});

describe('Feature: Sales reports Retry (Comb Button)', () => {
    describe('Scenario: Retry renders as a small secondary Comb Button', () => {
        it('Given the report failed / When the error shows / Then Retry is a named Comb Button of type button', async () => {
            svc.get.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
            renderPage();
            const retry = within(await screen.findByRole('alert')).getByRole('button', { name: /Retry/ });
            expect(retry).toHaveAttribute('data-comb', 'button');
            expect(retry).toHaveAttribute('data-variant', 'secondary');
            expect(retry).toHaveAttribute('data-size', 'sm');
            expect(retry).toHaveAttribute('type', 'button');
        });
    });

    describe('Scenario: Retry reloads', () => {
        it('Given a failed first load / When Retry is clicked / Then the report is requested again and the error clears', async () => {
            svc.get.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 })).mockResolvedValueOnce(data);
            renderPage();
            fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: /Retry/ }));
            expect(await screen.findByTestId('sa-total-bookings')).toBeInTheDocument();
            expect(svc.get).toHaveBeenCalledTimes(2);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });
    describe('Scenario: Retry failure paths and keyboard', () => {
        const fail = () => Object.assign(new Error('boom'), { status: 500 });
        const retryBtn = async () => within(await screen.findByRole('alert')).getByRole('button', { name: /Retry/ });
        it('Given Retry fails again / When clicked / Then the error stays and Retry remains enabled', async () => {
            svc.get.mockRejectedValue(fail());
            renderPage();
            fireEvent.click(await retryBtn());
            await vi.waitFor(() => expect(svc.get).toHaveBeenCalledTimes(2));
            expect(await retryBtn()).toBeEnabled();
        });
        it('Given the error is shown / When Retry is focused and Enter pressed / Then the report reloads', async () => {
            svc.get.mockRejectedValueOnce(fail()).mockResolvedValueOnce(data);
            const user = userEvent.setup();
            renderPage();
            const retry = await retryBtn();
            retry.focus();
            expect(retry).toHaveFocus();
            await user.keyboard('{Enter}');
            expect(await screen.findByTestId('sa-total-bookings')).toBeInTheDocument();
        });
        it('Given the error is shown / When Retry is focused and Space pressed / Then the report reloads', async () => {
            svc.get.mockRejectedValueOnce(fail()).mockResolvedValueOnce(data);
            const user = userEvent.setup();
            renderPage();
            (await retryBtn()).focus();
            await user.keyboard(' ');
            expect(await screen.findByTestId('sa-total-bookings')).toBeInTheDocument();
        });
        it('Given the load succeeded / When the page renders / Then no Retry button is shown', async () => {
            svc.get.mockResolvedValue(data);
            renderPage();
            await screen.findByTestId('sa-total-bookings');
            expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
        });
    });
});
