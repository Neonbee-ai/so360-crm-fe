/**
 * Extra coverage tests for DashboardPage — targeting commerce KPIs,
 * period selector, team stats display, and module-gated rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

const mockIsModuleEnabled = vi.fn();
const mockIsFeatureHidden = vi.fn();

vi.mock('@so360/shell-context', () => ({
  useBusinessSettings: () => ({ settings: { base_currency: 'USD', document_language: 'en-US' } }),
  useShell: () => ({
    isModuleEnabled: mockIsModuleEnabled,
    isFeatureHidden: mockIsFeatureHidden,
  }),
}));

import DashboardPage from './DashboardPage';

const baseDashboard = {
  financials: { totalRevenue: 120000, pipelineValue: 250000, avgDealSize: 40000, winRate: 72.5 },
  counts: { leads: 25, deals: 12, tasks: 8, reminders: 3 },
  teamStats: [
    { user: { id: 'u1', full_name: 'Bob', email: 'b@c.com', avatar_url: null, role: 'AE' }, revenue: 80000, dealCount: 5, activeLeads: 12, activityCount: 20, conversionRate: 55.0 },
    { user: { id: 'u2', full_name: 'Carol', email: 'c@d.com', avatar_url: null, role: 'BDR' }, revenue: 40000, dealCount: 7, activeLeads: 13, activityCount: 30, conversionRate: 45.0 },
  ],
  monthlyRevenue: Array(12).fill(0),
  chartLabels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  reminders: [
    { id: 'r1', title: 'Call John', due_date: '2024-06-15', lead_id: 'l1', deal_id: null }
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsModuleEnabled.mockReturnValue(false);
  mockIsFeatureHidden.mockReturnValue(false);
  mockGetDashboardStats.mockResolvedValue(baseDashboard);
  mockGetCommerceKPIs.mockResolvedValue({
    revenue: 0, orderCount: 0, aov: 0, repeatPurchaseRate: 0, refundRate: 0,
    orderChartData: { labels: [], values: [] },
  });
});

describe('DashboardPage — period selectors', () => {
  it('shows period filter buttons (Yearly, Quarterly, Monthly)', async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText('Executive Overview'));
    expect(screen.getByText('Yearly')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('clicking Quarterly calls getDashboardStats with period=quarterly', async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText('Executive Overview'));
    fireEvent.click(screen.getByText('Quarterly'));
    await waitFor(() => {
      expect(mockGetDashboardStats).toHaveBeenCalledWith(expect.objectContaining({ period: 'quarterly' }));
    });
  });

  it('clicking Monthly calls getDashboardStats with period=monthly', async () => {
    render(<DashboardPage />);
    await waitFor(() => screen.getByText('Executive Overview'));
    fireEvent.click(screen.getByText('Monthly'));
    await waitFor(() => {
      expect(mockGetDashboardStats).toHaveBeenCalledWith(expect.objectContaining({ period: 'monthly' }));
    });
  });
});

describe('DashboardPage — active reminders', () => {
  it('shows reminder title when reminders exist', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Call John')).toBeInTheDocument();
    });
  });

  it('shows no reminders message when list is empty', async () => {
    mockGetDashboardStats.mockResolvedValue({ ...baseDashboard, reminders: [] });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/no active reminders/i)).toBeInTheDocument();
    });
  });
});

describe('DashboardPage — team stats', () => {
  it('shows both team members', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Carol').length).toBeGreaterThan(0);
    });
  });

  it('shows revenue figures for team', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/80,000|80000/).length).toBeGreaterThan(0);
    });
  });
});

describe('DashboardPage — revenue KPIs', () => {
  it('shows pipeline value', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/250,000|250000/).length).toBeGreaterThan(0);
    });
  });

  it('shows win rate percentage', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('72.5%')).toBeInTheDocument();
    });
  });

  it('shows total revenue', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/120,000|120000/).length).toBeGreaterThan(0);
    });
  });
});

describe('DashboardPage — counts section', () => {
  it('shows deals count in pipeline section', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/12 active deals/i)).toBeInTheDocument();
    });
  });

  it('shows avg deal size KPI', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      // avgDealSize = 40000 appears in financials
      expect(screen.getAllByText(/40,000|40000/).length).toBeGreaterThan(0);
    });
  });
});

describe('DashboardPage — dailystore module enabled', () => {
  it('calls getCommerceKPIs when dailystore module is enabled', async () => {
    mockIsModuleEnabled.mockImplementation((m: string) => m === 'dailystore');
    render(<DashboardPage />);
    await waitFor(() => {
      expect(mockGetCommerceKPIs).toHaveBeenCalled();
    });
  });

  it('does not call getCommerceKPIs when dailystore is disabled', async () => {
    mockIsModuleEnabled.mockReturnValue(false);
    render(<DashboardPage />);
    await waitFor(() => screen.getByText('Executive Overview'));
    expect(mockGetCommerceKPIs).not.toHaveBeenCalled();
  });

  it('shows commerce KPIs section when dailystore is enabled and data loads', async () => {
    mockIsModuleEnabled.mockImplementation((m: string) => m === 'dailystore');
    mockGetCommerceKPIs.mockResolvedValue({
      revenue: 55000, orderCount: 120, aov: 458, repeatPurchaseRate: 32, refundRate: 2.5,
      orderChartData: { labels: ['Jan', 'Feb'], values: [100, 200] },
    });
    render(<DashboardPage />);
    await waitFor(() => {
      // Commerce section heading or values should appear
      expect(screen.getAllByText(/55,000|55000|120|458/).length).toBeGreaterThan(0);
    });
  });
});

describe('DashboardPage — error handling', () => {
  it('shows loading spinner on initial load', () => {
    // getDashboardStats never resolves — stays in loading state
    mockGetDashboardStats.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText('Loading insights...')).toBeInTheDocument();
  });
});
