import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import {
  targetPlanService,
  type Overview,
} from '../../services/targetPlanService';
import {
  EmptyState,
  ErrorState,
  UNLINKED_PROFILE_MESSAGE,
  isUnlinkedPayload,
  LoadingState,
  STATUS_TONE,
  STATUS_LEGEND,
  trendDelta,
  trendSparkline,
  attainmentProps,
  formatPct,
  formatValue,
  statusText,
} from './targetUi';
import { DashboardPageTemplate, Badge, Progress, Card, CountUp, Grid, GridItem, Sparkline, TrendIndicator, StatusLegend } from '@so360/design-system';

/**
 * The landing screen.
 *
 * Answers six questions without a drill-down: what is my target, how much have
 * I achieved, what is remaining, am I on track, where will I land, and am I
 * improving. Status alone only covers four of those — projection and trend are
 * what make the screen actionable rather than merely descriptive.
 */
export default function TargetsOverviewPage() {
  const shell = useShellBridge();
  const [data, setData] = useState<Overview | null>(null);
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
      .myOverview()
      .then((d) =>
        isUnlinkedPayload(d) ? setError(UNLINKED_PROFILE_MESSAGE) : setData(d),
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || error || !data || !data.plans?.length) {
    return (
      <DashboardPageTemplate title="Overview" trail={[]}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={load} />
        ) : (
          <EmptyState
            title="No active target plan"
            description="There is no active target plan for this period. An admin can create one under Target Plans."
          />
        )}
      </DashboardPageTemplate>
    );
  }

  const h = data.headline;
  const plan = data.plans[0];

  return (
    <DashboardPageTemplate
      trail={[]}
      title="Overview"
      meta={(
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
          <span>{plan?.name}</span>
          {h && <span>{h.days_remaining} days left</span>}
          {plan?.linked_goal_id && (
            <span className="text-info">Linked goal ↗</span>
          )}
        </div>
      )}
    >
    <Grid>
      {h && (
        <GridItem span={6}>
          <Progress
            value={Math.min(Math.max(h.elapsed_fraction, 0), 1) * 100}
            size="sm"
            label={`Period elapsed · ${formatPct(h.elapsed_fraction)}`}
          />
        </GridItem>
      )}

      {h && (
        <GridItem span={12}>
        <Card title={h.metric_name}>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-fg-subtle">Achieved</span>
                <span className="text-xs text-fg-subtle">
                  {formatPct(h.attainment)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-fg">
                  <CountUp value={formatValue(h.actual, h.unit, currency)} />
                </span>
                <span className="text-sm text-fg-muted">
                  of {formatValue(h.target, h.unit, currency)}
                </span>
              </div>
              <Progress {...attainmentProps(h.actual, h.target, h.status)} />
              <div className="mt-2">
                <Badge tone={STATUS_TONE[h.status]} dot>{statusText(h.status, h.status_label)}</Badge>
              </div>
              <StatusLegend className="mt-2" items={STATUS_LEGEND} />
            </div>

            <div className="border-t border-line pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-fg-subtle">Projected close</span>
                {h.projection.projectable && (
                  <span className="text-xs text-fg-subtle">
                    {formatPct(h.projection.projectedAttainment)}
                  </span>
                )}
              </div>
              {h.projection.projectable ? (
                <>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg font-medium text-fg">
                      {formatValue(h.projection.projected, h.unit, currency)}
                    </span>
                    {h.projection.projectedGap !== null && (
                      <span
                        className={`text-xs ${
                          h.projection.projectedGap < 0
                            ? 'text-warning'
                            : 'text-success'
                        }`}
                      >
                        {h.projection.projectedGap < 0 ? 'short by ' : 'over by '}
                        {formatValue(
                          Math.abs(h.projection.projectedGap),
                          h.unit,
                          currency,
                        )}
                      </span>
                    )}
                  </div>
                  {h.projection.projectedStatus && (
                    <div className="mt-2">
                      <Badge tone={STATUS_TONE[h.projection.projectedStatus]} dot>{statusText(h.projection.projectedStatus)}</Badge>
                    </div>
                  )}
                </>
              ) : (
                // Deliberately explicit rather than a hidden field: a run-rate
                // this early swings on a single deal and would read as fact.
                <div className="mt-1 text-sm text-fg-muted">
                  — too early to project
                </div>
              )}
            </div>
          </div>
        </Card>
        </GridItem>
      )}

      {data.trend && data.trend.points.length > 0 && (
        <GridItem span={6}>
        <Card
          title="Trend"
          actions={
            <span className="flex items-center gap-2 text-xs text-fg-subtle">
              average {formatPct(data.trend.average)}
              <TrendIndicator value={trendDelta(data.trend.points, data.trend.direction)} format="number" />
            </span>
          }
        >
          <Sparkline type="bar" {...trendSparkline(data.trend.points)} />
          <div className="mt-2 flex gap-2 text-xs text-fg-muted">
            {data.trend.points.map((p) => (
              <div key={p.period_start} className="flex-1 text-center">
                {formatPct(p.attainment)}
              </div>
            ))}
          </div>
          {data.trend.planChanges > 0 && (
            <div className="mt-3 text-xs text-fg-muted">
              {data.trend.planChanges} period
              {data.trend.planChanges === 1 ? '' : 's'} had the target edited
              mid-flight
            </div>
          )}
        </Card>
        </GridItem>
      )}

      {data.needs_attention.length > 0 && (
        <GridItem span={6}>
        <Card title="Needs attention">
          <div className="space-y-2">
            {data.needs_attention.map((n) => (
              <div
                key={`${n.target_line_id}-${n.dimension_value ?? ''}`}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge tone={STATUS_TONE[n.status.status]} dot />
                  <span className="text-fg truncate">
                    {n.metric_name}
                    {n.dimension_value ? ` · ${n.dimension_value}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-fg-subtle">
                  <span>
                    {formatValue(n.actual)} of {formatValue(n.target)}
                  </span>
                  <span>{n.days_remaining} days left</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        </GridItem>
      )}

      <GridItem span={12}>
      <Card title="All metrics">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {data.metrics
            .filter((m) => !m.dimension_key)
            .map((m) => (
              <div key={m.target_line_id} className="flex items-center gap-2">
                <span className="text-fg-subtle">{m.metric_name}</span>
                <span className="text-fg-subtle">
                  {formatPct(m.attainment)}
                </span>
                <Badge tone={STATUS_TONE[m.status]} dot />
              </div>
            ))}
        </div>
      </Card>
      </GridItem>
    </Grid>
    </DashboardPageTemplate>
  );
}
