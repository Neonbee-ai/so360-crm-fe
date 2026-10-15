import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import {
  targetPlanService,
  type MetricEntry,
  type Overview,
} from '../../services/targetPlanService';
import {
  AsOfBanner,
  EmptyState,
  ErrorState,
  LoadingState,
  PeriodPicker,
  STATUS_TONE,
  attainmentProps,
  formatPct,
  formatValue,
  isUnlinkedProfileError,
  statusText,
} from './targetUi';
import { DashboardPageTemplate, Badge, Progress, Card, Grid, GridItem } from '@so360/design-system';

/**
 * Per-metric detail view.
 *
 * Each roll-up metric is a card; dimensioned lines (channel slices, later
 * product mix) nest under their roll-up rather than competing with it as
 * separate cards. A slice with no target still shows its actual — tracked but
 * untargeted is a real and useful state.
 */
export default function MyTargetsPage() {
  const shell = useShellBridge();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `base_currency` is the field Core actually returns on business_settings.
  // Reading `currency` yielded undefined, so every money figure on these
  // screens formatted as USD regardless of the org's configured currency.
  const currency = (shell as any)?.businessSettings?.base_currency ?? undefined;
  const [asOf, setAsOf] = useState('');

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
      .myOverview(asOf || undefined)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [asOf]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const metrics = data?.metrics ?? [];
    const rollups = metrics.filter((m) => !m.dimension_key);
    return rollups.map((r) => ({
      rollup: r,
      slices: metrics.filter(
        (m) => m.dimension_key && m.task_type_id === r.task_type_id,
      ),
    }));
  }, [data]);

  // Rendered by EVERY branch, including the loading and empty states. If the
  // picker vanished when a period came back empty, the user would be stuck on
  // that period with no way to choose another.
  const header = isUnlinkedProfileError(error) ? undefined : (
    <div className="space-y-2">
      <PeriodPicker value={asOf} onChange={setAsOf} />
      <AsOfBanner asOf={asOf} />
    </div>
  );

  if (loading) {
    return (
      <DashboardPageTemplate title="My Targets" filters={header}>
      <div className="space-y-4">
        <LoadingState />
      </div>
      </DashboardPageTemplate>
    );
  }
  if (error) {
    return (
      <DashboardPageTemplate title="My Targets" filters={header}>
      <div className="space-y-4">
        <ErrorState error={error} onRetry={load} />
      </div>
      </DashboardPageTemplate>
    );
  }
  if (!grouped.length) {
    return (
      <DashboardPageTemplate title="My Targets" filters={header}>
      <div className="space-y-4">
        <EmptyState title="No targets for this period" description="Nothing is assigned to you in the selected period. Pick another date or ask an admin." />
      </div>
      </DashboardPageTemplate>
    );
  }

  const plan = data?.plans?.[0];
  const anyMetric = data?.metrics?.[0];

  return (
    <DashboardPageTemplate title="My Targets" filters={header}>
    <Grid>
      <GridItem span={12}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
          <span>{plan?.name}</span>
          {anyMetric && (
            <span>
              {anyMetric.period_start} → {anyMetric.period_end}
            </span>
          )}
          {anyMetric && <span>{anyMetric.days_remaining} days left</span>}
        </div>
        {anyMetric && (
          <div className="mt-3">
            <Progress value={Math.min(Math.max(anyMetric.elapsed_fraction, 0), 1) * 100} size="sm" label="Period elapsed" showValue />
          </div>
        )}
      </GridItem>

      {grouped.map(({ rollup, slices }) => (
        <GridItem key={rollup.target_line_id} span={4}>
          <MetricCard metric={rollup} slices={slices} currency={currency} />
        </GridItem>
      ))}

      <GridItem span={12}>
        <div className="flex flex-wrap gap-nb-2">
          {(['on_track', 'at_risk', 'behind', 'achieved', 'exceeded'] as const).map((st) => (
            <Badge key={st} tone={STATUS_TONE[st]} dot>{statusText(st)}</Badge>
          ))}
        </div>
      </GridItem>
    </Grid>
    </DashboardPageTemplate>
  );
}

function MetricCard({
  metric,
  slices,
  currency,
}: {
  metric: MetricEntry;
  slices: MetricEntry[];
  currency?: string;
}) {
  return (
    <Card title={metric.metric_name}>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-fg">
          {formatValue(metric.actual, metric.unit, currency)}
        </span>
        <span className="text-sm text-fg-muted">
          of {formatValue(metric.target, metric.unit, currency)}
        </span>
      </div>

      <Progress {...attainmentProps(metric.actual, metric.target, metric.status)} />

      <div className="mt-2 flex items-center justify-between">
        <Badge tone={STATUS_TONE[metric.status]} dot>{statusText(metric.status, metric.status_label)}</Badge>
        <span className="text-xs text-fg-subtle">
          {metric.remaining > 0
            ? `${formatValue(metric.remaining, metric.unit, currency)} to go`
            : 'target met'}
        </span>
      </div>

      <div className="mt-1 text-xs text-fg-muted">
        {formatPct(metric.attainment)} achieved
        {metric.projection.projectable &&
          metric.projection.projectedAttainment !== null && (
            <> · projected {formatPct(metric.projection.projectedAttainment)}</>
          )}
        {!metric.projection.projectable && <> · too early to project</>}
      </div>

      {slices.length > 0 && (
        <div className="mt-3 border-t border-line pt-3 space-y-2">
          {slices.map((s) => (
            <div key={s.target_line_id}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-fg-subtle">{s.dimension_value}</span>
                <span className="text-fg-subtle">
                  {s.target > 0
                    ? `${formatValue(s.actual)} / ${formatValue(s.target)}`
                    : `${formatValue(s.actual)} · tracked`}
                </span>
              </div>
              {s.target > 0 && (
                <div className="mt-1">
                  <Progress {...attainmentProps(s.actual, s.target, s.status)} size="sm" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
