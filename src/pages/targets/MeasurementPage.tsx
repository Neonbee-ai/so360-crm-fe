import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { EmptyState, Panel, formatPct, formatValue } from './targetUi';

/**
 * Pipeline health, deal mix, sales cycle and win/loss.
 *
 * Every panel is capability-driven: the API returns an `applicable` flag and a
 * panel that does not apply is HIDDEN, not rendered empty. An ecommerce org
 * with no pipeline should never see a coverage-ratio widget reading "—"; that
 * is what lets one screen serve every industry the platform sells to.
 */
export default function MeasurementPage() {
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
      .myMeasurement()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-rose-300">{error}</div>;
  }
  if (!data) {
    return (
      <div className="p-6">
        <EmptyState message="No measurement data for this period." />
      </div>
    );
  }

  const { pipeline, deal_mix: mix, win_loss: winLoss } = data;
  const nothingApplies =
    !pipeline?.applicable && !mix?.applicable && !winLoss?.won_count && !winLoss?.lost_count;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Measurement</h1>
        <div className="mt-1 text-xs text-slate-400">
          {data.period_start} → {data.period_end}
        </div>
      </div>

      {nothingApplies && (
        <EmptyState message="No pipeline, product lines or closed deals in this period yet." />
      )}

      <div className="flex flex-wrap gap-4">
        {pipeline?.applicable && (
          <Panel title="Pipeline Health">
            <div className="space-y-2 text-sm min-w-[18rem]">
              <Row
                label="Period target"
                value={formatValue(pipeline.target, 'currency', currency)}
              />
              <Row
                label="Total pipeline"
                value={formatValue(pipeline.total_pipeline, 'currency', currency)}
              />
              <div className="flex items-center justify-between border-y border-slate-800 py-2">
                <span className="text-slate-400">Coverage</span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-100">
                    {pipeline.coverage === null
                      ? '—'
                      : `${pipeline.coverage.toFixed(1)}×`}
                  </span>
                  {pipeline.healthy !== null && (
                    <span
                      className={
                        pipeline.healthy ? 'text-emerald-300' : 'text-amber-300'
                      }
                    >
                      {pipeline.healthy ? 'Healthy' : 'Below band'}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Healthy band {pipeline.coverage_min}× – {pipeline.coverage_max}×
                (org configurable)
              </div>
              {pipeline.by_stage?.map((s: any) => (
                <Row
                  key={s.stage}
                  label={s.stage}
                  value={formatValue(s.value, 'currency', currency)}
                />
              ))}
              <Row
                label="Expected revenue"
                value={formatValue(pipeline.expected_revenue, 'currency', currency)}
              />
            </div>
          </Panel>
        )}

        {mix?.applicable && (
          <Panel title="Deal Mix">
            <div className="space-y-2 text-sm min-w-[18rem]">
              {mix.lines.map((l: any) => (
                <div key={l.key}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">{l.label}</span>
                    <span className="text-slate-400 text-xs">
                      {formatValue(l.value, 'currency', currency)} ·{' '}
                      {formatPct(l.share)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${Math.min(l.share * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-800 pt-2 text-xs text-slate-400">
                {mix.total_deals} won deal{mix.total_deals === 1 ? '' : 's'} ·{' '}
                {formatValue(mix.total_value, 'currency', currency)}
              </div>
              {mix.grouping === 'category_name' && (
                // Worth surfacing: grouping on a free-text category is fragile,
                // and the fix is a catalog backfill rather than a code change.
                <div className="text-[11px] text-amber-300">
                  Grouped by category name — backfill product types for stable
                  service-line reporting.
                </div>
              )}
            </div>
          </Panel>
        )}

        {(winLoss?.won_count > 0 || winLoss?.lost_count > 0) && (
          <Panel title="Win / Loss">
            <div className="space-y-2 text-sm min-w-[18rem]">
              <Row
                label="Won"
                value={`${winLoss.won_count} · ${formatValue(winLoss.won_value, 'currency', currency)}`}
              />
              <Row
                label="Lost"
                value={`${winLoss.lost_count} · ${formatValue(winLoss.lost_value, 'currency', currency)}`}
              />
              <Row label="Win rate" value={formatPct(winLoss.win_rate)} />
              <Row label="Loss rate" value={formatPct(winLoss.loss_rate)} />
              <div className="border-t border-slate-800 pt-2 space-y-1">
                {winLoss.by_reason?.map((r: any) => (
                  <div
                    key={r.value}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-300">{r.label}</span>
                    <span className="text-slate-400">
                      {r.count} ·{' '}
                      {formatValue(r.lost_value, 'currency', currency)}
                    </span>
                  </div>
                ))}
              </div>
              {winLoss.top_reason && (
                <Row label="Top loss reason" value={winLoss.top_reason.label} />
              )}
              <Row
                label="Competitor losses"
                value={String(winLoss.competitor_losses ?? 0)}
              />
              {winLoss.uncoded_losses > 0 && (
                // A data-quality signal, not an insight: an unexplained loss
                // cannot inform the next quarter.
                <div className="text-[11px] text-amber-300">
                  {winLoss.uncoded_losses} lost deal
                  {winLoss.uncoded_losses === 1 ? '' : 's'} without a reason code
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}
