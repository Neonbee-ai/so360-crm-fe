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
} from './targetUi';

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
      const today = new Date().toISOString().slice(0, 10);
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
      const res = await targetPlanService.teamScorecard(personIds);
      setRows(res.rows ?? []);
      setTotals(res.totals ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (personId: string) => {
    setSelected(personId);
    setDetail(null);
    try {
      setDetail(await targetPlanService.overviewFor(personId));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading team…</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-rose-300">{error}</div>;
  }
  if (!rows.length) {
    return (
      <div className="p-6">
        <EmptyState message="No active individual target plans in this period." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Team Targets</h1>
        {totals && (
          <div className="mt-2 max-w-md">
            <div className="flex items-baseline justify-between text-xs text-slate-400">
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-4 font-medium">Person</th>
                <th className="py-2 pr-4 font-medium">Metric</th>
                <th className="py-2 pr-4 font-medium text-right">Target</th>
                <th className="py-2 pr-4 font-medium text-right">Actual</th>
                <th className="py-2 pr-4 font-medium">Achievement</th>
                <th className="py-2 pr-4 font-medium">Projected</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.person_id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer"
                  onClick={() => openDetail(r.person_id)}
                >
                  <td className="py-2 pr-4 text-slate-200">
                    <PersonName id={r.person_id} />
                  </td>
                  <td className="py-2 pr-4 text-slate-400">
                    {r.metric_name ?? '—'}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-300">
                    {formatValue(r.target, 'currency', currency)}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-300">
                    {formatValue(r.actual, 'currency', currency)}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <ProgressBar
                          actual={r.actual}
                          target={r.target}
                          status={r.status ?? 'on_track'}
                          compact
                        />
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatPct(r.attainment)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-400">
                    {r.projection?.projectable
                      ? formatPct(r.projection.projectedAttainment)
                      : '—'}
                  </td>
                  <td className="py-2">
                    {r.status ? (
                      <StatusChip status={r.status} label={r.status_label} />
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected && (
        <Panel
          title="Detail"
          action={
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => {
                setSelected(null);
                setDetail(null);
              }}
            >
              Close
            </button>
          }
        >
          {!detail ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="space-y-3">
              {detail.metrics
                .filter((m: any) => !m.dimension_key)
                .map((m: any) => (
                  <div key={m.target_line_id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-200">{m.metric_name}</span>
                      <span className="text-xs text-slate-400">
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
  );
}
