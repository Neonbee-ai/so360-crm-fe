import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import { EmptyState, Panel, PersonName, PersonPicker, formatValue } from './targetUi';
import {
  EMPTY_INCENTIVE_RULE,
  buildIncentiveRulePayload,
  type IncentiveRuleForm,
  type IncentiveRuleType,
} from './incentiveRule';

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
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [form, setForm] = useState<IncentiveRuleForm>(EMPTY_INCENTIVE_RULE);

  // `base_currency` is the field Core actually returns on business_settings.
  // Reading `currency` yielded undefined, so every money figure on these
  // screens formatted as USD regardless of the org's configured currency.
  const currency = (shell as any)?.businessSettings?.base_currency ?? undefined;

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      targetPlanService.setTenantId(shell.currentTenant.id);
      targetPlanService.setOrgId(shell.currentOrg?.id ?? '');
      targetPlanService.setAccessToken(shell.accessToken ?? '');
      salesTargetService.setTenantId(shell.currentTenant.id);
      salesTargetService.setOrgId(shell.currentOrg?.id ?? '');
      salesTargetService.setAccessToken(shell.accessToken ?? '');
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  // Attainment and per-unit rules watch a configured metric, so the picker has
  // to offer the org's real metric list rather than a free-text id.
  useEffect(() => {
    salesTargetService
      .listTaskTypes()
      .then((rows) => setTaskTypes(Array.isArray(rows) ? rows : []))
      .catch(() => setTaskTypes([]));
  }, []);

  const saveRule = async () => {
    const built = buildIncentiveRulePayload(form);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await targetPlanService.createIncentiveRule(built.payload);
      setForm(EMPTY_INCENTIVE_RULE);
      setShowRuleForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

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
          <div className="min-w-64">
            <label className="block text-[11px] text-slate-400 mb-1">
              Person
            </label>
            <PersonPicker value={personId} onChange={setPersonId} />
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

      <Panel
        title="New rule"
        action={
          <button
            className="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setShowRuleForm((v) => !v)}
          >
            {showRuleForm ? 'Cancel' : 'Add rule'}
          </button>
        }
      >
        {!showRuleForm ? (
          <div className="text-xs text-slate-500">
            Rules are read during calculation only. Adding one never pays
            anyone.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grow basis-64">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Name
                </label>
                <input
                  aria-label="Rule name"
                  className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Q3 new-business bonus"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Type
                </label>
                <select
                  aria-label="Rule type"
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={form.rule_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rule_type: e.target.value as IncentiveRuleType,
                    })
                  }
                >
                  <option value="attainment_bonus">
                    Bonus at attainment
                  </option>
                  <option value="per_unit">Per unit of a metric</option>
                  <option value="deal_commission">Deal commission</option>
                </select>
              </div>

              {form.rule_type !== 'deal_commission' && (
                <>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Metric
                    </label>
                    <select
                      aria-label="Metric"
                      className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                      value={form.task_type_id}
                      onChange={(e) =>
                        setForm({ ...form, task_type_id: e.target.value })
                      }
                    >
                      <option value="">Select…</option>
                      {taskTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Amount
                    </label>
                    <input
                      aria-label="Amount"
                      className="w-32 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {form.rule_type === 'attainment_bonus' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    At attainment (%)
                  </label>
                  <input
                    aria-label="Attainment threshold"
                    className="w-24 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                    value={form.attainment_threshold_pct}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        attainment_threshold_pct: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>

            {form.rule_type === 'deal_commission' && (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400">
                  Bands by deal value. Leave the top band&apos;s maximum empty
                  so the largest deals still earn commission.
                </div>
                {form.bands.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      aria-label={`Band ${i + 1} minimum`}
                      className="w-28 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                      placeholder="min"
                      value={b.min}
                      onChange={(e) => {
                        const bands = [...form.bands];
                        bands[i] = { ...b, min: e.target.value };
                        setForm({ ...form, bands });
                      }}
                    />
                    <input
                      aria-label={`Band ${i + 1} maximum`}
                      className="w-28 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                      placeholder="max (open)"
                      value={b.max}
                      onChange={(e) => {
                        const bands = [...form.bands];
                        bands[i] = { ...b, max: e.target.value };
                        setForm({ ...form, bands });
                      }}
                    />
                    <input
                      aria-label={`Band ${i + 1} percent`}
                      className="w-24 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                      placeholder="%"
                      value={b.percent}
                      onChange={(e) => {
                        const bands = [...form.bands];
                        bands[i] = { ...b, percent: e.target.value };
                        setForm({ ...form, bands });
                      }}
                    />
                    {form.bands.length > 1 && (
                      <button
                        className="text-xs text-slate-500 hover:text-slate-300"
                        aria-label={`Remove band ${i + 1}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            bands: form.bands.filter((_, j) => j !== i),
                          })
                        }
                      >
                        remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={() =>
                    setForm({
                      ...form,
                      bands: [...form.bands, { min: '', max: '', percent: '' }],
                    })
                  }
                >
                  + band
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Applies to
                </label>
                <select
                  aria-label="Scope"
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={form.scope}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      scope: e.target.value as IncentiveRuleForm['scope'],
                    })
                  }
                >
                  <option value="all">Everyone</option>
                  <option value="role">A role</option>
                  <option value="person">One person</option>
                </select>
              </div>
              {form.scope === 'role' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Role
                  </label>
                  <input
                    aria-label="Role"
                    className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                    value={form.applies_to_role}
                    onChange={(e) =>
                      setForm({ ...form, applies_to_role: e.target.value })
                    }
                  />
                </div>
              )}
              {form.scope === 'person' && (
                <div className="min-w-64">
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Person
                  </label>
                  <PersonPicker
                    value={form.applies_to_person_id}
                    onChange={(id) =>
                      setForm({ ...form, applies_to_person_id: id })
                    }
                  />
                </div>
              )}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  From
                </label>
                <input
                  type="date"
                  aria-label="Effective from"
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={form.effective_from}
                  onChange={(e) =>
                    setForm({ ...form, effective_from: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  To
                </label>
                <input
                  type="date"
                  aria-label="Effective to"
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={form.effective_to}
                  onChange={(e) =>
                    setForm({ ...form, effective_to: e.target.value })
                  }
                />
              </div>
              <button
                className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                onClick={saveRule}
                disabled={busy}
              >
                Save rule
              </button>
            </div>
          </div>
        )}
      </Panel>

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
                      {r.applies_to_person_id ? (
                        <PersonName id={r.applies_to_person_id} />
                      ) : r.applies_to_role ? (
                        r.applies_to_role
                      ) : (
                        'all'
                      )}
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
