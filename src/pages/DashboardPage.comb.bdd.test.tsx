import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import React from 'react';
import userEvent from '@testing-library/user-event';

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
vi.mock('@so360/shell-context', async (importOriginal) => ({ ...(await importOriginal<any>()),
    useBusinessSettings: () => ({ settings: { base_currency: 'AED', document_language: 'en-US' } }),
    useShell: () => ({ isModuleEnabled: () => false, isFeatureHidden: () => false }),
    useShellBridge: () => ({ effectiveFlagsLoaded: flags.loaded, isFeatureEnabled: (k: string) => flags.on.has(k) }),
    useActivity: () => ({ recordActivity: async () => {} }),
}));

// The shared DS stub drops `leadingIcon`; the Customize icon moved there (r17), so render it here.
vi.mock('@so360/design-system', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        Button: ({ leadingIcon, children, ...rest }: any) => actual.Button({ ...rest, children: <>{leadingIcon}{children}</> }),
    };
});

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

beforeEach(() => {
    vi.clearAllMocks();
    flags.on.clear();
    flags.loaded = true;
    mockGetDashboardStats.mockResolvedValue(stats);
    grid.get.mockResolvedValue(null);
    grid.save.mockResolvedValue(undefined);
    grid.reset.mockResolvedValue(undefined);
});

const customizeBtn = () => screen.getByRole('button', { name: 'Customize dashboard' });

describe('Feature: Dashboard Customize button (Comb Button)', () => {
    describe('Scenario: render', () => {
        it('Given the flag is on When rendered Then Customize is a secondary Comb Button with aria-label and text', async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            const btn = customizeBtn();
            expect(btn).toHaveAttribute('data-comb', 'button');
            expect(btn).toHaveAttribute('data-variant', 'secondary');
            expect(btn).toHaveAttribute('type', 'button');
            expect(btn).toHaveTextContent('Customize');
            // Icon is passed as the Button's leadingIcon.
            expect(btn.querySelector('svg')).not.toBeNull();
        });
        it('Given the flag is on When rendered Then the button is enabled and the panel is closed', async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            expect(customizeBtn()).not.toBeDisabled();
            expect(screen.queryByRole('dialog', { name: 'Customize Dashboard' })).toBeNull();
        });
    });

    describe('Scenario: flag-hidden variants', () => {
        it('Given the flag is off Then no Customize button', async () => {
            render(<DashboardPage />);
            await ready();
            expect(screen.queryByRole('button', { name: 'Customize dashboard' })).toBeNull();
        });
        it('Given the flag is on but flags not loaded Then no Customize button', async () => {
            flags.on.add(FLAG);
            flags.loaded = false;
            render(<DashboardPage />);
            await ready();
            expect(screen.queryByRole('button', { name: 'Customize dashboard' })).toBeNull();
        });
        it('Given a different flag only Then no Customize button', async () => {
            flags.on.add('submodule:crm:other');
            render(<DashboardPage />);
            await ready();
            expect(screen.queryByRole('button', { name: 'Customize dashboard' })).toBeNull();
        });
    });

    describe('Scenario: interaction', () => {
        it('When clicked Then the Customize Dashboard dialog opens', async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            fireEvent.click(customizeBtn());
            expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument();
        });
        it('When focused and Enter pressed Then the dialog opens', async () => {
            flags.on.add(FLAG);
            const user = userEvent.setup();
            render(<DashboardPage />);
            await ready();
            customizeBtn().focus();
            await user.keyboard('{Enter}');
            expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument();
        });
        it('When focused and Space pressed Then the dialog opens', async () => {
            flags.on.add(FLAG);
            const user = userEvent.setup();
            render(<DashboardPage />);
            await ready();
            customizeBtn().focus();
            await user.keyboard(' ');
            expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument();
        });
        it('When clicked twice Then a single dialog remains', async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            fireEvent.click(customizeBtn());
            fireEvent.click(customizeBtn());
            expect(screen.getAllByRole('dialog', { name: 'Customize Dashboard' })).toHaveLength(1);
        });
        it('Given the dialog is open When its close control is used Then it closes and the button remains', async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            fireEvent.click(customizeBtn());
            screen.getByRole('dialog', { name: 'Customize Dashboard' });
            fireEvent.click(screen.getAllByRole('button').find(b => /close|done/i.test(b.getAttribute('aria-label') || b.textContent || ''))!);
            expect(screen.queryByRole('dialog', { name: 'Customize Dashboard' })).toBeNull();
            expect(customizeBtn()).toBeInTheDocument();
        });
    });

    describe('Scenario: tab order', () => {
        it('Then the Customize button is reachable by Tab', async () => {
            flags.on.add(FLAG);
            const user = userEvent.setup();
            render(<DashboardPage />);
            await ready();
            for (let i = 0; i < 30 && document.activeElement !== customizeBtn(); i++) await user.tab();
            expect(customizeBtn()).toHaveFocus();
        });
    });

    describe('Scenario: error / empty paths', () => {
        it('Given saved-layout fetch rejects When rendered Then the button still works', async () => {
            flags.on.add(FLAG);
            grid.get.mockRejectedValue(new Error('x'));
            render(<DashboardPage />);
            await ready();
            fireEvent.click(customizeBtn());
            expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument();
        });
        it('Given empty stats When the flag is on Then the Customize button is still shown', async () => {
            flags.on.add(FLAG);
            mockGetDashboardStats.mockResolvedValue({ ...stats, teamStats: [], reminders: [] });
            render(<DashboardPage />);
            await ready();
            expect(customizeBtn()).toBeInTheDocument();
        });
    });
    describe('Scenario: Customize panel (Comb Modal, role=dialog)', () => {
        const open = async () => {
            flags.on.add(FLAG);
            render(<DashboardPage />);
            await ready();
            fireEvent.click(customizeBtn());
            return screen.getByRole('dialog', { name: 'Customize Dashboard' });
        };
        it('When opened Then it is a modal dialog titled Customize Dashboard with a Close control and Reset', async () => {
            const panel = await open();
            expect(panel).toHaveAttribute('aria-modal', 'true');
            expect(within(panel).getByRole('heading', { name: 'Customize Dashboard' })).toBeInTheDocument();
            expect(within(panel).getByRole('button', { name: 'Close' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Reset to Default/ })).toBeInTheDocument();
        });
        it('When the X is clicked Then the dialog closes without saving', async () => {
            const panel = await open();
            fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
            expect(screen.queryByRole('dialog', { name: 'Customize Dashboard' })).toBeNull();
            expect(grid.save).not.toHaveBeenCalled();
        });
        it('When Escape is pressed Then the dialog closes', async () => {
            await open();
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(screen.queryByRole('dialog', { name: 'Customize Dashboard' })).toBeNull();
        });
        it('When the overlay is clicked Then the dialog closes', async () => {
            await open();
            fireEvent.click(screen.getByTestId('modal-overlay'));
            expect(screen.queryByRole('dialog', { name: 'Customize Dashboard' })).toBeNull();
        });
        it('When closed and Customize is clicked again Then it re-opens', async () => {
            const panel = await open();
            fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
            fireEvent.click(customizeBtn());
            expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument();
        });
        it('When a widget is hidden Then the layout is saved for the user', async () => {
            const panel = await open();
            fireEvent.click(within(panel).getByRole('button', { name: 'Hide Active reminders' }));
            expect(screen.queryByText('Active Reminders')).toBeNull();
            await waitFor(() => expect(grid.save).toHaveBeenCalledWith(expect.objectContaining({ hidden: ['reminders'] }), 'crm_dashboard_layout'), { timeout: 2000 });
        });
        it('When the first widget row is inspected Then its Move up control is disabled', async () => {
            const panel = await open();
            const ups = within(panel).getAllByRole('button', { name: /^Move .* up$/ });
            expect(ups[0]).toBeDisabled();
            const downs = within(panel).getAllByRole('button', { name: /^Move .* down$/ });
            expect(downs[downs.length - 1]).toBeDisabled();
        });
        it('When Reset to Default is clicked Then the saved layout is cleared', async () => {
            await open();
            fireEvent.click(screen.getByRole('button', { name: /Reset to Default/ }));
            await waitFor(() => expect(grid.reset).toHaveBeenCalledWith('crm_dashboard_layout'));
        });
        it('Given saving rejects When a widget is hidden Then the panel stays usable', async () => {
            grid.save.mockRejectedValue(new Error('save failed'));
            const panel = await open();
            fireEvent.click(within(panel).getByRole('button', { name: 'Hide Active reminders' }));
            await waitFor(() => expect(grid.save).toHaveBeenCalled(), { timeout: 2000 });
            expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument();
            expect(within(panel).getByRole('button', { name: 'Show Active reminders' })).toBeInTheDocument();
        });
        it('Given reset rejects When Reset is clicked Then the panel stays open', async () => {
            grid.reset.mockRejectedValue(new Error('reset failed'));
            await open();
            fireEvent.click(screen.getByRole('button', { name: /Reset to Default/ }));
            await waitFor(() => expect(grid.reset).toHaveBeenCalled());
            expect(screen.getByRole('dialog', { name: 'Customize Dashboard' })).toBeInTheDocument();
        });
    });
});
