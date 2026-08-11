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


// The shared @so360/formatters stub echoes its input and ignores options, which
// would mask the very bug under test (a card that renders no real clock reading).
// Use the genuine Intl-backed formatter here, pinned to UTC/en-US.
vi.mock('../utils/formatters', () => {
  // Mirrors @so360/formatters parseToUtcDate: a stored timestamp with no offset
  // is the UTC wall clock, not the browser's.
  const toDate = (v: any) => {
    const s = String(v).trim();
    const hasTime = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s);
    const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
    return hasTime && !hasTz ? new Date(s.replace(' ', 'T') + 'Z') : new Date(s);
  };
  return {
  useCRMFormatters: () => ({
    formatDate: (d: any, options: any = { year: 'numeric', month: 'short', day: 'numeric' }) =>
      d ? new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(toDate(d)) : '-',
    formatDateTime: (d: any) =>
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC',
      }).format(toDate(d)),
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (n: number) => String(n),
    formatPercentage: (n: number) => `${n}%`,
  }),
  useCRMCurrencySymbol: () => '$',
  };
});

import DashboardPage, { reminderState } from './DashboardPage';

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

    it('When Weekly is clicked / Then re-fetches stats with weekly period', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText('Executive Overview')).toBeInTheDocument());
      await user.click(screen.getByText('Weekly'));
      await waitFor(() => {
        const lastCall = mockGetDashboardStats.mock.calls[mockGetDashboardStats.mock.calls.length - 1];
        expect(lastCall[0].period).toBe('weekly');
        expect(lastCall[0].week).toBeGreaterThan(0);
      });
    });

    it('When Weekly is clicked / Then the Weekly button becomes active', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText('Executive Overview')).toBeInTheDocument());
      await user.click(screen.getByText('Weekly'));
      await waitFor(() => {
        expect(screen.getByText('Weekly')).toBeInTheDocument();
      });
    });

    it('When Weekly is selected / Then subtitle shows week number and date range', async () => {
      const user = userEvent.setup();
      mockGetDashboardStats.mockResolvedValue({
        ...stats,
        chartLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        monthlyRevenue: [100, 200, 150, 300, 250, 50, 75],
      });
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText('Executive Overview')).toBeInTheDocument());
      await user.click(screen.getByText('Weekly'));
      await waitFor(() => {
        const subtitle = screen.getByText(/Week \d+/);
        expect(subtitle).toBeInTheDocument();
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


// Intl (ICU 72+) separates the clock reading from AM/PM with U+202F, not a plain
// space, so assertions on formatted times must normalize whitespace.
const normalizeWs = (t: string) => t.replace(/[\u202f\u00a0\s]+/g, ' ').trim();
const byText = (expected: string) => (_c: string, node: Element | null) =>
  !!node && node.children.length === 0 && normalizeWs(node.textContent || '') === expected;

// ── Active Reminders: actual scheduled time ──────────────────────────────────
// Regression cover for "every reminder card displays 12:00 AM". The card passed
// only { hour, minute } to formatDate, which REPLACES the default option set, so
// the day vanished and any midnight-stored instant read as "12:00 AM".
describe('Given reminders with distinct scheduled times', () => {
  const remindersAt = (...isoTimes: string[]) => ({
    ...stats,
    reminders: isoTimes.map((iso, i) => ({
      id: `r${i}`,
      title: `Reminder ${i}`,
      due_date: iso,
      description: 'Follow up',
      assigned_to: { full_name: 'Alice Rep' },
    })),
  });

  it('When a reminder is scheduled for 10:30 / Then the card shows 10:30, not 12:00 AM', async () => {
    mockGetDashboardStats.mockResolvedValue(remindersAt('2026-08-07T10:30:00Z'));
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Reminder 0')).toBeInTheDocument());
    expect(screen.getByText(byText('10:30 AM'))).toBeInTheDocument();
    expect(screen.queryByText(byText('12:00 AM'))).not.toBeInTheDocument();
  });

  it('When reminders are scheduled at different times / Then each card shows its own time', async () => {
    mockGetDashboardStats.mockResolvedValue(
      remindersAt('2026-08-07T10:30:00Z', '2026-08-07T15:45:00Z', '2026-08-07T19:00:00Z'),
    );
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Reminder 0')).toBeInTheDocument());
    expect(screen.getByText(byText('10:30 AM'))).toBeInTheDocument();
    expect(screen.getByText(byText('3:45 PM'))).toBeInTheDocument();
    expect(screen.getByText(byText('7:00 PM'))).toBeInTheDocument();
  });

  it('When a reminder is rendered / Then the card carries its DATE as well as its time', async () => {
    mockGetDashboardStats.mockResolvedValue(remindersAt('2026-08-07T10:30:00Z'));
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Reminder 0')).toBeInTheDocument());
    expect(screen.getByText(byText('Aug 7, 2026'))).toBeInTheDocument();
  });

  it('When the stored timestamp carries no timezone designator / Then it is still read as UTC, not shifted', async () => {
    mockGetDashboardStats.mockResolvedValue(remindersAt('2026-08-07T10:30:00'));
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Reminder 0')).toBeInTheDocument());
    expect(screen.getByText(byText('10:30 AM'))).toBeInTheDocument();
  });
});

describe('Given a reminder that is already past due', () => {
  it('When the card renders / Then it is flagged Overdue rather than always "Upcoming"', async () => {
    mockGetDashboardStats.mockResolvedValue({
      ...stats,
      reminders: [{
        id: 'r-past', title: 'Overdue reminder',
        due_date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        description: '', assigned_to: { full_name: 'Alice Rep' },
      }],
    });
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Overdue reminder')).toBeInTheDocument());
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});

describe('Given reminderState', () => {
  const now = new Date('2026-08-07T12:00:00Z');
  it('When the reminder is in the past / Then it reads Overdue', () => {
    expect(reminderState('2026-08-07T11:00:00Z', now).label).toBe('Overdue');
  });
  it('When the reminder is within the hour / Then it reads Due soon', () => {
    expect(reminderState('2026-08-07T12:30:00Z', now).label).toBe('Due soon');
  });
  it('When the reminder is further out / Then it reads Upcoming', () => {
    expect(reminderState('2026-08-08T12:00:00Z', now).label).toBe('Upcoming');
  });
  it('When there is no due date / Then it degrades instead of throwing', () => {
    expect(reminderState(null, now).label).toBe('No date');
    expect(reminderState('not-a-date', now).label).toBe('No date');
  });
});

// ── Empty-state density ──────────────────────────────────────────────────────
// Regression cover for "dashboard contains excessive empty space": teamStats.map
// over an empty array rendered two large, wholly blank panels.
describe('Given an org with no attributed performance data', () => {
  beforeEach(() => {
    mockGetDashboardStats.mockResolvedValue({ ...stats, teamStats: [] });
  });

  it('When Top Performers has nothing to rank / Then it explains why instead of showing a blank card', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Top Performers')).toBeInTheDocument());
    expect(screen.getByText('No revenue attributed yet')).toBeInTheDocument();
  });

  it('When there are no reps / Then the per-rep Performance Analytics band is hidden entirely', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Top Performers')).toBeInTheDocument());
    expect(screen.queryByText('Performance Analytics')).not.toBeInTheDocument();
  });

  it('When performance data does exist / Then the analytics band is shown', async () => {
    mockGetDashboardStats.mockResolvedValue(stats);
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Performance Analytics')).toBeInTheDocument());
    expect(screen.queryByText('No revenue attributed yet')).not.toBeInTheDocument();
  });
});
