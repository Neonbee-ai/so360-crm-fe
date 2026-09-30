import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';

/**
 * Feature: customizable CRM dashboard (RE §31, `submodule:crm:dashboard_customize`).
 * Users choose, reorder and hide widgets; the layout is saved per user in the
 * existing grid-prefs store under `crm_dashboard_layout`.
 */
const flags = vi.hoisted(() => ({ on: new Set<string>(), loaded: true }));
const grid = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), reset: vi.fn() }));
const mockGetDashboardStats = vi.hoisted(() => vi.fn());

vi.mock('../services/crmService', () => ({
    crmService: {
        getDashboardStats: (...a: any[]) => mockGetDashboardStats(...a),
        getCommerceKPIs: vi.fn().mockResolvedValue(null),
        gridColumns: grid,
    },
}));
vi.mock('../services/reWidgetsService', async (importActual) => {
    const actual = await importActual<typeof import('../services/reWidgetsService')>();
    return { ...actual, reWidgetsService: { get: vi.fn().mockResolvedValue(actual.normalizeREWidgets({})) } };
});
vi.mock('react-router-dom', () => ({
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => vi.fn(),
}));
vi.mock('@so360/shell-context', () => ({
    useBusinessSettings: () => ({ settings: { base_currency: 'AED', document_language: 'en-US' } }),
    useShell: () => ({ isModuleEnabled: () => false, isFeatureHidden: () => false }),
    useShellBridge: () => ({ effectiveFlagsLoaded: flags.loaded, isFeatureEnabled: (k: string) => flags.on.has(k) }),
    useActivity: () => ({ recordActivity: async () => {} }),
}));

import DashboardPage from './DashboardPage';

const FLAG = 'submodule:crm:dashboard_customize';
const stats = {
    financials: { totalRevenue: 1000, pipelineValue: 2000, avgDealSize: 500, winRate: 50 },
    counts: { leads: 1, deals: 1, tasks: 0, reminders: 0 },
    teamStats: [],
    monthlyRevenue: Array(12).fill(0),
    chartLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    reminders: [],
};

const ready = () => waitFor(() => expect(screen.getByText('Revenue Performance')).toBeInTheDocument());
const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => {
    vi.clearAllMocks();
    flags.on.clear();
    flags.loaded = true;
    mockGetDashboardStats.mockResolvedValue(stats);
    grid.get.mockResolvedValue(null);
    grid.save.mockResolvedValue(undefined);
    grid.reset.mockResolvedValue(undefined);
});

describe('Given the CRM dashboard', () => {
    describe('When the customize flag is off', () => {
        it('Then there is no Customize button, no layout is fetched and the default order is kept', async () => {
            render(<DashboardPage />);
            await ready();
            expect(screen.queryByRole('button', { name: 'Customize dashboard' })).toBeNull();
            expect(grid.get).not.toHaveBeenCalled();
            expect(before(screen.getByText('Active Reminders'), screen.getByText('Revenue Performance'))).toBe(true);
        });
    });

    describe('When the flag is on but effective flags have not loaded', () => {
        it('Then customization stays off (fail closed)', async () => {
            flags.on.add(FLAG);
            flags.loaded = false;
            render(<DashboardPage />);
            await ready();
            expect(screen.queryByRole('button', { name: 'Customize dashboard' })).toBeNull();
            expect(grid.get).not.toHaveBeenCalled();
        });
    });

    describe('When the user has a saved layout', () => {
        it('Then it is loaded for the dashboard entity and applied (order and hidden widgets)', async () => {
            flags.on.add(FLAG);
            grid.get.mockResolvedValue({ prefs: { order: ['revenue', 'reminders'], hidden: ['kpis'] } });
            render(<DashboardPage />);
            await ready();
            await waitFor(() => expect(before(screen.getByText('Revenue Performance'), screen.getByText('Active Reminders'))).toBe(true));
            expect(grid.get).toHaveBeenCalledWith('crm_dashboard_layout');
            expect(screen.queryByText('Deal Revenue')).toBeNull();
        });
    });

    describe('When the user customizes the dashboard', () => {
        it('Then hiding a widget removes it and the change is saved for this user', async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            fireEvent.click(screen.getByRole('button', { name: 'Customize dashboard' }));
            const panel = screen.getByRole('dialog', { name: 'Customize Dashboard' });
            fireEvent.click(within(panel).getByRole('button', { name: 'Hide Active reminders' }));
            expect(screen.queryByText('Active Reminders')).toBeNull();
            expect(within(panel).getByRole('button', { name: 'Show Active reminders' })).toHaveAttribute('aria-pressed', 'false');
            await waitFor(() => expect(grid.save).toHaveBeenCalledWith(
                expect.objectContaining({ hidden: ['reminders'] }),
                'crm_dashboard_layout',
            ), { timeout: 2000 });
        });

        it('Then moving a widget reorders the dashboard', async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            fireEvent.click(screen.getByRole('button', { name: 'Customize dashboard' }));
            fireEvent.click(screen.getByRole('button', { name: 'Move Revenue & leaderboard up' }));
            expect(before(screen.getByText('Revenue Performance'), screen.getByText('Active Reminders'))).toBe(true);
        });

        it('Then Reset restores the default layout and clears the saved one', async () => {
            flags.on.add(FLAG);
            grid.get.mockResolvedValue({ prefs: { order: [], hidden: ['reminders'] } });
            render(<DashboardPage />);
            await ready();
            await waitFor(() => expect(screen.queryByText('Active Reminders')).toBeNull());
            fireEvent.click(screen.getByRole('button', { name: 'Customize dashboard' }));
            fireEvent.click(screen.getByRole('button', { name: /Reset to Default/ }));
            expect(await screen.findByText('Active Reminders')).toBeInTheDocument();
            expect(grid.reset).toHaveBeenCalledWith('crm_dashboard_layout');
        });

        it('Then closing the panel hides it', async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            fireEvent.click(screen.getByRole('button', { name: 'Customize dashboard' }));
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(screen.queryByRole('dialog', { name: 'Customize Dashboard' })).toBeNull();
        });
    });

    describe('When the layout store fails', () => {
        it('Then the dashboard renders with the default layout', async () => {
            flags.on.add(FLAG);
            grid.get.mockRejectedValue(new Error('500'));
            render(<DashboardPage />);
            await ready();
            expect(screen.getByText('Active Reminders')).toBeInTheDocument();
            expect(screen.getByText('Revenue Performance')).toBeInTheDocument();
        });
    });
});
