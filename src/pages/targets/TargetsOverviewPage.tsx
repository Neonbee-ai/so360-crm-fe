import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import {
  targetPlanService,
  type Overview,
} from '../../services/targetPlanService';
import {
  ElapsedBar,
  EmptyState,
  Panel,
  ProgressBar,
  Sparkline,
  StatusChip,
  TrendArrow,
  formatPct,
  formatValue,
} from './targetUi';

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
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading overview…</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-rose-300">{error}</div>;
  }
  if (!data || !data.plans?.length) {
    return (
      <div className="p-6">
        <EmptyState message="No active target plan for this period. An admin can create one under Target Plans." />
      </div>
    );
  }

  const h = data.headline;
  const plan = data.plans[0];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Overview</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>{plan?.name}</span>
          {h && <span>{h.days_remaining} days left</span>}
          {plan?.linked_goal_id && (
            <span className="text-sky-300">Linked goal ↗</span>
          )}
        </div>
        {h && (
          <div className="mt-3 max-w-md">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>Period elapsed</span>
              <span>{formatPct(h.elapsed_fraction)}</span>
            </div>
            <ElapsedBar fraction={h.elapsed_fraction} />
          </div>
        )}
      </div>

      {h && (
        <Panel title={h.metric_name}>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Achieved</span>
                <span className="text-xs text-slate-400">
                  {formatPct(h.attainment)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-100">
                  {formatValue(h.actual, h.unit, currency)}
                </span>
                <span className="text-sm text-slate-500">
                  of {formatValue(h.target, h.unit, currency)}
                </span>
              </div>
              <ProgressBar
                actual={h.actual}
                target={h.target}
                status={h.status}
              />
              <div className="mt-2">
                <StatusChip status={h.status} label={h.status_label} />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-400">Projected close</span>
                {h.projection.projectable && (
                  <span className="text-xs text-slate-400">
                    {formatPct(h.projection.projectedAttainment)}
                  </span>
                )}
              </div>
              {h.projection.projectable ? (
                <>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg font-medium text-slate-200">
                      {formatValue(h.projection.projected, h.unit, currency)}
                    </span>
                    {h.projection.projectedGap !== null && (
                      <span
                        className={`text-xs ${
                          h.projection.projectedGap < 0
                            ? 'text-amber-300'
                            : 'text-emerald-300'
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
                      <StatusChip status={h.projection.projectedStatus} />
                    </div>
                  )}
                </>
              ) : (
                // Deliberately explicit rather than a hidden field: a run-rate
                // this early swings on a single deal and would read as fact.
                <div className="mt-1 text-sm text-slate-500">
                  — too early to project
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {data.trend && data.trend.points.length > 0 && (
        <Panel
          title="Trend"
          action={
            <span className="flex items-center gap-2 text-xs text-slate-400">
              average {formatPct(data.trend.average)}
              <TrendArrow direction={data.trend.direction} />
            </span>
          }
        >
          <Sparkline points={data.trend.points} />
          <div className="mt-2 flex gap-2 text-[11px] text-slate-500">
            {data.trend.points.map((p) => (
              <div key={p.period_start} className="flex-1 text-center">
                {formatPct(p.attainment)}
              </div>
            ))}
          </div>
          {data.trend.planChanges > 0 && (
            <div className="mt-3 text-[11px] text-slate-500">
              {data.trend.planChanges} period
              {data.trend.planChanges === 1 ? '' : 's'} had the target edited
              mid-flight
            </div>
          )}
        </Panel>
      )}

      {data.needs_attention.length > 0 && (
        <Panel title="Needs attention">
          <div className="space-y-2">
            {data.needs_attention.map((n) => (
              <div
                key={`${n.target_line_id}-${n.dimension_value ?? ''}`}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusChip status={n.status.status} label="" />
                  <span className="text-slate-200 truncate">
                    {n.metric_name}
                    {n.dimension_value ? ` · ${n.dimension_value}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-slate-400">
                  <span>
                    {formatValue(n.actual)} of {formatValue(n.target)}
                  </span>
                  <span>{n.days_remaining} days left</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="All metrics">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {data.metrics
            .filter((m) => !m.dimension_key)
            .map((m) => (
              <div key={m.target_line_id} className="flex items-center gap-2">
                <span className="text-slate-300">{m.metric_name}</span>
                <span className="text-slate-400">
                  {formatPct(m.attainment)}
                </span>
                <StatusChip status={m.status} label="" />
              </div>
            ))}
        </div>
      </Panel>
    </div>
  );
}
