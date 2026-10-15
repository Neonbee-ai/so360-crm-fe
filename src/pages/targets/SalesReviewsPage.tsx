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
import { DashboardPageTemplate, Button, DataTable, TextField, Select } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';

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
    return <div className="text-sm text-fg-subtle">Loading reviews…</div>;
  }

  const columns: DataTableColumn<any>[] = [
    { key: 'period', header: 'Period', sortable: true, sortValue: (r) => r.period_start || '', render: (r) => <span className="text-fg">{r.period_start}</span> },
    { key: 'type', header: 'Type', render: (r) => <span className="text-fg-subtle">{r.period_type}</span> },
    { key: 'person', header: 'Person', render: (r) => <span className="text-fg-subtle"><PersonName id={r.person_id} /></span> },
    { key: 'attainment', header: 'Attainment', align: 'right', sortable: true, sortValue: (r) => r.results?.headline?.attainment ?? 0, render: (r) => <span className="text-fg-subtle">{formatPct(r.results?.headline?.attainment)}</span> },
    { key: 'status', header: 'Status', render: (r) => <span className="text-fg-subtle">{r.status}</span> },
    { key: 'evidence', header: 'HR evidence', render: (r) => (
      <span className="text-xs">
        {r.pc_synced_at ? (
          <span className="text-success">sent</span>
        ) : r.status === 'finalized' ? (
          <span className="text-warning">{r.pc_sync_error ? 'failed' : 'pending'}</span>
        ) : (
          <span className="text-fg-muted">—</span>
        )}
      </span>
    ) },
  ];

  return (
    <DashboardPageTemplate title="Reviews">
    <div className="space-y-5">

      {error && <div className="text-sm text-danger">{error}</div>}
      {notice && <div className="text-sm text-success">{notice}</div>}

      <Panel title="Start a review">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64">
            <label className="block text-xs text-fg-subtle mb-1">
              Person
            </label>
            <PersonPicker value={newPersonId} onChange={setNewPersonId} />
          </div>
          <Select
            name="review_period_type"
            label="Period"
            aria-label="Period type"
            value={newPeriodType}
            onChange={(e: any) => {
              const next = e.target.value as 'monthly' | 'quarterly';
              setNewPeriodType(next);
              const now = new Date();
              setNewAnchor(
                next === 'monthly'
                  ? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
                  : `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`,
              );
            }}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
            ]}
          />
          {newPeriodType === 'monthly' ? (
            <TextField
              name="review_month"
              type="month"
              label="Month"
              aria-label="Month"
              value={newAnchor}
              onChange={(e: any) => setNewAnchor(e.target.value)}
            />
          ) : (
            <Select
              name="review_quarter"
              label="Quarter"
              aria-label="Quarter"
              value={newAnchor}
              onChange={(e: any) => setNewAnchor(e.target.value)}
              options={(() => {
                const y = new Date().getUTCFullYear();
                return [y, y - 1].flatMap((year) =>
                  [1, 2, 3, 4].map((q) => ({ value: `${year}-Q${q}`, label: `${year} Q${q}` })),
                );
              })()}
            />
          )}
          <Button variant="primary" size="sm"
            onClick={startReview}
            disabled={busy || !newPersonId || !bounds}
          >
            Open review
          </Button>
          {bounds && (
            <span className="text-xs text-fg-muted">
              {bounds.period_start} → {bounds.period_end}
            </span>
          )}
        </div>
      </Panel>

      {reviews.some(
        (r) => r.status === 'finalized' && !r.pc_synced_at,
      ) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-warning/30 bg-warning/5 px-3 py-2">
          <span className="text-xs text-warning">
            Some finalized reviews have not reached People Connect, so they are
            not yet usable as appraisal evidence.
          </span>
          <Button variant="primary" size="sm"
            onClick={retrySync}
            disabled={busy}
          >
            Retry push
          </Button>
        </div>
      )}

      {!reviews.length ? (
        <EmptyState message="No reviews yet. A review is created for a person and period, pre-filled with that period's numbers." />
      ) : (
        <Panel title="All reviews">
          <DataTable
            columns={columns}
            rows={reviews}
            rowKey={(r: any) => r.id}
            onRowClick={(r: any) => setActive(r)}
            getRowProps={(r: any) => ({ 'data-testid': `review-row-${r.id}` })}
          />
        </Panel>
      )}

      {active && (
        <Panel
          title={`Review · ${active.period_start} → ${active.period_end}`}
          action={
            <Button variant="secondary" size="sm"
              onClick={() => setActive(null)}
            >
              Close
            </Button>
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
                    <span className="text-fg-subtle">{m.metric}</span>
                    <span className="text-fg">
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
                    <span className="text-fg-subtle">Total</span>
                    <span className="text-fg">
                      {formatValue(
                        active.pipeline.total_pipeline,
                        'currency',
                        currency,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <span className="text-fg-subtle">Coverage</span>
                    <span className="text-fg">
                      {active.pipeline.coverage === null
                        ? '—'
                        : `${active.pipeline.coverage.toFixed(1)}×`}
                    </span>
                  </div>
                </Block>
              )}

              <Block title="Win / Loss">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-fg-subtle">Won / Lost</span>
                  <span className="text-fg">
                    {active.win_loss?.won_count ?? 0} /{' '}
                    {active.win_loss?.lost_count ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-fg-subtle">Top loss reason</span>
                  <span className="text-fg">
                    {active.win_loss?.top_reason?.label ?? '—'}
                  </span>
                </div>
              </Block>
            </div>

            <div className="border-t border-line pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-fg-subtle">Action items</span>
                {active.status !== 'finalized' && (
                  <div className="flex gap-2 text-xs">
                    {['Messaging', 'ICP', 'Pricing', 'Channel', 'Focus'].map(
                      (k) => (
                        <Button
                          key={k}
                          variant="secondary"
                          size="sm"
                          onClick={() => addActionItem(k)}
                        >
                          + {k}
                        </Button>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {(active.action_items ?? []).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-fg-muted w-20 shrink-0">
                      {a.kind}
                    </span>
                    <div className="flex-1">
                      <TextField
                        name={`review_action_${i}`}
                        aria-label={`Action item ${i + 1}`}
                        value={a.text}
                        disabled={active.status === 'finalized'}
                        onChange={(e: any) => {
                          const items = [...active.action_items];
                          items[i] = { ...a, text: e.target.value };
                          setActive({ ...active, action_items: items });
                        }}
                      />
                    </div>
                  </div>
                ))}
                {!(active.action_items ?? []).length && (
                  <div className="text-xs text-fg-muted">
                    No action items yet. Keep this short — a review that becomes
                    a long form stops getting filled in honestly.
                  </div>
                )}
              </div>
            </div>

            {active.status !== 'finalized' ? (
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm"
                  onClick={saveDraft}
                  disabled={busy}
                >
                  Save draft
                </Button>
                <Button variant="primary" size="sm"
                  onClick={() => finalize(active.id)}
                  disabled={busy}
                >
                  Finalize
                </Button>
              </div>
            ) : (
              <div className="text-xs text-fg-muted">
                Finalized{active.finalized_at ? ` on ${active.finalized_at.slice(0, 10)}` : ''} —
                this review is now appraisal evidence and cannot be edited.
                {active.pc_sync_error && (
                  <span className="text-warning">
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
    </DashboardPageTemplate>
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
      <div className="text-xs text-fg-muted mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
