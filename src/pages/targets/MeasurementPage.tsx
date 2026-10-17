import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import {
  AsOfBanner,
  EmptyState,
  ErrorState,
  LoadingState,
  PeriodPicker,
  formatPct,
  formatValue,
  isUnlinkedProfileError,
} from './targetUi';
import { DashboardPageTemplate, Card, Grid, GridItem, Progress } from '@so360/design-system';

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
      .myMeasurement(asOf || undefined)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [asOf]);

  useEffect(() => {
    load();
  }, [load]);

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
      <DashboardPageTemplate title="Measurement" filters={header} trail={[{ label: 'Targets', to: '/crm/targets' }]}>
      <div className="space-y-4">
        <LoadingState />
      </div>
      </DashboardPageTemplate>
    );
  }
  if (error) {
    return (
      <DashboardPageTemplate title="Measurement" filters={header} trail={[{ label: 'Targets', to: '/crm/targets' }]}>
      <div className="space-y-4">
        <ErrorState error={error} onRetry={load} />
      </div>
      </DashboardPageTemplate>
    );
  }
  if (!data) {
    return (
      <DashboardPageTemplate title="Measurement" filters={header} trail={[{ label: 'Targets', to: '/crm/targets' }]}>
      <div className="space-y-4">
        <EmptyState title="No measurement data" description="There is nothing to measure in the selected period." />
      </div>
      </DashboardPageTemplate>
    );
  }

  const { pipeline, deal_mix: mix, win_loss: winLoss } = data;
  const nothingApplies =
    !pipeline?.applicable && !mix?.applicable && !winLoss?.won_count && !winLoss?.lost_count;

  return (
    <DashboardPageTemplate title="Measurement" filters={header} trail={[{ label: 'Targets', to: '/crm/targets' }]}>
    <Grid>
      <GridItem span={12}>
        <div className="text-xs text-fg-subtle">
          {data.period_start} → {data.period_end}
        </div>
      </GridItem>

      {nothingApplies && (
        <GridItem span={12}>
          <EmptyState title="Nothing to measure yet" description="No pipeline, product lines or closed deals in this period." />
        </GridItem>
      )}

        {pipeline?.applicable && (
          <GridItem span={4}>
          <Card title="Pipeline Health">
            <div className="space-y-2 text-sm">
              <Row
                label="Period target"
                value={formatValue(pipeline.target, 'currency', currency)}
              />
              <Row
                label="Total pipeline"
                value={formatValue(pipeline.total_pipeline, 'currency', currency)}
              />
              <div className="flex items-center justify-between border-y border-line py-2">
                <span className="text-fg-subtle">Coverage</span>
                <span className="flex items-center gap-2">
                  <span className="text-fg">
                    {pipeline.coverage === null
                      ? '—'
                      : `${pipeline.coverage.toFixed(1)}×`}
                  </span>
                  {pipeline.healthy !== null && (
                    <span
                      className={
                        pipeline.healthy ? 'text-success' : 'text-warning'
                      }
                    >
                      {pipeline.healthy ? 'Healthy' : 'Below band'}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-xs text-fg-muted">
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
          </Card>
          </GridItem>
        )}

        {mix?.applicable && (
          <GridItem span={4}>
          <Card title="Deal Mix">
            <div className="space-y-2 text-sm">
              {mix.lines.map((l: any) => (
                <div key={l.key}>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-subtle">{l.label}</span>
                    <span className="text-fg-subtle text-xs">
                      {formatValue(l.value, 'currency', currency)} ·{' '}
                      {formatPct(l.share)}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Progress value={Math.min(l.share * 100, 100)} size="sm" />
                  </div>
                </div>
              ))}
              <div className="border-t border-line pt-2 text-xs text-fg-subtle">
                {mix.total_deals} won deal{mix.total_deals === 1 ? '' : 's'} ·{' '}
                {formatValue(mix.total_value, 'currency', currency)}
              </div>
              {mix.grouping === 'category_name' && (
                // Worth surfacing: grouping on a free-text category is fragile,
                // and the fix is a catalog backfill rather than a code change.
                <div className="text-xs text-warning">
                  Grouped by category name — backfill product types for stable
                  service-line reporting.
                </div>
              )}
            </div>
          </Card>
          </GridItem>
        )}

        {(winLoss?.won_count > 0 || winLoss?.lost_count > 0) && (
          <GridItem span={4}>
          <Card title="Win / Loss">
            <div className="space-y-2 text-sm">
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
              <div className="border-t border-line pt-2 space-y-1">
                {winLoss.by_reason?.map((r: any) => (
                  <div
                    key={r.value}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-fg-subtle">{r.label}</span>
                    <span className="text-fg-subtle">
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
                <div className="text-xs text-warning">
                  {winLoss.uncoded_losses} lost deal
                  {winLoss.uncoded_losses === 1 ? '' : 's'} without a reason code
                </div>
              )}
            </div>
          </Card>
          </GridItem>
        )}
    </Grid>
    </DashboardPageTemplate>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-subtle">{label}</span>
      <span className="text-fg">{value}</span>
    </div>
  );
}
