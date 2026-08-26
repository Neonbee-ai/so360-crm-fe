import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import { EmptyState, Panel } from './targetUi';

/**
 * Reusable target templates.
 *
 * Onboarding a new sales hire otherwise means rebuilding the same plan by hand
 * each time. A template captures the shape once — metrics, ramp curve, weights
 * — so assigning it is: pick the person, pick the dates, adjust what differs.
 *
 * Assigning COPIES the lines. Editing a template later never reaches back into
 * plans already created from it: a rep's agreed target must not change because
 * somebody tidied up a template.
 */
export default function TargetTemplatesPage() {
  const shell = useShellBridge();
  const [templates, setTemplates] = useState<any[]>([]);
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [assigning, setAssigning] = useState<any | null>(null);
  const [ownerId, setOwnerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
      const [tpl, tt] = await Promise.all([
        targetPlanService.listTemplates(),
        salesTargetService.listTaskTypes().catch(() => []),
      ]);
      setTemplates(tpl);
      setTaskTypes(tt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async () => {
    if (!assigning || !ownerId || !startDate || !endDate) return;
    setBusy(true);
    setError(null);
    try {
      await targetPlanService.assignTemplate(assigning.id, {
        owner_id: ownerId,
        start_date: startDate,
        end_date: endDate,
      });
      setNotice(`Plan created from "${assigning.name}".`);
      setAssigning(null);
      setOwnerId('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string) =>
    taskTypes.find((t) => t.id === id)?.name ?? 'Metric';

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading templates…</div>;
  }

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-lg font-semibold text-slate-100">Target Templates</h1>

      {error && <div className="text-sm text-rose-300">{error}</div>}
      {notice && <div className="text-sm text-emerald-300">{notice}</div>}

      {!templates.length ? (
        <EmptyState message="No templates yet. A template captures a role's standard metrics and ramp so a new hire can be set up in one step." />
      ) : (
        <div className="flex flex-wrap gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 grow basis-80 max-w-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-100">
                    {t.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t.role ? `${t.role} · ` : ''}
                    {t.period} · {t.duration_periods} period
                    {t.duration_periods === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={() => setAssigning(t)}
                >
                  Assign
                </button>
              </div>

              {t.description && (
                <div className="mt-2 text-xs text-slate-400">
                  {t.description}
                </div>
              )}

              <div className="mt-3 space-y-1">
                {(t.lines ?? []).map((l: any) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-300">
                      {l.task_type?.name ?? nameOf(l.task_type_id)}
                      {l.dimension_value ? ` · ${l.dimension_value}` : ''}
                    </span>
                    <span className="text-slate-400">
                      {l.ramp && l.ramp.length
                        ? l.ramp.join(' → ')
                        : Number(l.value)}
                    </span>
                  </div>
                ))}
                {!(t.lines ?? []).length && (
                  <div className="text-xs text-slate-500">No lines</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {assigning && (
        <Panel
          title={`Assign "${assigning.name}"`}
          action={
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setAssigning(null)}
            >
              Cancel
            </button>
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Person id
              </label>
              <input
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="person uuid"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Start
              </label>
              <input
                type="date"
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">End</label>
              <input
                type="date"
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
              onClick={assign}
              disabled={busy || !ownerId || !startDate || !endDate}
            >
              {busy ? 'Creating…' : 'Create plan'}
            </button>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Lines are copied into the new plan. Editing this template later will
            not change the plan you create here.
          </div>
        </Panel>
      )}
    </div>
  );
}
