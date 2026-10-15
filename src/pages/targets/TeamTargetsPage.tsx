import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import {
  EmptyState,
  Panel,
  PersonName,
  ProgressBar,
  StatusChip,
  formatPct,
  formatValue,
  PeriodPicker,
  AsOfBanner,
} from './targetUi';
import { DashboardPageTemplate, Button, DataTable } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';

/**
 * Manager roll-up.
 *
 * Rows are returned lowest-attainment-first by the API, so whoever needs
 * attention is at the top rather than buried in an alphabetical list.
 */
export default function TeamTargetsPage() {
  const shell = useShellBridge();
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [asOf, setAsOf] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The plan list is filtered by the SAME date the scorecard is read
      // for, or a past period would list today's active plans beside that
      // period's numbers.
      const today = asOf || new Date().toISOString().slice(0, 10);
      const plans = await targetPlanService.listPlans({
        status: 'active',
        active_on: today,
      });
      const personIds = Array.from(
        new Set(
          plans
            .filter((p: any) => p.owner_type === 'rep' && p.owner_id)
            .map((p: any) => p.owner_id as string),
        ),
      );
      if (!personIds.length) {
        setRows([]);
        setTotals(null);
        return;
      }
      const res = await targetPlanService.teamScorecard(
        personIds,
        asOf || undefined,
      );
      setRows(res.rows ?? []);
      setTotals(res.totals ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (personId: string) => {
    setSelected(personId);
    setDetail(null);
    try {
      setDetail(
        await targetPlanService.overviewFor(personId, asOf || undefined),
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Rendered by EVERY branch, including the loading and empty states. If the
  // picker vanished when a period came back empty, the user would be stuck on
  // that period with no way to choose another.
  const header = (
    <div className="space-y-2">
      <PeriodPicker value={asOf} onChange={setAsOf} />
      <AsOfBanner asOf={asOf} />
    </div>
  );

  const columns: DataTableColumn<any>[] = [
    { key: 'person', header: 'Person', render: (r) => <PersonName id={r.person_id} /> },
    { key: 'metric', header: 'Metric', render: (r) => <span className="text-fg-subtle">{r.metric_name ?? '—'}</span> },
    { key: 'target', header: 'Target', align: 'right', sortable: true, sortValue: (r) => r.target ?? 0, render: (r) => <span className="text-fg-subtle">{formatValue(r.target, 'currency', currency)}</span> },
    { key: 'actual', header: 'Actual', align: 'right', sortable: true, sortValue: (r) => r.actual ?? 0, render: (r) => <span className="text-fg-subtle">{formatValue(r.actual, 'currency', currency)}</span> },
    { key: 'achievement', header: 'Achievement', sortable: true, sortValue: (r) => r.attainment ?? 0, render: (r) => (
      <div className="flex items-center gap-nb-2">
        <div className="w-24">
          <ProgressBar actual={r.actual} target={r.target} status={r.status ?? 'on_track'} compact />
        </div>
        <span className="text-xs text-fg-subtle">{formatPct(r.attainment)}</span>
      </div>
    ) },
    { key: 'projected', header: 'Projected', render: (r) => <span className="text-xs text-fg-subtle">{r.projection?.projectable ? formatPct(r.projection.projectedAttainment) : '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => r.status ? <StatusChip status={r.status} label={r.status_label} /> : <span className="text-xs text-fg-muted">—</span> },
  ];

  if (loading) {
    return (
      <DashboardPageTemplate title="Team Targets" filters={header}>
      <div className="space-y-4">
        <div className="text-sm text-fg-subtle">Loading team…</div>
      </div>
      </DashboardPageTemplate>
    );
  }
  if (error) {
    return (
      <DashboardPageTemplate title="Team Targets" filters={header}>
      <div className="space-y-4">
        <div className="text-sm text-danger">{error}</div>
      </div>
      </DashboardPageTemplate>
    );
  }
  if (!rows.length) {
    return (
      <DashboardPageTemplate title="Team Targets" filters={header}>
      <div className="space-y-4">
        <EmptyState message="No active individual target plans in this period." />
      </div>
      </DashboardPageTemplate>
    );
  }

  return (
    <DashboardPageTemplate title="Team Targets" filters={header}>
    <div className="space-y-5">
      <div>
        {totals && (
          <div className="mt-2 max-w-md">
            <div className="flex items-baseline justify-between text-xs text-fg-subtle">
              <span>
                {formatValue(totals.actual, 'currency', currency)} of{' '}
                {formatValue(totals.target, 'currency', currency)}
              </span>
              <span>{formatPct(totals.attainment)}</span>
            </div>
            <div className="mt-1">
              <ProgressBar
                actual={totals.actual}
                target={totals.target}
                status={
                  (totals.attainment ?? 0) >= 1 ? 'achieved' : 'on_track'
                }
                compact
              />
            </div>
          </div>
        )}
      </div>

      <Panel title="Attainment by person">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r: any) => r.person_id}
          onRowClick={(r: any) => openDetail(r.person_id)}
          getRowProps={(r: any) => ({ 'data-testid': `team-row-${r.person_id}` })}
        />
      </Panel>

      {selected && (
        <Panel
          title="Detail"
          action={
            <Button variant="secondary" size="sm"
              onClick={() => {
                setSelected(null);
                setDetail(null);
              }}
            >
              Close
            </Button>
          }
        >
          {!detail ? (
            <div className="text-sm text-fg-subtle">Loading…</div>
          ) : (
            <div className="space-y-3">
              {detail.metrics
                .filter((m: any) => !m.dimension_key)
                .map((m: any) => (
                  <div key={m.target_line_id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-fg">{m.metric_name}</span>
                      <span className="text-xs text-fg-subtle">
                        {formatValue(m.actual, m.unit, currency)} /{' '}
                        {formatValue(m.target, m.unit, currency)} ·{' '}
                        {formatPct(m.attainment)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar
                        actual={m.actual}
                        target={m.target}
                        status={m.status}
                        compact
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      )}
    </div>
    </DashboardPageTemplate>
  );
}
