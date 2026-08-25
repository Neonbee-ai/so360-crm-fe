import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import {
  targetPlanService,
  type MetricEntry,
  type Overview,
} from '../../services/targetPlanService';
import {
  ElapsedBar,
  EmptyState,
  ProgressBar,
  StatusChip,
  formatPct,
  formatValue,
} from './targetUi';

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

  const currency = (shell as any)?.businessSettings?.currency ?? undefined;

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

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading targets…</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-rose-300">{error}</div>;
  }
  if (!grouped.length) {
    return (
      <div className="p-6">
        <EmptyState message="No targets assigned for this period." />
      </div>
    );
  }

  const plan = data?.plans?.[0];
  const anyMetric = data?.metrics?.[0];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">My Targets</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>{plan?.name}</span>
          {anyMetric && (
            <span>
              {anyMetric.period_start} → {anyMetric.period_end}
            </span>
          )}
          {anyMetric && <span>{anyMetric.days_remaining} days left</span>}
        </div>
        {anyMetric && (
          <div className="mt-3 max-w-md">
            <ElapsedBar fraction={anyMetric.elapsed_fraction} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        {grouped.map(({ rollup, slices }) => (
          <MetricCard
            key={rollup.target_line_id}
            metric={rollup}
            slices={slices}
            currency={currency}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
        <span>● On Track</span>
        <span>◐ At Risk</span>
        <span>○ Behind</span>
        <span>✓ Achieved</span>
        <span>★ Exceeded</span>
      </div>
    </div>
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
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 grow basis-80 max-w-md">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {metric.metric_name}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-100">
          {formatValue(metric.actual, metric.unit, currency)}
        </span>
        <span className="text-sm text-slate-500">
          of {formatValue(metric.target, metric.unit, currency)}
        </span>
      </div>

      <ProgressBar
        actual={metric.actual}
        target={metric.target}
        status={metric.status}
      />

      <div className="mt-2 flex items-center justify-between">
        <StatusChip status={metric.status} label={metric.status_label} />
        <span className="text-xs text-slate-400">
          {metric.remaining > 0
            ? `${formatValue(metric.remaining, metric.unit, currency)} to go`
            : 'target met'}
        </span>
      </div>

      <div className="mt-1 text-[11px] text-slate-500">
        {formatPct(metric.attainment)} achieved
        {metric.projection.projectable &&
          metric.projection.projectedAttainment !== null && (
            <> · projected {formatPct(metric.projection.projectedAttainment)}</>
          )}
        {!metric.projection.projectable && <> · too early to project</>}
      </div>

      {slices.length > 0 && (
        <div className="mt-3 border-t border-slate-800 pt-3 space-y-2">
          {slices.map((s) => (
            <div key={s.target_line_id}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{s.dimension_value}</span>
                <span className="text-slate-400">
                  {s.target > 0
                    ? `${formatValue(s.actual)} / ${formatValue(s.target)}`
                    : `${formatValue(s.actual)} · tracked`}
                </span>
              </div>
              {s.target > 0 && (
                <div className="mt-1">
                  <ProgressBar
                    actual={s.actual}
                    target={s.target}
                    status={s.status}
                    compact
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
