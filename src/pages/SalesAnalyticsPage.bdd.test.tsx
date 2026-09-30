import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Feature: RE §30 sales reports (`submodule:crm:re_reports`) with per-section
 * CSV / Excel / PDF export (§48, `deals.export`).
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

import SalesAnalyticsPage, { buildSections, isEmptyAnalytics } from './SalesAnalyticsPage';
import { normalizeSalesAnalytics } from '../services/salesAnalyticsService';

const data = normalizeSalesAnalytics({
    period: 'month',
    totals: { bookings: 2, booking_value: 3000, avg_deal_value: 1500, leads: 10, converted_leads: 4, lost_deals: 1, lost_value: 500 },
    by_agent: [{ agent_id: 'u1', agent_name: 'Asha', deals: 2, sale_value: 3000 }],
    by_project: [{ project_id: 'p1', project_name: 'Marina Heights', deals: 2, sale_value: 3000 }],
    by_developer: [{ developer_id: 'dev1', developer_name: 'Emaar', deals: 2, sale_value: 3000 }],
    by_period: [{ period: '2026-09', deals: 2, sale_value: 3000 }],
    by_source: [{ source: 'Website', campaign: 'Launch', leads: 10, converted: 4, won_deals: 2, won_value: 3000 }],
    reservations: { active: 1, committed: 2, released: 3, total: 6 },
    lost_reasons: [{ key: 'price', label: 'Price', count: 1, lost_value: 500 }],
    agent_performance: [{ person_id: 'pp1', name: 'Asha', leads: 10, calls: 7, converted: 4, deals_won: 2, won_value: 3000, conversion_rate: 40 }],
});
const empty = normalizeSalesAnalytics({});

const renderPage = () => render(<MemoryRouter><SalesAnalyticsPage /></MemoryRouter>);

beforeEach(() => {
    vi.clearAllMocks();
    svc.get.mockReset();
    svc.exportSection.mockReset();
    svc.exportSection.mockResolvedValue(undefined);
    crm.getProductCategories.mockResolvedValue([{ id: 'p1', name: 'Marina Heights' }]);
    crm.getUsers.mockResolvedValue([{ id: 'u1', full_name: 'Asha', email: 'a@x' }]);
    bridge.value = { permissionsLoaded: true, hasPermission: () => true, isFeatureEnabled: () => true };
});

describe('Feature: Sales reports page', () => {
    describe('Given the report is loading', () => {
        it('When the page opens / Then a loading status shows and the monthly report is requested with no filters', () => {
            svc.get.mockReturnValue(new Promise(() => {}));
            renderPage();
            expect(screen.getByRole('status')).toHaveTextContent('Loading sales reports…');
            expect(svc.get).toHaveBeenCalledWith({}, 'month');
        });
    });

    describe('Given the report has data', () => {
        it('When rendered / Then totals and every section table show', async () => {
            svc.get.mockResolvedValue(data);
            renderPage();
            expect(await screen.findByTestId('sa-total-bookings')).toHaveTextContent('2');
            expect(screen.getByTestId('sa-total-booking_value')).toHaveTextContent('AED 3000');
            expect(screen.getByTestId('sa-total-lost_value')).toHaveTextContent('AED 500');
            for (const s of ['by_agent', 'by_project', 'by_developer', 'by_period', 'by_source', 'lost_reasons', 'reservations', 'agent_performance']) {
                expect(screen.getByTestId(`sa-section-${s}`)).toBeInTheDocument();
            }
            const perf = within(screen.getByRole('table', { name: 'Agent performance' }));
            expect(perf.getByText('40%')).toBeInTheDocument();
            expect(perf.getByText('7')).toBeInTheDocument();
            expect(within(screen.getByRole('table', { name: 'Lost deals by reason' })).getByText('Price')).toBeInTheDocument();
        });

        it('When developers appear in the data / Then they become a Developer filter option', async () => {
            svc.get.mockResolvedValue(data);
            renderPage();
            const dev = await screen.findByLabelText('Developer');
            fireEvent.change(dev, { target: { value: 'dev1' } });
            await waitFor(() => expect(svc.get).toHaveBeenLastCalledWith({ developer_id: 'dev1' }, 'month'));
        });

        it('When the period changes / Then the report is re-requested for that period', async () => {
            svc.get.mockResolvedValue(data);
            renderPage();
            await screen.findByTestId('sa-total-bookings');
            fireEvent.change(screen.getByLabelText('Report period'), { target: { value: 'quarter' } });
            await waitFor(() => expect(svc.get).toHaveBeenLastCalledWith({}, 'quarter'));
        });
    });

    describe('Given the user may export', () => {
        it('When a section export is clicked / Then that section is exported with the current filters, period and format', async () => {
            svc.get.mockResolvedValue(data);
            renderPage();
            await screen.findByTestId('sa-total-bookings');
            fireEvent.click(screen.getByRole('button', { name: 'Export Sales by project as Excel' }));
            await waitFor(() => expect(svc.exportSection).toHaveBeenCalledWith({}, 'month', 'by_project', 'xlsx'));
        });
    });

    describe('Given the user lacks deals.export', () => {
        it('When rendered / Then no export buttons are offered', async () => {
            bridge.value.hasPermission = (p: string) => p !== 'deals.export';
            svc.get.mockResolvedValue(data);
            renderPage();
            await screen.findByTestId('sa-total-bookings');
            expect(screen.queryByRole('group', { name: /^Export / })).toBeNull();
        });
    });

    describe('Given the server refuses access', () => {
        it('When a 403 comes back / Then a no-access message shows instead of the report', async () => {
            svc.get.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
            renderPage();
            expect(await screen.findByTestId('sales-analytics-forbidden')).toBeInTheDocument();
            expect(screen.queryByTestId('sa-total-bookings')).toBeNull();
        });
    });

    describe('Given the report fails to load', () => {
        it('When a 5xx comes back / Then a generic error with Retry shows, and Retry reloads', async () => {
            svc.get.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 })).mockResolvedValueOnce(data);
            renderPage();
            const alert = await screen.findByRole('alert');
            expect(alert).toHaveTextContent('Could not load the sales reports.');
            fireEvent.click(within(alert).getByRole('button', { name: /Retry/ }));
            expect(await screen.findByTestId('sa-total-bookings')).toBeInTheDocument();
            expect(svc.get).toHaveBeenCalledTimes(2);
        });
    });

    describe('Given there is no activity', () => {
        it('When rendered / Then the empty state shows', async () => {
            svc.get.mockResolvedValue(empty);
            renderPage();
            expect(await screen.findByTestId('sales-analytics-empty')).toBeInTheDocument();
        });
    });

    describe('Given the report has data but one section is empty', () => {
        it('When rendered / Then that section says there is nothing to show', async () => {
            svc.get.mockResolvedValue({ ...data, by_project: [] });
            renderPage();
            const section = await screen.findByTestId('sa-section-by_project');
            expect(within(section).getByText('Nothing to show.')).toBeInTheDocument();
            expect(within(section).queryByRole('table')).toBeNull();
        });
    });

    describe('Given the page unmounts mid-request', () => {
        it('When the report resolves late / Then nothing is rendered or thrown', async () => {
            let resolve: (v: unknown) => void = () => {};
            svc.get.mockReturnValue(new Promise((r) => { resolve = r; }));
            const { unmount } = renderPage();
            unmount();
            resolve(data);
            await Promise.resolve();
            expect(screen.queryByTestId('sa-section-by_agent')).toBeNull();
        });

        it('When the report fails late / Then no error is shown or thrown', async () => {
            let reject: (e: unknown) => void = () => {};
            svc.get.mockReturnValue(new Promise((_r, j) => { reject = j; }));
            const { unmount } = renderPage();
            unmount();
            reject(Object.assign(new Error('boom'), { status: 500 }));
            await Promise.resolve();
            expect(screen.queryByRole('alert')).toBeNull();
        });
    });

    describe('Given an invalid date range', () => {
        it('When From is after To / Then the range error shows and no new request is made', async () => {
            svc.get.mockResolvedValue(data);
            renderPage();
            await screen.findByTestId('sa-total-bookings');
            fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-06-01' } });
            await waitFor(() => expect(svc.get).toHaveBeenLastCalledWith({ to: '2026-06-01' }, 'month'));
            const calls = svc.get.mock.calls.length;
            fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-06-10' } });
            expect(await screen.findByRole('alert')).toHaveTextContent('The start date must be on or before the end date.');
            expect(svc.get).toHaveBeenCalledTimes(calls);
            expect(screen.queryByTestId('sa-total-bookings')).toBeNull();
        });
    });
});

describe('Feature: sales report view model', () => {
    describe('Given analytics data', () => {
        it('then all 8 sections are built with titles and money formatting', () => {
            const s = buildSections(data, (n) => `$${n}`);
            expect(s.map((x) => x.title)).toEqual([
                'Sales by agent', 'Sales by project', 'Sales by developer', 'Sales by month',
                'Leads & sales by source and campaign', 'Lost deals by reason', 'Reservations', 'Agent performance',
            ]);
            expect(s[0].rows[0].cells.map((c) => c.value)).toEqual(['Asha', 2, '$3000']);
            expect(s[6].rows.map((r) => r.cells[0].value)).toEqual(['Active', 'Committed (booked)', 'Released', 'Total']);
        });

        it('then rows without a key still get a unique key', () => {
            const s = buildSections(normalizeSalesAnalytics({ by_agent: [{}, {}] }), String);
            expect(s[0].rows.map((r) => r.key)).toEqual(['by_agent-0', 'by_agent-1']);
        });
    });

    describe('Given lost reasons and agents without an id', () => {
        it('then their rows fall back to positional keys', () => {
            const s = buildSections(normalizeSalesAnalytics({ lost_reasons: [{ label: 'Price' }], agent_performance: [{ name: 'Nadia' }] }), String);
            expect(s.find((x) => x.section === 'lost_reasons')!.rows[0].key).toBe('lost-0');
            expect(s.find((x) => x.section === 'agent_performance')!.rows[0].key).toBe('agent-0');
        });
    });

    describe('Given emptiness checks', () => {
        it('then an all-zero report is empty and any activity is not', () => {
            expect(isEmptyAnalytics(empty)).toBe(true);
            expect(isEmptyAnalytics(data)).toBe(false);
            expect(isEmptyAnalytics({ ...empty, reservations: { ...empty.reservations, total: 1 } })).toBe(false);
        });
    });
});
