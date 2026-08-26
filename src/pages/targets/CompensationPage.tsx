import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { EmptyState, Panel, formatValue } from './targetUi';

/**
 * Incentive and commission review.
 *
 * ⚠ ADVISORY ONLY. Nothing on this screen or behind it writes to payroll,
 * triggers a payment, or marks anything payable — the figure exists for a
 * manager to read and approve.
 *
 * That boundary is deliberate. Part of the input can come from self-reported
 * manual channels, so an automated payout would be a materially different risk
 * from a number a human signs off. Manual channels are excluded from per-unit
 * bases by default for the same reason, and the basis line says so explicitly
 * when an exclusion applied.
 */
export default function CompensationPage() {
  const shell = useShellBridge();
  const [rules, setRules] = useState<any[]>([]);
  const [calc, setCalc] = useState<any | null>(null);
  const [personId, setPersonId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
    targetPlanService
      .listIncentiveRules()
      .then(setRules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // Default to the current calendar month, which is the period a manager
    // almost always wants first.
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setPeriodStart(first.toISOString().slice(0, 10));
    setPeriodEnd(last.toISOString().slice(0, 10));
  }, [load]);

  const calculate = async () => {
    if (!personId || !periodStart || !periodEnd) return;
    setBusy(true);
    setError(null);
    try {
      setCalc(
        await targetPlanService.calculateIncentives(
          personId,
          periodStart,
          periodEnd,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Compensation</h1>
        <div className="mt-1 text-xs text-amber-300">
          ⚠ For manager review only. No payroll or payment action is taken.
        </div>
      </div>

      {error && <div className="text-sm text-rose-300">{error}</div>}

      <Panel title="Calculate">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Person id
            </label>
            <input
              className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              placeholder="person uuid"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">From</label>
            <input
              type="date"
              className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">To</label>
            <input
              type="date"
              className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          <button
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
            onClick={calculate}
            disabled={busy || !personId}
          >
            {busy ? 'Calculating…' : 'Calculate'}
          </button>
        </div>
      </Panel>

      {calc && (
        <Panel title="Incentive summary">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-4 font-medium">Component</th>
                  <th className="py-2 pr-4 font-medium">Basis</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {calc.components?.map((c: any) => (
                  <tr key={c.rule_id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-4 text-slate-200">{c.rule_name}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">
                      {c.basis}
                      {!c.eligible && (
                        <span className="text-slate-500"> — not eligible</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-slate-200">
                      {formatValue(c.amount, 'currency', currency)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pr-4 font-medium text-slate-100">
                    Total calculated
                  </td>
                  <td />
                  <td className="py-2 text-right font-medium text-slate-100">
                    {formatValue(calc.total_amount, 'currency', currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-[11px] text-amber-300">
            {calc.advisory_notice}
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Loading rules…</div>
      ) : !rules.length ? (
        <EmptyState message="No incentive rules configured." />
      ) : (
        <Panel title="Rules">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Trigger</th>
                  <th className="py-2 font-medium">Scope</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-4 text-slate-200">{r.name}</td>
                    <td className="py-2 pr-4 text-slate-400">{r.rule_type}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">
                      {r.rule_type === 'attainment_bonus' &&
                        `at ${Math.round(Number(r.attainment_threshold ?? 1) * 100)}% attainment`}
                      {r.rule_type === 'per_unit' &&
                        `${formatValue(r.amount, 'currency', currency)} per unit`}
                      {r.rule_type === 'deal_commission' &&
                        `${(r.bands ?? []).length} band${(r.bands ?? []).length === 1 ? '' : 's'}`}
                    </td>
                    <td className="py-2 text-slate-400 text-xs">
                      {r.applies_to_person_id
                        ? 'one person'
                        : r.applies_to_role
                          ? r.applies_to_role
                          : 'all'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
