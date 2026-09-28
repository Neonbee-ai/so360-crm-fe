import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const flags = vi.hoisted(() => ({ on: new Set<string>() }));
const mockGetDashboardStats = vi.hoisted(() => vi.fn());
const mockGetWidgets = vi.hoisted(() => vi.fn());

vi.mock('../services/crmService', () => ({
    crmService: {
        getDashboardStats: (...a: any[]) => mockGetDashboardStats(...a),
        getCommerceKPIs: vi.fn().mockResolvedValue(null),
    },
}));
vi.mock('../services/reWidgetsService', async (importActual) => {
    const actual = await importActual<typeof import('../services/reWidgetsService')>();
    return { ...actual, reWidgetsService: { get: (...a: any[]) => mockGetWidgets(...a) } };
});
vi.mock('react-router-dom', () => ({
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
    useNavigate: () => vi.fn(),
}));
vi.mock('@so360/shell-context', () => ({
    useBusinessSettings: () => ({ settings: { base_currency: 'AED', document_language: 'en-US' } }),
    useShell: () => ({ isModuleEnabled: () => false, isFeatureHidden: () => false }),
    useShellBridge: () => ({ effectiveFlagsLoaded: true, isFeatureEnabled: (k: string) => flags.on.has(k) }),
    useActivity: () => ({ recordActivity: async () => {} }),
}));

import DashboardPage from './DashboardPage';
import { normalizeREWidgets } from '../services/reWidgetsService';

const stats = {
    financials: { totalRevenue: 1000, pipelineValue: 2000, avgDealSize: 500, winRate: 50 },
    counts: { leads: 1, deals: 1, tasks: 0, reminders: 0 },
    teamStats: [],
    monthlyRevenue: Array(12).fill(0),
    chartLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    reminders: [],
};

beforeEach(() => {
    vi.clearAllMocks();
    flags.on.clear();
    mockGetDashboardStats.mockResolvedValue(stats);
    mockGetWidgets.mockResolvedValue(normalizeREWidgets({
        inventory_by_project: [{ project: 'Marina', available: 84, held: 12, sold: 24 }],
    }));
});

describe('Given the CRM dashboard', () => {
    describe('When the tenant does not have RE widgets', () => {
        it('Then the dashboard is unchanged and no widget request is made', async () => {
            render(<DashboardPage />);
            await waitFor(() => expect(screen.getByText('Executive Overview')).toBeInTheDocument());
            expect(screen.queryByTestId('re-widgets')).not.toBeInTheDocument();
            expect(mockGetWidgets).not.toHaveBeenCalled();
        });
    });

    describe('When the tenant has RE widgets', () => {
        it('Then the widgets show above Active Reminders', async () => {
            flags.on.add('submodule:crm:re_widgets');
            render(<DashboardPage />);
            const widgets = await screen.findByTestId('re-widgets');
            const reminders = screen.getByText('Active Reminders');
            expect(widgets.compareDocumentPosition(reminders) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it('Then a failing widget request leaves the rest of the dashboard intact', async () => {
            flags.on.add('submodule:crm:re_widgets');
            mockGetWidgets.mockRejectedValue(new Error('500'));
            render(<DashboardPage />);
            await waitFor(() => expect(mockGetWidgets).toHaveBeenCalled());
            expect(screen.getByText('Executive Overview')).toBeInTheDocument();
            expect(screen.queryByTestId('re-widgets')).not.toBeInTheDocument();
        });
    });
});
