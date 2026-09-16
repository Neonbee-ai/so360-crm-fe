import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { EmptyState, Panel, formatPct, formatValue } from './targetUi';

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

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading history…</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-rose-300">{error}</div>;
  }
  if (!data?.periods?.length) {
    return (
      <div className="p-6">
        <EmptyState message="No completed periods yet. History appears once a target period closes." />
      </div>
    );
  }

  // Metric columns are derived from the data, never hardcoded — the same
  // screen renders whatever metrics the org actually configured.
  const metricNames: string[] = Array.from(
    new Set(
      data.periods.flatMap((p: any) =>
        p.metrics.map((m: any) => m.metric_name),
      ),
    ),
  );

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-lg font-semibold text-slate-100">
        Performance History
      </h1>

      <Panel title="By period">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-4 font-medium">Period</th>
                {metricNames.map((n) => (
                  <th key={n} className="py-2 pr-4 font-medium text-right">
                    {n}
                  </th>
                ))}
                <th className="py-2 pr-4 font-medium text-right">Overall</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p: any) => (
                <tr
                  key={p.period_start}
                  className="border-b border-slate-800/60"
                >
                  <td className="py-2 pr-4 text-slate-200">
                    {p.period_start}
                  </td>
                  {metricNames.map((n) => {
                    const m = p.metrics.find(
                      (x: any) => x.metric_name === n,
                    );
                    return (
                      <td
                        key={n}
                        className="py-2 pr-4 text-right text-slate-300"
                        title={
                          m
                            ? `${formatValue(m.actual, m.unit, currency)} of ${formatValue(m.target, m.unit, currency)}`
                            : undefined
                        }
                      >
                        {m ? formatPct(m.attainment) : '—'}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-4 text-right text-slate-100">
                    {formatPct(p.overall_attainment)}
                  </td>
                  <td className="py-2 text-xs text-slate-500">
                    {p.plan_changed ? 'target changed' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
          <span>Average {formatPct(data.average)}</span>
          {data.best && (
            <span>
              Best {data.best.period_start} (
              {formatPct(data.best.overall_attainment)})
            </span>
          )}
          <span>Plan changes {data.plan_changes}</span>
        </div>
      </Panel>
    </div>
  );
}
