import React, { useEffect, useState } from 'react';
import { targetPlanService } from '../../services/targetPlanService';
import { Panel, PersonPicker, formatValue } from './targetUi';
import {
  buildAllocationEntries,
  summariseAllocation,
  type AllocationRow,
} from './allocation';

/**
 * Splits a team plan across its members.
 *
 * Each row becomes a real child plan owned by that person, which is why the
 * team target is shown alongside the running total: the manager is committing
 * individuals to numbers, not filling in a form. Over-allocation is displayed
 * but never blocked — teams routinely plan above target on purpose.
 */
export default function AllocateTeamPlanPanel({
  planId,
  currency,
  onClose,
  onAllocated,
}: {
  planId: string;
  currency?: string;
  onClose: () => void;
  onAllocated: () => void;
}) {
  const [plan, setPlan] = useState<any | null>(null);
  const [taskTypeId, setTaskTypeId] = useState('');
  const [rows, setRows] = useState<AllocationRow[]>([
    { key: 'r0', person_id: '', value: '' },
  ]);
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
        setTaskTypeId(p?.lines?.[0]?.task_type_id ?? '');
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [planId]);

  const lines: any[] = plan?.lines ?? [];
  const line = lines.find((l) => l.task_type_id === taskTypeId);
  const summary = summariseAllocation(Number(line?.value ?? 0), rows);

  const submit = async () => {
    const built = buildAllocationEntries(rows);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    if (!taskTypeId) {
      setError('Choose which metric you are allocating.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await targetPlanService.allocate(planId, {
        task_type_id: taskTypeId,
        entries: built.entries,
      });
      setNotice(
        `Created ${res?.children?.length ?? built.entries.length} individual plans.`,
      );
      setRows([{ key: `r${Date.now()}`, person_id: '', value: '' }]);
      onAllocated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={plan ? `Allocate · ${plan.name}` : 'Allocate'}
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
      ) : !lines.length ? (
        <div className="text-sm text-amber-300">
          This plan has no target lines, so there is nothing to allocate.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Metric
              </label>
              <select
                aria-label="Metric to allocate"
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                value={taskTypeId}
                onChange={(e) => setTaskTypeId(e.target.value)}
              >
                {lines.map((l) => (
                  <option key={l.task_type_id} value={l.task_type_id}>
                    {l.metric_name ?? l.task_type_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400">
              Team target{' '}
              <span className="text-slate-200">
                {formatValue(summary.teamTarget, line?.unit, currency)}
              </span>
              {' · '}allocated{' '}
              <span className="text-slate-200">
                {formatValue(summary.allocated, line?.unit, currency)}
              </span>
              {' · '}
              <span className={summary.over ? 'text-amber-300' : 'text-slate-200'}>
                {summary.over ? 'over by ' : 'remaining '}
                {formatValue(
                  Math.abs(summary.remaining),
                  line?.unit,
                  currency,
                )}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.key} className="flex flex-wrap items-center gap-2">
                <div className="min-w-64">
                  <PersonPicker
                    value={r.person_id}
                    onChange={(id) =>
                      setRows((cur) =>
                        cur.map((x) =>
                          x.key === r.key ? { ...x, person_id: id } : x,
                        ),
                      )
                    }
                  />
                </div>
                <input
                  aria-label={`Target for row ${i + 1}`}
                  className="w-32 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
                  placeholder="target"
                  value={r.value}
                  onChange={(e) =>
                    setRows((cur) =>
                      cur.map((x) =>
                        x.key === r.key ? { ...x, value: e.target.value } : x,
                      ),
                    )
                  }
                />
                {rows.length > 1 && (
                  <button
                    aria-label={`Remove row ${i + 1}`}
                    className="text-xs text-slate-500 hover:text-slate-300"
                    onClick={() =>
                      setRows((cur) => cur.filter((x) => x.key !== r.key))
                    }
                  >
                    remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() =>
                setRows((cur) => [
                  ...cur,
                  { key: `r${Date.now()}-${cur.length}`, person_id: '', value: '' },
                ])
              }
            >
              + person
            </button>
            <button
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
              onClick={submit}
              disabled={busy}
            >
              Allocate
            </button>
            <span className="text-xs text-slate-500">
              Each person gets their own plan. Nothing is split automatically.
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}
