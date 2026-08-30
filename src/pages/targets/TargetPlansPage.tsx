import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import { EmptyState, Panel, PersonName, PersonPicker, formatValue } from './targetUi';

type Period = 'week' | 'month' | 'quarter' | 'year';

interface DraftLine {
  key: string;
  task_type_id: string;
  value: number;
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

  const [name, setName] = useState('');
  const [ownerType, setOwnerType] = useState<'rep' | 'team' | 'org'>('rep');
  const [ownerId, setOwnerId] = useState('');
  const [role, setRole] = useState('');
  const [period, setPeriod] = useState<Period>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [lines, setLines] = useState<DraftLine[]>([]);

  const currency = (shell as any)?.businessSettings?.currency ?? undefined;

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

  const addLine = () => {
    setLines((l) => [
      ...l,
      {
        key: `${Date.now()}-${l.length}`,
        task_type_id: taskTypes[0]?.id ?? '',
        value: 0,
        useRamp: false,
        ramp: [],
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  };

  const removeLine = (key: string) => {
    setLines((l) => l.filter((x) => x.key !== key));
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await targetPlanService.createPlan({
        name,
        owner_type: ownerType,
        owner_id: ownerId || undefined,
        role: role || undefined,
        period,
        start_date: startDate,
        end_date: endDate,
        priority,
        status: 'active',
        lines: lines.map((l) => ({
          task_type_id: l.task_type_id,
          value: l.value,
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

  const canSubmit =
    name.trim().length > 0 &&
    startDate &&
    endDate &&
    lines.length > 0 &&
    lines.every((l) => l.task_type_id);

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
              <Field label="Owner" grow>
                <PersonPicker value={ownerId} onChange={setOwnerId} />
              </Field>
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

            <div className="border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Target lines</span>
                <button
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={addLine}
                  disabled={!taskTypes.length}
                >
                  + Add metric
                </button>
              </div>

              {!taskTypes.length && (
                <div className="text-xs text-amber-300">
                  No metrics configured yet. Provision an industry pack or add a
                  task type first.
                </div>
              )}

              <div className="space-y-3">
                {lines.map((l) => (
                  <div
                    key={l.key}
                    className="rounded border border-slate-800 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-end gap-3">
                      <Field label="Metric" grow>
                        <select
                          className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
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
                      </Field>
                      <Field label="Target">
                        <input
                          type="number"
                          className="w-28 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                          value={l.value}
                          onChange={(e) =>
                            updateLine(l.key, { value: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field label="Channel slice">
                        <select
                          className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                          value={l.dimension_value ?? ''}
                          onChange={(e) =>
                            updateLine(l.key, {
                              dimension_key: e.target.value ? 'channel' : undefined,
                              dimension_value: e.target.value || undefined,
                            })
                          }
                        >
                          <option value="">Roll-up (all channels)</option>
                          {channels.map((c) => (
                            <option key={c.id} value={c.value}>
                              {c.label}
                              {c.actuals_source === 'manual' ? ' (manual)' : ''}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={l.useRamp}
                          onChange={(e) =>
                            updateLine(l.key, { useRamp: e.target.checked })
                          }
                        />
                        Ramp
                      </label>
                      <button
                        className="text-xs text-rose-300 hover:text-rose-200"
                        onClick={() => removeLine(l.key)}
                      >
                        Remove
                      </button>
                    </div>

                    {l.useRamp && (
                      <div>
                        <label className="text-[11px] text-slate-400">
                          Per-period curve (comma separated). A shorter list
                          holds its last value for the rest of the plan.
                        </label>
                        <input
                          className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                          placeholder="30, 40, 50, 60"
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
                    )}
                  </div>
                ))}
              </div>
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
                  <th className="py-2 font-medium">Status</th>
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
                    <td className="py-2 text-slate-300">{p.status}</td>
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
