import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGetDashboardStats = vi.fn();
const mockGetCommerceKPIs = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getDashboardStats: (...a: any[]) => mockGetDashboardStats(...a),
    getCommerceKPIs: (...a: any[]) => mockGetCommerceKPIs(...a),
  },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
  useShell: () => ({
    isModuleEnabled: () => false,
    isFeatureHidden: () => false,
  }),
  useActivity: () => ({ recordActivity: async () => {} }),

  useQuota: () => ({ quotas: [], isLoading: false, error: null, isExceeded: () => false, getQuota: () => null, getPercentage: () => 0, refresh: async () => {} }),}));

import DashboardPage from './DashboardPage';

const stats = {
  financials: { totalRevenue: 120000, pipelineValue: 250000, avgDealSize: 40000, winRate: 72.3 },
  counts: { leads: 25, deals: 10, tasks: 8, reminders: 2 },
  teamStats: [
    {
      user: { id: 'u1', full_name: 'Alice Rep', email: 'alice@test.com', avatar_url: null, role: 'Sales Rep' },
      revenue: 80000, dealCount: 5, activeLeads: 12, activityCount: 30, conversionRate: 45.0,
    },
    {
      user: { id: 'u2', full_name: 'Bob Manager', email: 'bob@test.com', avatar_url: null, role: 'Manager' },
      revenue: 40000, dealCount: 3, activeLeads: 8, activityCount: 20, conversionRate: 35.0,
    },
  ],
  monthlyRevenue: [5000, 8000, 12000, 10000, 15000, 20000, 18000, 12000, 8000, 5000, 3000, 4000],
  chartLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  reminders: [
    { id: 'r1', title: 'Call Acme', due_date: new Date().toISOString(), description: 'Follow up on proposal', assigned_to: { full_name: 'Alice Rep' } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDashboardStats.mockResolvedValue(stats);
  mockGetCommerceKPIs.mockResolvedValue(null);
});

describe('DashboardPage', () => {
  describe('Given dashboard stats are loaded', () => {
    it('When the page renders / Then shows the executive overview header', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText('Executive Overview')).toBeInTheDocument();
      });
    });

    it('When the page renders / Then shows the Deal Revenue KPI card', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText('Deal Revenue')).toBeInTheDocument();
        expect(screen.getByText('$120,000')).toBeInTheDocument();
      });
    });

    it('When the page renders / Then shows the Pipeline Value KPI card', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText('Pipeline Value')).toBeInTheDocument();
        expect(screen.getByText('$250,000')).toBeInTheDocument();
      });
    });

    it('When the page renders / Then shows the Win Rate KPI card', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText('Win Rate')).toBeInTheDocument();
        expect(screen.getByText('72.3%')).toBeInTheDocument();
      });
    });

    it('When the page renders / Then shows the Avg Deal Size KPI card', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText('Avg Deal Size')).toBeInTheDocument();
        expect(screen.getAllByText('$40,000').length).toBeGreaterThan(0);
      });
    });

    it('When the page renders / Then shows team leaderboard with top performers', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText('Top Performers')).toBeInTheDocument();
        expect(screen.getAllByText('Alice Rep').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Bob Manager').length).toBeGreaterThan(0);
      });
    });

    it('When the page renders / Then shows active reminders', async () => {
      render(<DashboardPage />);
      await waitFor(() => {
        expect(screen.getByText('Active Reminders')).toBeInTheDocument();
        expect(screen.getByText('Call Acme')).toBeInTheDocument();
      });
    });
  });

  describe('Given the period selector', () => {
    it('When Quarterly is clicked / Then re-fetches stats with quarterly period', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText('Executive Overview')).toBeInTheDocument());
      await user.click(screen.getByText('Quarterly'));
      await waitFor(() => {
        const lastCall = mockGetDashboardStats.mock.calls[mockGetDashboardStats.mock.calls.length - 1];
        expect(lastCall[0].period).toBe('quarterly');
      });
    });

    it('When Monthly is clicked / Then re-fetches stats with monthly period', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText('Executive Overview')).toBeInTheDocument());
      await user.click(screen.getByText('Monthly'));
      await waitFor(() => {
        const lastCall = mockGetDashboardStats.mock.calls[mockGetDashboardStats.mock.calls.length - 1];
        expect(lastCall[0].period).toBe('monthly');
      });
    });
  });

  describe('Given dashboard is loading', () => {
    it('When data is pending / Then shows loading spinner', () => {
      mockGetDashboardStats.mockReturnValue(new Promise(() => {}));
      render(<DashboardPage />);
      expect(screen.getByText('Loading insights...')).toBeInTheDocument();
    });
  });
});
