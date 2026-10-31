import { PeopleSelector, Button, TextField, Select, Drawer, Skeleton } from '@so360/design-system';
import React, { useEffect, useState } from 'react';
import { targetPlanService } from '../../services/targetPlanService';
import {
  loadDirectoryPeople,
  personIdOf,
  formatValue,
} from './targetUi';
import {
  buildAllocationEntries,
  summariseAllocation,
  type AllocationRow,
} from './allocation';
import { findLine, lineLabel, lineUnit } from './planShape';

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
  // The metric lives on a nested `task_type` relation, not on the line.
  const line = findLine(plan, taskTypeId);
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
    <Drawer isOpen onClose={onClose} size="lg" title={plan ? `Allocate · ${plan.name}` : 'Allocate'}>
      {error && <div className="mb-2 text-sm text-danger">{error}</div>}
      {notice && <div className="mb-2 text-sm text-success">{notice}</div>}

      {!plan ? (
        <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4"><Skeleton variant="rect" /><Skeleton variant="text" lines={3} /><span className="sr-only">Loading plan…</span></div>
      ) : !lines.length ? (
        <div className="text-sm text-warning">
          This plan has no target lines, so there is nothing to allocate.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-fg-subtle mb-1">
                Metric
              </label>
              <Select
                name="allocate-metric"
                aria-label="Metric to allocate"
                size="sm"
                value={taskTypeId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTaskTypeId(e.target.value)}
                options={lines.map((l) => ({ value: l.task_type_id, label: lineLabel(l) }))}
              />
            </div>
            <div className="text-xs text-fg-subtle">
              Team target{' '}
              <span className="text-fg">
                {formatValue(summary.teamTarget, line && lineUnit(line), currency)}
              </span>
              {' · '}allocated{' '}
              <span className="text-fg">
                {formatValue(summary.allocated, line && lineUnit(line), currency)}
              </span>
              {' · '}
              <span className={summary.over ? 'text-warning' : 'text-fg'}>
                {summary.over ? 'over by ' : 'remaining '}
                {formatValue(
                  Math.abs(summary.remaining),
                  line && lineUnit(line),
                  currency,
                )}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.key} className="flex flex-wrap items-center gap-2">
                <div className="min-w-64">
                  <PeopleSelector
                    clearable
                    loadOptions={loadDirectoryPeople}
                    value={r.person_id}
                    onChange={(pick) =>
                      setRows((cur) =>
                        cur.map((x) =>
                          x.key === r.key ? { ...x, person_id: personIdOf(pick) } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="w-32">
                <TextField
                  name={`allocate-target-${r.key}`}
                  aria-label={`Target for row ${i + 1}`}
                  size="sm"
                  placeholder="target"
                  value={r.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRows((cur) =>
                      cur.map((x) =>
                        x.key === r.key ? { ...x, value: e.target.value } : x,
                      ),
                    )
                  }
                />
                </div>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    aria-label={`Remove row ${i + 1}`}
                    onClick={() =>
                      setRows((cur) => cur.filter((x) => x.key !== r.key))
                    }
                  >
                    remove
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm"
              onClick={() =>
                setRows((cur) => [
                  ...cur,
                  { key: `r${Date.now()}-${cur.length}`, person_id: '', value: '' },
                ])
              }
            >
              + person
            </Button>
            <Button variant="primary" size="sm"
              onClick={submit}
              disabled={busy}
            >
              Allocate
            </Button>
            <span className="text-xs text-fg-muted">
              Each person gets their own plan. Nothing is split automatically.
            </span>
          </div>
        </div>
      )}
    </Drawer>
  );
}
