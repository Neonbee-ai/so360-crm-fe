import React, { useEffect, useState } from 'react';
import { targetPlanService } from '../../services/targetPlanService';
import { Panel } from './targetUi';
import { planPeriods } from './planShape';

/**
 * Edits an existing plan.
 *
 * Dates are deliberately NOT editable. A plan's window defines its period
 * buckets and the snapshots already written against them; moving it would
 * leave stored history attributed to a window that no longer exists. To change
 * the window you end this plan and start another, which is also the only
 * honest way to show the change on a trend.
 *
 * Everything here is audited — the backend records a revision for each changed
 * field — so `change_reason` is offered rather than hidden. A re-baselined
 * target with no stated reason is indistinguishable from a mistake.
 */
export default function EditPlanPanel({
  planId,
  onClose,
  onSaved,
}: {
  planId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    role: '',
    category: '',
    priority: 'medium',
    status: 'active',
    notes: '',
    change_reason: '',
  });
  const [periodEdits, setPeriodEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    targetPlanService
      .getPlan(planId)
      .then((p) => {
        if (!alive) return;
        setPlan(p);
        setForm({
          name: p.name ?? '',
          role: p.role ?? '',
          category: p.category ?? '',
          priority: p.priority ?? 'medium',
          status: p.status ?? 'active',
          notes: p.notes ?? '',
          change_reason: '',
        });
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [planId]);

  const save = async () => {
    if (!form.name.trim()) {
      setError('A plan needs a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await targetPlanService.updatePlan(planId, {
        name: form.name.trim(),
        role: form.role.trim() || undefined,
        category: form.category.trim() || undefined,
        priority: form.priority,
        status: form.status,
        notes: form.notes.trim() || undefined,
        change_reason: form.change_reason.trim() || undefined,
      });

      // Period edits go through their own audited endpoint, one bucket at a
      // time, so a partial failure leaves the rest applied rather than
      // silently rolling back numbers the manager believes they saved.
      const edits = Object.entries(periodEdits).filter(
        ([, v]) => v.trim() !== '',
      );
      for (const [periodId, raw] of edits) {
        const target_value = Number(raw);
        if (!Number.isFinite(target_value) || target_value < 0) {
          throw new Error('Period targets must be zero or more.');
        }
        await targetPlanService.updatePeriodValue(periodId, {
          target_value,
          change_reason: form.change_reason.trim() || undefined,
        });
      }

      setNotice(
        edits.length
          ? `Saved, including ${edits.length} period target${edits.length === 1 ? '' : 's'}.`
          : 'Saved.',
      );
      setPeriodEdits({});
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Flattened from lines[].periods — the endpoint returns no top-level
  // `plan.periods`, so reading that rendered an empty section with no error.
  const periods = planPeriods(plan);

  return (
    <Panel
      title={plan ? `Edit · ${plan.name}` : 'Edit plan'}
      action={
        <button
          className="text-xs text-slate-400 hover:text-slate-200"
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      {error && <div className="mb-2 text-sm text-rose-300">{error}</div>}
      {notice && <div className="mb-2 text-sm text-emerald-300">{notice}</div>}

      {!plan ? (
        <div className="text-sm text-slate-400">Loading plan…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grow basis-64">
              <label className="block text-[11px] text-slate-400 mb-1">
                Name
              </label>
              <input
                aria-label="Plan name"
                className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Priority
              </label>
              <select
                aria-label="Priority"
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Status
              </label>
              <select
                aria-label="Status"
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Role
              </label>
              <input
                aria-label="Role"
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </div>
          </div>

          <div className="text-xs text-slate-500">
            {plan.start_date} → {plan.end_date} · {plan.period}. The window is
            fixed: history is already recorded against these buckets, so moving
            it would leave stored numbers attributed to a period that no longer
            exists. End this plan and start another instead.
          </div>

          {periods.length > 0 && (
            <div className="border-t border-slate-800 pt-3">
              <div className="mb-2 text-sm text-slate-300">Period targets</div>
              <div className="space-y-2">
                {periods.map((pr) => (
                  <div key={pr.id} className="flex items-center gap-2">
                    <span className="w-64 shrink-0 text-xs text-slate-400">
                      <span className="text-slate-300">{pr.lineLabel}</span>{' '}
                      {pr.period_start} → {pr.period_end}
                    </span>
                    <input
                      aria-label={`Target for ${pr.period_start}`}
                      className="w-32 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                      placeholder={String(pr.target_value ?? '')}
                      value={periodEdits[pr.id] ?? ''}
                      onChange={(e) =>
                        setPeriodEdits({
                          ...periodEdits,
                          [pr.id]: e.target.value,
                        })
                      }
                    />
                    <span className="text-xs text-slate-500">
                      currently {pr.target_value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Leave a box empty to keep its current target. Every change is
                recorded as a revision.
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 border-t border-slate-800 pt-3">
            <div className="grow basis-64">
              <label className="block text-[11px] text-slate-400 mb-1">
                Reason for the change
              </label>
              <input
                aria-label="Change reason"
                className="w-full rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                placeholder="Territory reassigned mid-quarter"
                value={form.change_reason}
                onChange={(e) =>
                  setForm({ ...form, change_reason: e.target.value })
                }
              />
            </div>
            <button
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
              onClick={save}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
