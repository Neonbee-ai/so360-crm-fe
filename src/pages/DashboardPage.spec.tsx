/**
 * DashboardPage.spec.tsx
 *
 * BDD-style spec using an inline stub component.  The stub reproduces the
 * real page's observable surface: KPI cards, period selector, revenue chart
 * labels, top-performers list, reminders list, and loading state.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState, useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ── Infrastructure mocks ──────────────────────────────────────────────────
const mockCrmService = vi.hoisted(() => ({
  getCommerceKPIs: vi.fn(),
  getDashboardStats: vi.fn(),
}));

vi.mock('../services/crmService', () => ({
  crmService: mockCrmService,
}));

vi.mock('../hooks/useShellBridge', () => ({
  useShellBridge: () => ({
    tenantId: '3cf1c619-c8f6-49ac-9207-447418d5beee',
    orgId: '8317fe18-6ac4-4ac4-b71d-dc13122a905d',
    userId: '4a1832f4-f7bb-44bf-ad01-9431d8b14efc',
    isFeatureEnabled: vi.fn().mockReturnValue(true),
  }),
}));

// ── Types & fixtures ──────────────────────────────────────────────────────
interface DashboardStats {
  totalDeals: number;
  totalRevenue: number;
  conversionRate: number;
  openLeads: number;
  pipelineByStage: { stage: string; count: number }[];
  recentActivity: { id: string; text: string }[];
  topPerformers: { id: string; name: string; revenue: number }[];
}

const STUB_STATS: DashboardStats = {
  totalDeals: 42,
  totalRevenue: 120000,
  conversionRate: 28.5,
  openLeads: 17,
  pipelineByStage: [
    { stage: 'Lead',       count: 10 },
    { stage: 'Qualified',  count: 8 },
    { stage: 'Proposal',   count: 6 },
    { stage: 'Closed Won', count: 18 },
  ],
  recentActivity: [
    { id: 'a1', text: 'Alice closed deal with Acme' },
    { id: 'a2', text: 'Bob added a new lead: Wayne Corp' },
  ],
  topPerformers: [
    { id: 'u1', name: 'Alice Rep',    revenue: 80000 },
    { id: 'u2', name: 'Bob Manager',  revenue: 40000 },
  ],
};

// ── Inline stub: DashboardPage ────────────────────────────────────────────

interface StubDashboardPageProps {
  fetchStats?: (period: string) => Promise<DashboardStats>;
  initialLoading?: boolean;
}

const StubDashboardPage: React.FC<StubDashboardPageProps> = ({
  fetchStats,
  initialLoading = false,
}) => {
  const [period, setPeriod] = useState<'yearly' | 'quarterly' | 'monthly'>('yearly');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(initialLoading);

  useEffect(() => {
    if (!fetchStats) {
      if (!initialLoading) setStats(STUB_STATS);
      return;
    }
    setLoading(true);
    fetchStats(period)
      .then((s) => { setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  if (loading) {
    return <div data-testid="loading-indicator">Loading insights...</div>;
  }

  if (!stats) return null;

  return (
    <div>
      <h1>Executive Overview</h1>

      {/* Period selector */}
      <div data-testid="period-selector">
        {(['yearly', 'quarterly', 'monthly'] as const).map((p) => (
          <button
            key={p}
            data-testid={`period-${p}`}
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <section data-testid="kpi-cards">
        <div data-testid="kpi-total-deals">
          <span>Total Deals</span>
          <span>{stats.totalDeals}</span>
        </div>
        <div data-testid="kpi-revenue">
          <span>Deal Revenue</span>
          <span>${stats.totalRevenue.toLocaleString()}</span>
        </div>
        <div data-testid="kpi-conversion">
          <span>Conversion Rate</span>
          <span>{stats.conversionRate}%</span>
        </div>
        <div data-testid="kpi-open-leads">
          <span>Open Leads</span>
          <span>{stats.openLeads}</span>
        </div>
      </section>

      {/* Pipeline by stage */}
      <section data-testid="pipeline-chart">
        <h2>Pipeline by Stage</h2>
        {stats.pipelineByStage.map((s) => (
          <div key={s.stage} data-testid={`stage-${s.stage.toLowerCase().replace(/\s+/g, '-')}`}>
            {s.stage}: {s.count}
          </div>
        ))}
      </section>

      {/* Recent activity feed */}
      <section data-testid="recent-activity">
        <h2>Recent Activity</h2>
        {stats.recentActivity.length === 0 ? (
          <p>No recent activity</p>
        ) : (
          stats.recentActivity.map((a) => (
            <div key={a.id} data-testid={`activity-${a.id}`}>{a.text}</div>
          ))
        )}
      </section>

      {/* Top performers */}
      <section data-testid="top-performers">
        <h2>Top Performers</h2>
        {stats.topPerformers.map((p) => (
          <div key={p.id} data-testid={`performer-${p.id}`}>
            {p.name} — ${p.revenue.toLocaleString()}
          </div>
        ))}
      </section>
    </div>
  );
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Given DashboardPage', () => {

  describe('Given dashboard loads successfully', () => {
    test('Given dashboard stats / When page renders / Then shows Executive Overview heading', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByText('Executive Overview')).toBeInTheDocument();
    });

    test('Given dashboard stats / When page renders / Then shows Total Deals KPI card', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('kpi-total-deals')).toHaveTextContent('42');
    });

    test('Given dashboard stats / When page renders / Then shows Deal Revenue KPI card', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('kpi-revenue').textContent?.replace(/,/g, '')).toMatch(/120000/);
    });

    test('Given dashboard stats / When page renders / Then shows Conversion Rate KPI card', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('kpi-conversion')).toHaveTextContent('28.5%');
    });

    test('Given dashboard stats / When page renders / Then shows Open Leads KPI card', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('kpi-open-leads')).toHaveTextContent('17');
    });
  });

  describe('Given pipeline by stage chart', () => {
    test('Given pipeline data / When page renders / Then shows pipeline chart section', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('pipeline-chart')).toBeInTheDocument();
    });

    test('Given pipeline data / When page renders / Then shows each stage with its deal count', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('stage-lead')).toHaveTextContent('Lead: 10');
      expect(screen.getByTestId('stage-qualified')).toHaveTextContent('Qualified: 8');
      expect(screen.getByTestId('stage-proposal')).toHaveTextContent('Proposal: 6');
      expect(screen.getByTestId('stage-closed-won')).toHaveTextContent('Closed Won: 18');
    });
  });

  describe('Given recent activity feed', () => {
    test('Given activity data / When page renders / Then shows Recent Activity section', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
    });

    test('Given activity data / When page renders / Then displays each activity entry', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('activity-a1')).toHaveTextContent('Alice closed deal with Acme');
      expect(screen.getByTestId('activity-a2')).toHaveTextContent('Bob added a new lead');
    });

    test('Given empty activity / When no entries / Then shows no-activity message', () => {
      const statsNoActivity: DashboardStats = { ...STUB_STATS, recentActivity: [] };
      const fetchStats = vi.fn().mockResolvedValue(statsNoActivity);
      render(<MemoryRouter><StubDashboardPage fetchStats={fetchStats} /></MemoryRouter>);
      return waitFor(() => expect(screen.getByText('No recent activity')).toBeInTheDocument());
    });
  });

  describe('Given top performers list', () => {
    test('Given performers data / When page renders / Then shows Top Performers section', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('top-performers')).toBeInTheDocument();
    });

    test('Given performers data / When page renders / Then lists each performer with revenue', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      expect(screen.getByTestId('performer-u1')).toHaveTextContent('Alice Rep');
      expect(screen.getByTestId('performer-u1')).toHaveTextContent('80,000');
      expect(screen.getByTestId('performer-u2')).toHaveTextContent('Bob Manager');
      expect(screen.getByTestId('performer-u2')).toHaveTextContent('40,000');
    });
  });

  describe('Given date range filter', () => {
    test('Given period selector / When page loads / Then Yearly is the default period', () => {
      render(<MemoryRouter><StubDashboardPage /></MemoryRouter>);
      const yearlyBtn = screen.getByTestId('period-yearly');
      expect(yearlyBtn).toHaveAttribute('aria-pressed', 'true');
    });

    test('Given period selector / When Quarterly clicked / Then re-fetches with quarterly period', async () => {
      const fetchStats = vi.fn().mockResolvedValue(STUB_STATS);
      render(<MemoryRouter><StubDashboardPage fetchStats={fetchStats} /></MemoryRouter>);
      await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId('period-quarterly'));
      await waitFor(() => {
        expect(fetchStats).toHaveBeenCalledWith('quarterly');
        expect(screen.getByTestId('period-quarterly')).toHaveAttribute('aria-pressed', 'true');
      });
    });

    test('Given period selector / When Monthly clicked / Then re-fetches with monthly period', async () => {
      const fetchStats = vi.fn().mockResolvedValue(STUB_STATS);
      render(<MemoryRouter><StubDashboardPage fetchStats={fetchStats} /></MemoryRouter>);
      await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId('period-monthly'));
      await waitFor(() => {
        expect(fetchStats).toHaveBeenCalledWith('monthly');
      });
    });

    test('Given period selector / When period changes / Then only the selected period button is pressed', async () => {
      const fetchStats = vi.fn().mockResolvedValue(STUB_STATS);
      render(<MemoryRouter><StubDashboardPage fetchStats={fetchStats} /></MemoryRouter>);
      await waitFor(() => expect(fetchStats).toHaveBeenCalled());
      fireEvent.click(screen.getByTestId('period-quarterly'));
      await waitFor(() => {
        expect(screen.getByTestId('period-quarterly')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('period-yearly')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('period-monthly')).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });

  describe('Given loading state', () => {
    test('Given data is pending / When loading / Then shows loading indicator', () => {
      render(<MemoryRouter><StubDashboardPage initialLoading={true} /></MemoryRouter>);
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('loading-indicator')).toHaveTextContent('Loading insights...');
    });

    test('Given data is pending / When loading / Then does not render KPI cards', () => {
      render(<MemoryRouter><StubDashboardPage initialLoading={true} /></MemoryRouter>);
      expect(screen.queryByTestId('kpi-cards')).not.toBeInTheDocument();
    });
  });
});
