import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import {
  EmptyState,
  ErrorState,
  PersonName,
  PersonPicker,
  formatPct,
  formatValue,
  reviewPeriodBounds,
} from './targetUi';
import { ListPageTemplate, Button, DataTable, TextField, Select, FormField, Modal, Drawer, Alert, Badge, SearchInput, Stack, Grid, GridItem } from '@so360/design-system';
import { ClipboardList, Plus } from 'lucide-react';
import type { DataTableColumn, FilterValues } from '@so360/design-system';

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
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ status: '', period_type: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New-review form. The period is chosen as a month or a quarter rather than
  // as two free dates — see reviewPeriodBounds.
  const [startOpen, setStartOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
    setFormError(null);
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
      setStartOpen(false);
      setActive(created);
      load();
    } catch (e: any) {
      setFormError(e.message);
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

  const monthOptions = (() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      return {
        value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      };
    });
  })();

  const openStart = () => {
    setFormError(null);
    setStartOpen(true);
  };

  const q = search.trim().toLowerCase();
  const rows = reviews.filter(
    (r) =>
      (!filters.status || r.status === filters.status) &&
      (!filters.period_type || r.period_type === filters.period_type) &&
      (!q || String(r.period_start || '').toLowerCase().includes(q)),
  );

  const columns: DataTableColumn<any>[] = [
    { key: 'period', header: 'Period', sortable: true, sortValue: (r) => r.period_start || '', render: (r) => <span className="text-fg">{r.period_start}</span> },
    { key: 'type', header: 'Type', render: (r) => <span className="text-fg-subtle">{r.period_type}</span> },
    { key: 'person', header: 'Person', render: (r) => <span className="text-fg-subtle"><PersonName id={r.person_id} /></span> },
    { key: 'attainment', header: 'Attainment', align: 'right', sortable: true, sortValue: (r) => r.results?.headline?.attainment ?? 0, render: (r) => <span className="text-fg-subtle">{formatPct(r.results?.headline?.attainment)}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'finalized' ? 'success' : 'neutral'}>{r.status}</Badge> },
    { key: 'evidence', header: 'HR evidence', render: (r) => (
      <span className="text-xs">
        {r.pc_synced_at ? (
          <Badge tone="success">sent</Badge>
        ) : r.status === 'finalized' ? (
          <Badge tone={r.pc_sync_error ? 'danger' : 'warning'}>{r.pc_sync_error ? 'failed' : 'pending'}</Badge>
        ) : (
          <span className="text-fg-muted">—</span>
        )}
      </span>
    ) },
  ];

  const needsSync = reviews.some((r) => r.status === 'finalized' && !r.pc_synced_at);

  return (
    <>
    <ListPageTemplate
      title="Reviews"
      count={reviews.length}
      primaryAction={(
        <Button variant="primary" onClick={openStart}>
          <Plus size={16} aria-hidden="true" /> New review
        </Button>
      )}
      search={<SearchInput value={search} onChange={setSearch} placeholder="Search by period…" />}
      filterConfig={{
        fields: [
          { key: 'status', label: 'Status', type: 'select', options: [
            { value: 'draft', label: 'Draft' },
            { value: 'finalized', label: 'Finalized' },
          ] },
          { key: 'period_type', label: 'Type', type: 'select', options: [
            { value: 'monthly', label: 'Monthly' },
            { value: 'quarterly', label: 'Quarterly' },
          ] },
        ],
        values: filters,
        onChange: setFilters,
        onClear: () => setFilters({ status: '', period_type: '' }),
      }}
      loading={loading}
      isEmpty={!loading && !reviews.length}
      empty={
        error ? (
          <ErrorState error={error} onRetry={load} />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No reviews yet"
            description="A review is created for a person and period, pre-filled with that period's numbers."
            action={{ label: 'New review', onClick: openStart }}
          />
        )
      }
      isFilteredEmpty={!loading && reviews.length > 0 && !rows.length}
      onClearFilters={() => { setFilters({ status: '', period_type: '' }); setSearch(''); }}
    >
      {error && !loading && reviews.length > 0 && <ErrorState error={error} onRetry={load} />}
      {notice && <Alert variant="success">{notice}</Alert>}
      {needsSync && (
        <Alert
          variant="warning"
          action={{ label: 'Retry push', onClick: retrySync }}
        >
          Some finalized reviews have not reached People Connect, so they are
          not yet usable as appraisal evidence.
        </Alert>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r: any) => r.id}
        onRowClick={(r: any) => setActive(r)}
        getRowProps={(r: any) => ({ 'data-testid': `review-row-${r.id}` })}
      />
    </ListPageTemplate>

      <Modal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        title="New review"
        size="md"
        dismissible={!busy}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setStartOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={startReview}
              disabled={busy || !newPersonId || !bounds}
            >
              Open review
            </Button>
          </>
        )}
      >
        <div className="space-y-nb-3">
          {formError && <div className="text-sm text-danger">{formError}</div>}
          <FormField label="Person" name="review_person">
            <PersonPicker value={newPersonId} onChange={setNewPersonId} />
          </FormField>
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
            <Select
              name="review_month"
              label="Month"
              aria-label="Month"
              value={newAnchor}
              onChange={(e: any) => setNewAnchor(e.target.value)}
              options={monthOptions}
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
          {bounds && (
            <div className="text-xs text-fg-muted">
              {bounds.period_start} → {bounds.period_end}
            </div>
          )}
        </div>
      </Modal>

      <Drawer
        isOpen={!!active}
        onClose={() => setActive(null)}
        title={active ? `Review · ${active.period_start} → ${active.period_end}` : 'Review'}
        size="lg"
      >
        {active && (
          <Stack>
            <Grid>
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
            </Grid>

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
          </Stack>
        )}
      </Drawer>
    </>
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
    <GridItem span={4}>
      <div className="text-xs text-fg-muted mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </GridItem>
  );
}
