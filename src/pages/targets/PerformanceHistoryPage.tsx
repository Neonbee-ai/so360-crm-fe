import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import {
  EmptyState,
  ErrorState,
  formatPct,
  formatValue,
} from './targetUi';
import { ListPageTemplate, DataTable } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';

/**
 * Past-period performance.
 *
 * Periods whose target was edited mid-flight are flagged rather than
 * re-baselined, so a history reading is never silently distorted by a moved
 * goalpost. Backs the employee "view performance history" permission, which
 * previously existed as a code with no screen behind it.
 */
export default function PerformanceHistoryPage() {
  const shell = useShellBridge();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `base_currency` is the field Core actually returns on business_settings.
  // Reading `currency` yielded undefined, so every money figure on these
  // screens formatted as USD regardless of the org's configured currency.
  const currency = (shell as any)?.businessSettings?.base_currency ?? undefined;

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      targetPlanService.setTenantId(shell.currentTenant.id);
      targetPlanService.setOrgId(shell.currentOrg?.id ?? '');
      targetPlanService.setAccessToken(shell.accessToken ?? '');
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    targetPlanService
      .myHistory(12)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Metric columns are derived from the data, never hardcoded — the same
  // screen renders whatever metrics the org actually configured.
  const metricNames: string[] = Array.from(
    new Set(
      (data?.periods ?? []).flatMap((p: any) =>
        p.metrics.map((m: any) => m.metric_name),
      ),
    ),
  );

  const columns: DataTableColumn<any>[] = [
    { key: 'period', header: 'Period', sortable: true, sortValue: (p) => p.period_start, render: (p) => <span className="text-fg">{p.period_start}</span> },
    ...metricNames.map((n): DataTableColumn<any> => ({
      key: `m-${n}`,
      header: n,
      align: 'right',
      render: (p) => {
        const m = p.metrics.find((x: any) => x.metric_name === n);
        return (
          <span
            className="text-fg-subtle"
            title={m ? `${formatValue(m.actual, m.unit, currency)} of ${formatValue(m.target, m.unit, currency)}` : undefined}
          >
            {m ? formatPct(m.attainment) : '—'}
          </span>
        );
      },
    })),
    { key: 'overall', header: 'Overall', align: 'right', sortable: true, sortValue: (p) => p.overall_attainment ?? 0, render: (p) => <span className="text-fg">{formatPct(p.overall_attainment)}</span> },
    { key: 'changed', header: '', render: (p) => <span className="text-xs text-fg-muted">{p.plan_changed ? 'target changed' : ''}</span> },
  ];

  const periods: any[] = data?.periods ?? [];
  const summary = periods.length
    ? [
        `Average ${formatPct(data.average)}`,
        data.best ? `Best ${data.best.period_start} (${formatPct(data.best.overall_attainment)})` : null,
        `Plan changes ${data.plan_changes}`,
      ].filter(Boolean).join(' · ')
    : undefined;

  return (
    <ListPageTemplate
      title="Performance History"
      description={summary}
      count={periods.length || undefined}
      loading={loading}
      isEmpty={!loading && (!!error || !periods.length)}
      empty={
        error ? (
          <ErrorState error={error} onRetry={load} />
        ) : (
          <EmptyState
            title="No completed periods yet"
            description="History appears once a target period closes."
          />
        )
      }
    >
      <DataTable
        columns={columns}
        rows={periods}
        rowKey={(p: any) => p.period_start}
      />
    </ListPageTemplate>
  );
}
