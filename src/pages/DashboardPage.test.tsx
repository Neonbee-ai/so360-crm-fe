import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetDashboardStats = vi.fn();
const mockGetCommerceKPIs = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getDashboardStats: (...args: any[]) => mockGetDashboardStats(...args),
    getCommerceKPIs: (...args: any[]) => mockGetCommerceKPIs(...args),
  },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
  useShell: () => ({
    isModuleEnabled: () => false,
    isFeatureHidden: () => false,
  }),
}));

import DashboardPage from './DashboardPage';

const dashboardData = {
  financials: { totalRevenue: 50000, pipelineValue: 100000, avgDealSize: 25000, winRate: 65.5 },
  counts: { leads: 10, deals: 5, tasks: 3, reminders: 1 },
  teamStats: [{
    user: { id: 'u1', full_name: 'Alice', email: 'a@b.com', avatar_url: null, role: 'Sales Rep' },
    revenue: 50000, dealCount: 2, activeLeads: 5, activityCount: 10, conversionRate: 40.0,
  }],
  monthlyRevenue: Array(12).fill(0),
  chartLabels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  reminders: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDashboardStats.mockResolvedValue(dashboardData);
  mockGetCommerceKPIs.mockResolvedValue({ revenue: 0, orderCount: 0, aov: 0, repeatPurchaseRate: 0, refundRate: 0, orderChartData: { labels: [], values: [] } });
});

describe('Given DashboardPage', () => {
  it('When action / Then shows loading state initially', () => {
    mockGetDashboardStats.mockReturnValue(new Promise(() => {})); // never resolves
    render(<DashboardPage />);
    expect(screen.getByText('Loading insights...')).toBeInTheDocument();
  });

  it('When action / Then renders executive overview after data loads', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Executive Overview')).toBeInTheDocument();
    });
  });

  it('When action / Then displays financial KPIs', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('65.5%')).toBeInTheDocument();
    });
  });

  it('When action / Then shows no active reminders message', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('No active reminders')).toBeInTheDocument();
    });
  });

  it('When action / Then renders team stats', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    });
  });
});
