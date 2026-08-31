import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import {
  EmptyState,
  Panel,
  PersonName,
  PersonPicker,
  formatPct,
  formatValue,
  reviewPeriodBounds,
} from './targetUi';

/**
 * Monthly and quarterly sales reviews.
 *
 * A review opens PRE-FILLED with the period's real numbers so the manager
 * arrives at a conversation rather than a blank form — a review that starts
 * empty gets filled in from memory, which is what this module exists to
 * replace.
 *
 * Finalizing is one-way. The review becomes evidence an HR appraisal may cite,
 * and editing the record of a conversation after it happened defeats the point.
 */
export default function SalesReviewsPage() {
  const shell = useShellBridge();
  const [reviews, setReviews] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New-review form. The period is chosen as a month or a quarter rather than
  // as two free dates — see reviewPeriodBounds.
  const [newPersonId, setNewPersonId] = useState('');
  const [newPeriodType, setNewPeriodType] = useState<'monthly' | 'quarterly'>(
    'monthly',
  );
  const [newAnchor, setNewAnchor] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });

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

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    targetPlanService
      .listReviews()
      .then(setReviews)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bounds = reviewPeriodBounds(newPeriodType, newAnchor);

  const startReview = async () => {
    if (!newPersonId || !bounds) return;
    setBusy(true);
    setError(null);
    try {
      const created = await targetPlanService.createReview({
        person_id: newPersonId,
        period_type: newPeriodType,
        ...bounds,
      });
      setNotice(
        "Review opened, pre-filled with the period's numbers. Nothing is sent to People Connect until you finalize.",
      );
      setNewPersonId('');
      setActive(created);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const retrySync = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await targetPlanService.retryReviewSync();
      setNotice(
        res.retried === 0
          ? 'Nothing pending — every finalized review has reached People Connect.'
          : `Retried ${res.retried}: ${res.ok} succeeded, ${res.failed} still failing.`,
      );
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const finalize = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await targetPlanService.finalizeReview(id);
      setNotice(
        res?.pc_sync?.ok
          ? 'Finalized and sent to People Connect as appraisal evidence.'
          : 'Finalized. People Connect push did not succeed — retry from the sync action.',
      );
      setActive(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addActionItem = (kind: string) => {
    if (!active) return;
    setActive({
      ...active,
      action_items: [...(active.action_items ?? []), { kind, text: '' }],
    });
  };

  const saveDraft = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await targetPlanService.updateReview(active.id, {
        action_items: active.action_items,
        wins: active.wins,
        losses: active.losses,
        notes: active.notes,
      });
      setNotice('Draft saved.');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading reviews…</div>;
  }

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-lg font-semibold text-slate-100">Reviews</h1>

      {error && <div className="text-sm text-rose-300">{error}</div>}
      {notice && <div className="text-sm text-emerald-300">{notice}</div>}

      <Panel title="Start a review">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64">
            <label className="block text-[11px] text-slate-400 mb-1">
              Person
            </label>
            <PersonPicker value={newPersonId} onChange={setNewPersonId} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Period
            </label>
            <select
              className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={newPeriodType}
              aria-label="Period type"
              onChange={(e) => {
                const next = e.target.value as 'monthly' | 'quarterly';
                setNewPeriodType(next);
                const now = new Date();
                setNewAnchor(
                  next === 'monthly'
                    ? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
                    : `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`,
                );
              }}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              {newPeriodType === 'monthly' ? 'Month' : 'Quarter'}
            </label>
            {newPeriodType === 'monthly' ? (
              <input
                type="month"
                aria-label="Month"
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                value={newAnchor}
                onChange={(e) => setNewAnchor(e.target.value)}
              />
            ) : (
              <select
                aria-label="Quarter"
                className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
                value={newAnchor}
                onChange={(e) => setNewAnchor(e.target.value)}
              >
                {(() => {
                  const y = new Date().getUTCFullYear();
                  return [y, y - 1].flatMap((year) =>
                    [1, 2, 3, 4].map((q) => (
                      <option key={`${year}-Q${q}`} value={`${year}-Q${q}`}>
                        {year} Q{q}
                      </option>
                    )),
                  );
                })()}
              </select>
            )}
          </div>
          <button
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
            onClick={startReview}
            disabled={busy || !newPersonId || !bounds}
          >
            Open review
          </button>
          {bounds && (
            <span className="text-xs text-slate-500">
              {bounds.period_start} → {bounds.period_end}
            </span>
          )}
        </div>
      </Panel>

      {reviews.some(
        (r) => r.status === 'finalized' && !r.pc_synced_at,
      ) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <span className="text-xs text-amber-300">
            Some finalized reviews have not reached People Connect, so they are
            not yet usable as appraisal evidence.
          </span>
          <button
            className="rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-600 disabled:opacity-50"
            onClick={retrySync}
            disabled={busy}
          >
            Retry push
          </button>
        </div>
      )}

      {!reviews.length ? (
        <EmptyState message="No reviews yet. A review is created for a person and period, pre-filled with that period's numbers." />
      ) : (
        <Panel title="All reviews">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-4 font-medium">Period</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Person</th>
                  <th className="py-2 pr-4 font-medium">Attainment</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">HR evidence</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => setActive(r)}
                  >
                    <td className="py-2 pr-4 text-slate-200">
                      {r.period_start}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">{r.period_type}</td>
                    <td className="py-2 pr-4 text-slate-400">
                      <PersonName id={r.person_id} />
                    </td>
                    <td className="py-2 pr-4 text-slate-300">
                      {formatPct(r.results?.headline?.attainment)}
                    </td>
                    <td className="py-2 pr-4 text-slate-300">{r.status}</td>
                    <td className="py-2 text-xs">
                      {r.pc_synced_at ? (
                        <span className="text-emerald-300">sent</span>
                      ) : r.status === 'finalized' ? (
                        <span className="text-amber-300">
                          {r.pc_sync_error ? 'failed' : 'pending'}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {active && (
        <Panel
          title={`Review · ${active.period_start} → ${active.period_end}`}
          action={
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setActive(null)}
            >
              Close
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <Block title="Results">
                {(active.results?.metrics ?? []).map((m: any) => (
                  <div
                    key={m.metric}
                    className="flex items-center justify-between gap-6"
                  >
                    <span className="text-slate-400">{m.metric}</span>
                    <span className="text-slate-200">
                      {formatValue(m.actual, m.unit, currency)} /{' '}
                      {formatValue(m.target, m.unit, currency)} ·{' '}
                      {formatPct(m.attainment)}
                    </span>
                  </div>
                ))}
              </Block>

              {active.pipeline?.applicable && (
                <Block title="Pipeline">
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-slate-400">Total</span>
                    <span className="text-slate-200">
                      {formatValue(
                        active.pipeline.total_pipeline,
                        'currency',
                        currency,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-slate-400">Coverage</span>
                    <span className="text-slate-200">
                      {active.pipeline.coverage === null
                        ? '—'
                        : `${active.pipeline.coverage.toFixed(1)}×`}
                    </span>
                  </div>
                </Block>
              )}

              <Block title="Win / Loss">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-slate-400">Won / Lost</span>
                  <span className="text-slate-200">
                    {active.win_loss?.won_count ?? 0} /{' '}
                    {active.win_loss?.lost_count ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-slate-400">Top loss reason</span>
                  <span className="text-slate-200">
                    {active.win_loss?.top_reason?.label ?? '—'}
                  </span>
                </div>
              </Block>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Action items</span>
                {active.status !== 'finalized' && (
                  <div className="flex gap-2 text-xs">
                    {['Messaging', 'ICP', 'Pricing', 'Channel', 'Focus'].map(
                      (k) => (
                        <button
                          key={k}
                          className="text-slate-400 hover:text-slate-200"
                          onClick={() => addActionItem(k)}
                        >
                          + {k}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {(active.action_items ?? []).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-20 shrink-0">
                      {a.kind}
                    </span>
                    <input
                      className="flex-1 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none disabled:opacity-60"
                      value={a.text}
                      disabled={active.status === 'finalized'}
                      onChange={(e) => {
                        const items = [...active.action_items];
                        items[i] = { ...a, text: e.target.value };
                        setActive({ ...active, action_items: items });
                      }}
                    />
                  </div>
                ))}
                {!(active.action_items ?? []).length && (
                  <div className="text-xs text-slate-500">
                    No action items yet. Keep this short — a review that becomes
                    a long form stops getting filled in honestly.
                  </div>
                )}
              </div>
            </div>

            {active.status !== 'finalized' ? (
              <div className="flex justify-end gap-2">
                <button
                  className="rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  onClick={saveDraft}
                  disabled={busy}
                >
                  Save draft
                </button>
                <button
                  className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                  onClick={() => finalize(active.id)}
                  disabled={busy}
                >
                  Finalize
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Finalized{active.finalized_at ? ` on ${active.finalized_at.slice(0, 10)}` : ''} —
                this review is now appraisal evidence and cannot be edited.
                {active.pc_sync_error && (
                  <span className="text-amber-300">
                    {' '}
                    People Connect push failed: {active.pc_sync_error}
                  </span>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grow basis-64">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
