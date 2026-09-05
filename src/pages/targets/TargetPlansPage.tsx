import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { Copy, Trash2, Plus, Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import { EmptyState, Panel, PersonName, PersonPicker, formatValue } from './targetUi';
import AllocateTeamPlanPanel from './AllocateTeamPlanPanel';
import EditPlanPanel from './EditPlanPanel';

type Period = 'week' | 'month' | 'quarter' | 'year';

interface DraftLine {
  key: string;
  task_type_id: string;
  value: number;
  weight: number;
  useRamp: boolean;
  ramp: number[];
  dimension_key?: string;
  dimension_value?: string;
}

/**
 * Admin plan builder.
 *
 * Ramp is expressed as a per-period curve on ONE plan — never as a sequence of
 * plans — so the plan keeps a single goal link and a continuous attainment
 * history when a rep finishes ramping.
 */
export default function TargetPlansPage() {
  const shell = useShellBridge();
  const [plans, setPlans] = useState<any[]>([]);
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [allocating, setAllocating] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [ownerType, setOwnerType] = useState<'rep' | 'team' | 'org'>('rep');
  const [ownerId, setOwnerId] = useState('');
  const [role, setRole] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [lines, setLines] = useState<DraftLine[]>([]);

  // Custom metric modal state
  const [showCustomMetricModal, setShowCustomMetricModal] = useState(false);
  const [customMetricName, setCustomMetricName] = useState('');
  const [customMetricKind, setCustomMetricKind] = useState<'COUNT' | 'SUM' | 'TOUCHPOINT'>('COUNT');
  const [customMetricUnit, setCustomMetricUnit] = useState('count');
  const [customMetricSaving, setCustomMetricSaving] = useState(false);

  // `base_currency` is the field Core actually returns on business_settings.
  // Reading `currency` yielded undefined, so every money figure on these
  // screens formatted as USD regardless of the org's configured currency.
  const currency = (shell as any)?.businessSettings?.base_currency ?? undefined;

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      const t = shell.currentTenant.id;
      const o = shell.currentOrg?.id ?? '';
      const a = shell.accessToken ?? '';
      targetPlanService.setTenantId(t);
      targetPlanService.setOrgId(o);
      targetPlanService.setAccessToken(a);
      salesTargetService.setTenantId(t);
      salesTargetService.setOrgId(o);
      salesTargetService.setAccessToken(a);
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, tt, ch] = await Promise.all([
        targetPlanService.listPlans(),
        salesTargetService.listTaskTypes(),
        targetPlanService.listChannels().catch(() => []),
      ]);
      setPlans(p);
      setTaskTypes(tt);
      setChannels(ch);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Copies the industry metric/channel/loss-reason pack into this org.
   *
   * Until this has run the org has no metrics, so a plan cannot be built and
   * every screen is empty for a reason nothing on the page explains. It is
   * idempotent — existing metrics are matched by name and skipped — so the
   * button is safe to press twice.
   */
  const provision = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await targetPlanService.provisionPacks(
        (shell as any)?.industryKey || undefined,
      );
      setNotice(
        `Added ${res.metrics_added} metrics, ${res.channels_added} channels and ${res.loss_reasons_added} loss reasons for ${res.industry_key}.`,
      );
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addLine = () => {
    setLines((l) => [
      ...l,
      {
        key: `${Date.now()}-${l.length}`,
        task_type_id: taskTypes[0]?.id ?? '',
        value: 0,
        weight: l.length === 0 ? 100 : 0,
        useRamp: false,
        ramp: [],
      },
    ]);
  };

  const duplicateLine = (line: DraftLine) => {
    setLines((l) => [
      ...l,
      {
        ...line,
        key: `${Date.now()}-${l.length}`,
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  };

  const removeLine = (key: string) => {
    setLines((l) => l.filter((x) => x.key !== key));
  };

  const handleCreateCustomMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMetricName.trim()) return;
    setCustomMetricSaving(true);
    setError(null);
    try {
      const created = await salesTargetService.createTaskType({
        name: customMetricName.trim(),
        kind: customMetricKind,
        unit: customMetricUnit.trim() || 'count',
        description: `Custom ${customMetricKind} metric`,
      });
      const updatedTypes = await salesTargetService.listTaskTypes();
      setTaskTypes(updatedTypes);
      const newId = created?.id || updatedTypes[updatedTypes.length - 1]?.id;
      if (newId) {
        setLines((l) => [
          ...l,
          {
            key: `${Date.now()}-${l.length}`,
            task_type_id: newId,
            value: 0,
            weight: l.length === 0 ? 100 : 0,
            useRamp: false,
            ramp: [],
          },
        ]);
      }
      setShowCustomMetricModal(false);
      setCustomMetricName('');
      setCustomMetricUnit('count');
    } catch (e: any) {
      setError(e?.message || 'Failed to create custom metric');
    } finally {
      setCustomMetricSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await targetPlanService.createPlan({
        name,
        owner_type: ownerType,
        // Only an individual plan carries a person. Sending a stale owner_id
        // after switching the type to team or org would attach the whole
        // team's plan to one person.
        owner_id: ownerType === 'rep' ? ownerId || undefined : undefined,
        role: role || undefined,
        period,
        start_date: startDate,
        end_date: endDate,
        priority,
        status: 'active',
        lines: lines.map((l) => ({
          task_type_id: l.task_type_id,
          value: l.value,
          weight: l.weight,
          ramp: l.useRamp && l.ramp.length ? l.ramp : undefined,
          dimension_key: l.dimension_key || undefined,
          dimension_value: l.dimension_value || undefined,
        })),
      });
      setShowForm(false);
      setName('');
      setLines([]);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = lines.reduce((sum, l) => sum + (Number(l.weight) || 0), 0);
  const isWeightValid = lines.length === 0 || Math.abs(totalWeight - 100) < 0.001;

  const canSubmit =
    name.trim().length > 0 &&
    startDate &&
    endDate &&
    lines.length > 0 &&
    lines.every((l) => l.task_type_id) &&
    isWeightValid;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">Target Plans</h1>
        <button
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? 'Cancel' : 'New plan'}
        </button>
      </div>

      {error && <div className="text-sm text-rose-300">{error}</div>}
      {notice && <div className="text-sm text-emerald-300">{notice}</div>}

      {!loading && !taskTypes.length && (
        <Panel title="Set up your metrics first">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-400">
              This organisation has no metrics yet, so a plan cannot be built
              and every Targets screen will be empty. Load the starter set for
              your industry — metrics, touchpoint channels and loss reasons.
              Nothing existing is overwritten.
            </div>
            <button
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
              onClick={provision}
              disabled={saving}
            >
              Load starter metrics
            </button>
          </div>
        </Panel>
      )}

      {editing && (
        <EditPlanPanel
          planId={editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {allocating && (
        <AllocateTeamPlanPanel
          planId={allocating}
          currency={currency}
          onClose={() => setAllocating(null)}
          onAllocated={load}
        />
      )}

      {showForm && (
        <Panel title="New target plan">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Field label="Plan name" grow>
                <input
                  className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sales Intern — Sep–Dec 2026"
                />
              </Field>
              <Field label="Assign to">
                <select
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={ownerType}
                  onChange={(e) => setOwnerType(e.target.value as any)}
                >
                  <option value="rep">Individual</option>
                  <option value="team">Team</option>
                  <option value="org">Organisation</option>
                </select>
              </Field>
              {/* Only an individual plan has a person owner. A team plan is
                  owned by the team and then allocated to its members from the
                  plans list, which is what creates each person's own plan; an
                  org plan has no owner at all. Showing a person picker for
                  those two invited a meaningless selection. */}
              {ownerType === 'rep' ? (
                <Field label="Owner" grow>
                  <PersonPicker value={ownerId} onChange={setOwnerId} />
                </Field>
              ) : (
                <Field label="Owner" grow>
                  <div className="px-2 py-1.5 text-sm text-slate-400">
                    {ownerType === 'team'
                      ? 'The team as a whole. Allocate it to people after saving.'
                      : 'The whole organisation.'}
                  </div>
                </Field>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <Field label="Role">
                <input
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </Field>
              <Field label="Period">
                <select
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                >
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="quarter">Quarterly</option>
                  <option value="year">Annual</option>
                </select>
              </Field>
              <Field label="Priority">
                <select
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </Field>
              <Field label="Start">
                <input
                  type="date"
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="End">
                <input
                  type="date"
                  className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            </div>

            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-sm font-medium text-slate-200">Target Metrics & Weights</span>
                  <p className="text-[11px] text-slate-400">
                    Define measurable target lines with period quotas and weight distributions. Weights must sum to 100%.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all"
                    onClick={() => setShowCustomMetricModal(true)}
                  >
                    <Sparkles size={12} className="text-amber-400" /> + Custom Metric
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-sm"
                    onClick={addLine}
                    disabled={!taskTypes.length}
                  >
                    <Plus size={12} /> Add Metric Row
                  </button>
                </div>
              </div>

              {!taskTypes.length && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                  No metrics configured yet. Click "Load starter metrics" above, add a task type, or click "+ Custom Metric" to begin.
                </div>
              )}

              {lines.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                  <p className="text-xs text-slate-400">No target lines added yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Click "Add Metric Row" to configure quotas for this plan.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Metric</th>
                        <th className="py-2.5 px-3 w-28">Unit</th>
                        <th className="py-2.5 px-3 w-32 text-right">Target Value</th>
                        <th className="py-2.5 px-3 w-32 text-right">Weight (%)</th>
                        <th className="py-2.5 px-3 min-w-[170px]">Channel / Dimension</th>
                        <th className="py-2.5 px-3 w-16 text-center">Ramp</th>
                        <th className="py-2.5 px-3 w-20 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {lines.map((l, idx) => {
                        const metric = taskTypes.find((t) => t.id === l.task_type_id);
                        const isTouchpoint = metric?.kind === 'TOUCHPOINT';
                        return (
                          <React.Fragment key={l.key}>
                            <tr className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <select
                                  className="w-full rounded bg-slate-800 border border-slate-700/80 px-2 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                                  value={l.task_type_id}
                                  onChange={(e) =>
                                    updateLine(l.key, { task_type_id: e.target.value })
                                  }
                                >
                                  {taskTypes.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700/70 text-[11px] text-slate-300 font-mono truncate max-w-[110px]">
                                  {metric?.unit || metric?.kind || 'count'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="w-full rounded bg-slate-800 border border-slate-700/80 px-2 py-1.5 text-xs text-slate-100 text-right font-mono focus:border-blue-500 focus:outline-none"
                                  value={l.value}
                                  onChange={(e) =>
                                    updateLine(l.key, { value: Number(e.target.value) })
                                  }
                                />
                              </td>
                              <td className="py-2 px-3">
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="any"
                                    className="w-full rounded bg-slate-800 border border-slate-700/80 pl-2 pr-5 py-1.5 text-xs text-slate-100 text-right font-mono focus:border-blue-500 focus:outline-none"
                                    value={l.weight ?? 0}
                                    onChange={(e) =>
                                      updateLine(l.key, { weight: Number(e.target.value) })
                                    }
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] pointer-events-none">%</span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                {isTouchpoint ? (
                                  <select
                                    className="w-full rounded bg-slate-800 border border-slate-700/80 px-2 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                                    value={l.dimension_value ?? ''}
                                    onChange={(e) =>
                                      updateLine(l.key, {
                                        dimension_key: e.target.value ? 'channel' : undefined,
                                        dimension_value: e.target.value || undefined,
                                      })
                                    }
                                  >
                                    <option value="">All channels (Roll-up)</option>
                                    {channels.map((c) => (
                                      <option key={c.id} value={c.value}>
                                        {c.label} {c.actuals_source === 'manual' ? '(manual)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[11px] text-slate-500 italic px-1">All Channels / N/A</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                                  checked={l.useRamp}
                                  onChange={(e) =>
                                    updateLine(l.key, { useRamp: e.target.checked })
                                  }
                                  title="Enable stepped ramp curve"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => duplicateLine(l)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                                    title="Duplicate row"
                                  >
                                    <Copy size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeLine(l.key)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                                    title="Remove line"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {l.useRamp && (
                              <tr className="bg-slate-900/90 border-b border-slate-800/80">
                                <td colSpan={8} className="px-4 py-2 text-xs">
                                  <div className="flex items-center gap-3">
                                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Ramp Curve:</span>
                                    <input
                                      className="flex-1 rounded bg-slate-800 border border-slate-700/80 px-2.5 py-1 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                                      placeholder="e.g. 20, 35, 50, 75 (comma-separated values per period)"
                                      value={l.ramp.join(', ')}
                                      onChange={(e) =>
                                        updateLine(l.key, {
                                          ramp: e.target.value
                                            .split(',')
                                            .map((s) => Number(s.trim()))
                                            .filter((n) => Number.isFinite(n)),
                                        })
                                      }
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-800 bg-slate-800/40 text-xs font-semibold">
                        <td colSpan={3} className="py-2.5 px-3 text-slate-400">
                          Total Lines: <span className="text-slate-200">{lines.length}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                          {lines.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              isWeightValid
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {totalWeight.toFixed(1)}% {isWeightValid ? '✓ 100% Valid' : '⚠ Sum to 100%'}
                          </span>
                        </td>
                        <td colSpan={3} className="py-2.5 px-3 text-slate-500 text-right text-[11px]">
                          {!isWeightValid && 'Total line weights must equal 100% to save'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                className="rounded bg-slate-700 px-4 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                disabled={!canSubmit || saving}
                onClick={submit}
              >
                {saving ? 'Saving…' : 'Save plan'}
              </button>
            </div>
          </div>
        </Panel>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Loading plans…</div>
      ) : !plans.length ? (
        <EmptyState message="No target plans yet." />
      ) : (
        <Panel title="Plans">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Owner</th>
                  <th className="py-2 pr-4 font-medium">Period</th>
                  <th className="py-2 pr-4 font-medium">Window</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-4 text-slate-200">{p.name}</td>
                    <td className="py-2 pr-4 text-slate-400">
                      {p.owner_type}
                      {p.owner_id ? (
                        <>
                          {' · '}
                          <PersonName id={p.owner_id} />
                        </>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">{p.period}</td>
                    <td className="py-2 pr-4 text-slate-400">
                      {p.start_date} → {p.end_date}
                    </td>
                    <td className="py-2 pr-4 text-slate-300">{p.status}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          className="text-xs text-slate-400 hover:text-slate-200"
                          onClick={() => setEditing(p.id)}
                        >
                          Edit
                        </button>
                        {p.owner_type === 'team' && (
                          <button
                            className="text-xs text-slate-400 hover:text-slate-200"
                            onClick={() => setAllocating(p.id)}
                          >
                            Allocate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {showCustomMetricModal && (
        <Modal
          isOpen={showCustomMetricModal}
          onClose={() => setShowCustomMetricModal(false)}
          title="Create Custom Metric"
          size="md"
        >
          <form onSubmit={handleCreateCustomMetric} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Metric Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="e.g. Enterprise Demos Held, Referral Introductions"
                value={customMetricName}
                onChange={(e) => setCustomMetricName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Metric Type / Kind
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'COUNT', label: 'Count', desc: 'Number of occurrences' },
                  { value: 'SUM', label: 'Sum / Value', desc: 'Financial or numeric total' },
                  { value: 'TOUCHPOINT', label: 'Touchpoint', desc: 'Multi-channel interactions' },
                ].map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => {
                      setCustomMetricKind(k.value as any);
                      if (k.value === 'SUM') setCustomMetricUnit('currency');
                      else if (k.value === 'COUNT') setCustomMetricUnit('count');
                      else if (k.value === 'TOUCHPOINT') setCustomMetricUnit('touchpoints');
                    }}
                    className={`flex flex-col p-2.5 rounded-lg border text-left text-xs transition-colors ${
                      customMetricKind === k.value
                        ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                        : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-semibold text-slate-200">{k.label}</span>
                    <span className="text-[10px] mt-0.5 text-slate-400">{k.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Measurement Unit
              </label>
              <input
                type="text"
                className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono"
                placeholder="count, currency, hours, calls, etc."
                value={customMetricUnit}
                onChange={(e) => setCustomMetricUnit(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCustomMetricModal(false)}
                className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!customMetricName.trim() || customMetricSaving}
                className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1.5"
              >
                {customMetricSaving && <Loader2 size={12} className="animate-spin" />}
                Create & Add to Plan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div className={grow ? 'grow basis-64' : ''}>
      <label className="block text-[11px] text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
