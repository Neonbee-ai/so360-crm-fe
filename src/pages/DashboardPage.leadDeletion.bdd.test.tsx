/**
 * Feature: the CRM dashboard reflects a lead deletion without a manual refresh
 *
 * The dashboard's numbers are computed server-side from live queries, and the
 * backend already excludes soft-deleted leads from all of them. What was
 * missing was the nudge: DashboardPage fetched on mount and on period change
 * only, so deleting a lead elsewhere in the app left a stale count on screen —
 * which read exactly like "the deleted lead is still counted".
 *
 * Deleting publishes on the shared lead-change topic; the dashboard re-reads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';

const mockGetDashboardStats = vi.fn();

vi.mock('../services/crmService', () => ({
  crmService: {
    getDashboardStats: (...a: any[]) => mockGetDashboardStats(...a),
    getCommerceKPIs: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@so360/shell-context', () => ({
  useShell: () => ({
    isModuleEnabled: () => false,
    isFeatureHidden: () => false,
  }),
  useBusinessSettings: () => ({ settings: {}, isLoading: false }),
}));

vi.mock('@so360/design-system', () => ({
  CrossLinkChip: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('../utils/formatters', () => ({
  useCRMFormatters: () => ({
    formatCurrency: (v: number) => `$${v}`,
    formatNumber: (v: number) => String(v),
    formatDate: (v: string) => v,
  }),
}));

import DashboardPage from './DashboardPage';
import { publishLeadsChanged } from '../utils/leadEvents';

const statsWith = (leads: number) => ({
  financials: { totalRevenue: 0, pipelineValue: 0, avgDealSize: 0, winRate: 0 },
  counts: { leads, deals: 0, tasks: 0, reminders: 0 },
  teamStats: [],
  monthlyRevenue: [],
  chartLabels: [],
  recentActivity: [],
  reminders: [],
  pipeline: [],
});

describe('Feature: dashboard metrics follow lead deletions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Given the dashboard shows a lead count / When a lead is deleted / Then it re-reads the stats', async () => {
    mockGetDashboardStats
      .mockResolvedValueOnce(statsWith(12))
      .mockResolvedValueOnce(statsWith(11));

    render(<DashboardPage />);
    await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledTimes(1));

    await act(async () => {
      publishLeadsChanged('deleted', ['lead-1']);
    });

    // The new number comes from the server, which excludes the deleted lead —
    // the page never recomputes a count on its own.
    await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledTimes(2));
  });

  it('Given a lead is restored / When the topic fires / Then the dashboard re-reads again', async () => {
    mockGetDashboardStats.mockResolvedValue(statsWith(12));

    render(<DashboardPage />);
    await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledTimes(1));

    await act(async () => {
      publishLeadsChanged('restored', ['lead-1']);
    });

    await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledTimes(2));
  });

  it('Given nothing was actually deleted / When an empty id list is published / Then no refetch happens', async () => {
    mockGetDashboardStats.mockResolvedValue(statsWith(12));

    render(<DashboardPage />);
    await waitFor(() => expect(mockGetDashboardStats).toHaveBeenCalledTimes(1));

    await act(async () => {
      publishLeadsChanged('deleted', []);
    });

    expect(mockGetDashboardStats).toHaveBeenCalledTimes(1);
  });
});
