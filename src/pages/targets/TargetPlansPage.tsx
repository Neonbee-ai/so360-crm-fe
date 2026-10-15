import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { Copy, Trash2, Plus, Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import {
  EmptyState,
  PersonName,
  loadDirectoryPeople,
  personIdOf,
  formatValue,
} from './targetUi';
import {
  classifyTaskTypes,
  unlinkedLeadStages as computeUnlinkedLeadStages,
  buildLeadStageTaskTypePayload,
  buildCustomMetricTaskTypePayload,
} from './metricCatalog';
import AllocateTeamPlanPanel from './AllocateTeamPlanPanel';
import EditPlanPanel from './EditPlanPanel';
import { canCreatePlan, canEditPlan, canAllocatePlan } from './targetPlanPermissions';
import { PeopleSelector, ListPageTemplate, SearchInput, Grid, GridItem, Button, IconButton, DataTable, TextField, Select, NumberInput, DatePicker, Checkbox, Badge, EmptyState as DsEmptyState, Card , Modal } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';

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
  const [catalog, setCatalog] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
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

  // Lead Stage quick-add modal state
  const [showLeadStageModal, setShowLeadStageModal] = useState(false);
  const [leadStageSavingId, setLeadStageSavingId] = useState<string | null>(null);

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
      const [p, tt, ch, cat] = await Promise.all([
        targetPlanService.listPlans(),
        salesTargetService.listTaskTypes(),
        targetPlanService.listChannels().catch(() => []),
        // The catalog groups the metric picker by Lead Stage / Standard /
        // Custom, but is purely additive — if it fails to load (CRM stages
        // unreachable), the picker just falls back to one flat list instead
        // of blocking metric selection entirely.
        salesTargetService.getMetricCatalog().catch(() => null),
      ]);
      setPlans(p);
      setTaskTypes(tt);
      setChannels(ch);
      setCatalog(cat);
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
      const created = await salesTargetService.createTaskType(
        buildCustomMetricTaskTypePayload({
          name: customMetricName.trim(),
          kind: customMetricKind,
          unit: customMetricUnit.trim(),
        }),
      );
      const updatedTypes = await salesTargetService.listTaskTypes();
      setTaskTypes(updatedTypes);
      salesTargetService.getMetricCatalog().then(setCatalog).catch(() => {});
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

  /**
   * Wires up a Lead Stage as a measurable metric: a FLOW_TRANSITION task type
   * keyed on `to_state` (not `transition_key`), so ANY transition landing on
   * that stage counts — a lead can reach "Qualified" via more than one path.
   * `unit: 'leads'` matches spec §22 (stage metrics default to a leads/count unit).
   */
  const handleAddLeadStageMetric = async (stage: { stage_id: string; name: string }) => {
    setLeadStageSavingId(stage.stage_id);
    setError(null);
    try {
      const created = await salesTargetService.createTaskType(
        buildLeadStageTaskTypePayload(stage),
      );
      const updatedTypes = await salesTargetService.listTaskTypes();
      setTaskTypes(updatedTypes);
      const updatedCatalog = await salesTargetService.getMetricCatalog().catch(() => null);
      if (updatedCatalog) setCatalog(updatedCatalog);
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
    } catch (e: any) {
      setError(e?.message || 'Failed to add lead stage metric');
    } finally {
      setLeadStageSavingId(null);
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

  // Groups the flat taskTypes list into Lead Stage / Standard / Custom for the
  // metric picker (spec §11/§43). `null` — and the picker degrades to one
  // flat list — when the catalog failed to load.
  const groupedTaskTypes = classifyTaskTypes(catalog, taskTypes);
  const unlinkedLeadStages = computeUnlinkedLeadStages(catalog);

  const totalWeight = lines.reduce((sum, l) => sum + (Number(l.weight) || 0), 0);
  const isWeightValid = lines.length === 0 || Math.abs(totalWeight - 100) < 0.001;

  const canSubmit =
    name.trim().length > 0 &&
    startDate &&
    endDate &&
    lines.length > 0 &&
    lines.every((l) => l.task_type_id) &&
    isWeightValid &&
    (ownerType !== 'rep' || ownerId.trim().length > 0);

  const metricOptions = (groupedTaskTypes
    ? [...groupedTaskTypes.leadStage, ...groupedTaskTypes.standard, ...groupedTaskTypes.custom]
    : taskTypes
  ).map((t: any) => ({ value: t.id, label: t.name }));

  const lineColumns: DataTableColumn<DraftLine>[] = [
    { key: 'idx', header: '#', render: (l) => <span className="text-fg-muted font-mono">{lines.findIndex((x) => x.key === l.key) + 1}</span> },
    { key: 'metric', header: 'Metric', render: (l) => (
      <div className="space-y-nb-2">
        <Select
          name={`line_metric_${l.key}`}
          aria-label="Metric"
          value={l.task_type_id}
          onChange={(e: any) => updateLine(l.key, { task_type_id: e.target.value })}
          options={metricOptions}
        />
        {l.useRamp && (
          <TextField
            name={`line_ramp_${l.key}`}
            aria-label="Ramp curve"
            placeholder="e.g. 20, 35, 50, 75 (comma-separated values per period)"
            value={l.ramp.join(', ')}
            onChange={(e: any) =>
              updateLine(l.key, {
                ramp: e.target.value
                  .split(',')
                  .map((s: string) => Number(s.trim()))
                  .filter((n: number) => Number.isFinite(n)),
              })
            }
          />
        )}
      </div>
    ) },
    { key: 'unit', header: 'Unit', render: (l) => {
      const metric = taskTypes.find((t) => t.id === l.task_type_id);
      return <Badge tone="neutral">{metric?.unit || metric?.kind || 'count'}</Badge>;
    } },
    { key: 'value', header: 'Target Value', align: 'right', render: (l) => (
      <NumberInput
        name={`line_value_${l.key}`}
        aria-label="Target value"
        min={0}
        value={l.value}
        onChange={(v: number | null) => updateLine(l.key, { value: Number(v ?? 0) })}
      />
    ) },
    { key: 'weight', header: 'Weight (%)', align: 'right', render: (l) => (
      <NumberInput
        name={`line_weight_${l.key}`}
        aria-label="Weight percent"
        min={0}
        max={100}
        value={l.weight ?? 0}
        onChange={(v: number | null) => updateLine(l.key, { weight: Number(v ?? 0) })}
      />
    ) },
    { key: 'channel', header: 'Channel / Dimension', render: (l) => {
      const metric = taskTypes.find((t) => t.id === l.task_type_id);
      return metric?.kind === 'TOUCHPOINT' ? (
        <Select
          name={`line_channel_${l.key}`}
          aria-label="Channel"
          value={l.dimension_value ?? ''}
          onChange={(e: any) =>
            updateLine(l.key, {
              dimension_key: e.target.value ? 'channel' : undefined,
              dimension_value: e.target.value || undefined,
            })
          }
          options={[
            { value: '', label: 'All channels (Roll-up)' },
            ...channels.map((c: any) => ({ value: c.value, label: `${c.label} ${c.actuals_source === 'manual' ? '(manual)' : ''}`.trim() })),
          ]}
        />
      ) : (
        <span className="text-xs text-fg-muted italic">All Channels / N/A</span>
      );
    } },
    { key: 'ramp', header: 'Ramp', render: (l) => (
      <Checkbox
        name={`ramp-${l.key}`}
        label="Ramp"
        aria-label="Enable stepped ramp curve"
        title="Enable stepped ramp curve"
        checked={l.useRamp}
        onChange={(e: any) => updateLine(l.key, { useRamp: e.target.checked })}
      />
    ) },
    { key: 'actions', header: '', align: 'right', render: (l) => (
      <div className="flex items-center justify-end gap-nb-1">
        <IconButton label="Duplicate row" icon={<Copy size={13} />} variant="ghost" size="sm" onClick={() => duplicateLine(l)} />
        <IconButton label="Remove line" icon={<Trash2 size={13} />} variant="ghost" size="sm" onClick={() => removeLine(l.key)} />
      </div>
    ) },
  ];

  const filteredPlans = plans.filter((p: any) => {
    const q = search.trim().toLowerCase();
    return !q || `${p.name ?? ''} ${p.owner_type ?? ''} ${p.period ?? ''} ${p.status ?? ''}`.toLowerCase().includes(q);
  });

  const planColumns: DataTableColumn<any>[] = [
    { key: 'name', header: 'Name', sortable: true, sortValue: (p) => p.name || '', render: (p) => <span className="text-fg">{p.name}</span> },
    { key: 'owner', header: 'Owner', render: (p) => (
      <span className="text-fg-subtle">
        {p.owner_type}
        {p.owner_id ? (<>{' · '}<PersonName id={p.owner_id} /></>) : null}
      </span>
    ) },
    { key: 'period', header: 'Period', render: (p) => <span className="text-fg-subtle">{p.period}</span> },
    { key: 'window', header: 'Window', sortable: true, sortValue: (p) => p.start_date || '', render: (p) => <span className="text-fg-subtle">{p.start_date} → {p.end_date}</span> },
    { key: 'status', header: 'Status', render: (p) => <span className="text-fg-subtle">{p.status}</span> },
  ];

  return (
    <ListPageTemplate
      title="Target Plans"
      count={plans.length}
      search={<SearchInput value={search} onChange={setSearch} placeholder="Search plans…" />}
      loading={loading}
      primaryAction={canCreatePlan(shell) ? (
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'New plan'}
        </Button>
      ) : undefined}
    >
    <div className="space-y-5">

      {error && <div className="text-sm text-danger">{error}</div>}
      {notice && <div className="text-sm text-success">{notice}</div>}

      {!loading && !taskTypes.length && (
        <Card title="Set up your metrics first">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-fg-subtle">
              This organisation has no metrics yet, so a plan cannot be built
              and every Targets screen will be empty. Load the starter set for
              your industry — metrics, touchpoint channels and loss reasons.
              Nothing existing is overwritten.
            </div>
            <Button variant="primary" size="sm"
              onClick={provision}
              disabled={saving}
            >
              Load starter metrics
            </Button>
          </div>
        </Card>
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
        <Card title="New target plan">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="grow basis-64">
                <TextField
                  name="plan_name"
                  label="Plan name"
                  value={name}
                  onChange={(e: any) => setName(e.target.value)}
                  placeholder="Sales Intern — Sep–Dec 2026"
                />
              </div>
              <Select
                name="plan_owner_type"
                label="Assign to"
                value={ownerType}
                onChange={(e: any) => setOwnerType(e.target.value as any)}
                options={[
                  { value: 'rep', label: 'Individual' },
                  { value: 'team', label: 'Team' },
                  { value: 'org', label: 'Organisation' },
                ]}
              />
              {/* Only an individual plan has a person owner. A team plan is
                  owned by the team and then allocated to its members from the
                  plans list, which is what creates each person's own plan; an
                  org plan has no owner at all. Showing a person picker for
                  those two invited a meaningless selection. */}
              {ownerType === 'rep' ? (
                <Field label="Owner" grow>
                  <PeopleSelector loadOptions={loadDirectoryPeople} value={ownerId} onChange={(id) => setOwnerId(personIdOf(id))} />
                </Field>
              ) : (
                <Field label="Owner" grow>
                  <div className="px-2 py-1.5 text-sm text-fg-subtle">
                    {ownerType === 'team'
                      ? 'The team as a whole. Allocate it to people after saving.'
                      : 'The whole organisation.'}
                  </div>
                </Field>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <TextField name="plan_role" label="Role" value={role} onChange={(e: any) => setRole(e.target.value)} />
              <Select
                name="plan_period"
                label="Period"
                value={period}
                onChange={(e: any) => setPeriod(e.target.value as Period)}
                options={[
                  { value: 'week', label: 'Weekly' },
                  { value: 'month', label: 'Monthly' },
                  { value: 'quarter', label: 'Quarterly' },
                  { value: 'year', label: 'Annual' },
                ]}
              />
              <Select
                name="plan_priority"
                label="Priority"
                value={priority}
                onChange={(e: any) => setPriority(e.target.value as any)}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
              <DatePicker name="plan_start" label="Start" value={startDate} onChange={(iso: string) => setStartDate(iso)} />
              <DatePicker name="plan_end" label="End" value={endDate} onChange={(iso: string) => setEndDate(iso)} />
            </div>

            <div className="border-t border-line pt-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-sm font-medium text-fg">Target Metrics & Weights</span>
                  <p className="text-xs text-fg-subtle">
                    Define measurable target lines with period quotas and weight distributions. Weights must sum to 100%.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {catalog && (
                    <Button
                      type="button" variant="secondary" size="sm"
                      onClick={() => setShowLeadStageModal(true)}
                      disabled={!unlinkedLeadStages.length}
                      title={
                        unlinkedLeadStages.length
                          ? 'Add a CRM Lead Stage as a measurable metric'
                          : 'Every CRM Lead Stage already has a metric'
                      }
                    >
                      <Plus size={12} /> + Lead Stage Metric
                    </Button>
                  )}
                  <Button
                    type="button" variant="secondary" size="sm"
                    onClick={() => setShowCustomMetricModal(true)}
                  >
                    <Sparkles size={12} className="text-warning" /> + Custom Metric
                  </Button>
                  <Button
                    type="button" variant="secondary" size="sm"
                    onClick={addLine}
                    disabled={!taskTypes.length}
                  >
                    <Plus size={12} /> Add Metric Row
                  </Button>
                </div>
              </div>

              {!taskTypes.length && (
                <div className="text-xs text-warning bg-warning/10 border border-warning/20 p-3 rounded-lg">
                  No metrics configured yet. Click "Load starter metrics" above, add a task type, or click "+ Custom Metric" to begin.
                </div>
              )}

              {lines.length === 0 ? (
                <DsEmptyState title="No target lines added yet." description='Click "Add Metric Row" to configure quotas for this plan.' />
              ) : (
                <>
                  <DataTable
                    columns={lineColumns}
                    rows={lines}
                    rowKey={(l: DraftLine) => l.key}
                    getRowProps={(l: DraftLine) => ({ 'data-testid': `plan-line-${l.key}` })}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-nb-2 text-xs font-semibold">
                    <span className="text-fg-subtle">
                      Total Lines: <span className="text-fg">{lines.length}</span> · Total Target:{' '}
                      <span className="text-fg">{lines.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)}</span>
                    </span>
                    <Badge tone={isWeightValid ? 'success' : 'warning'}>
                      {totalWeight.toFixed(1)}% {isWeightValid ? '✓ 100% Valid' : '⚠ Sum to 100%'}
                    </Badge>
                    {!isWeightValid && (
                      <span className="text-fg-muted">Total line weights must equal 100% to save</span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="sm"
                disabled={!canSubmit || saving}
                onClick={submit}
              >
                {saving ? 'Saving…' : 'Save plan'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? null : !plans.length ? (
        <EmptyState message="No target plans yet." />
      ) : (
        <Card title="Plans">
          <DataTable
            columns={planColumns}
            rows={filteredPlans}
            rowKey={(p: any) => p.id}
            rowActions={(p: any) => [
              ...(canEditPlan(shell) ? [{ label: 'Edit', onSelect: () => setEditing(p.id) }] : []),
              ...(canAllocatePlan(shell, p.owner_type) ? [{ label: 'Allocate', onSelect: () => setAllocating(p.id) }] : []),
            ]}
            getRowProps={(p: any) => ({ 'data-testid': `plan-row-${p.id}` })}
          />
        </Card>
      )}

      {showCustomMetricModal && (
        <Modal
          open={showCustomMetricModal}
          onClose={() => setShowCustomMetricModal(false)}
          title="Create Custom Metric"
          size="md"
        >
          <form onSubmit={handleCreateCustomMetric} className="space-y-4">
            <TextField
              name="custom_metric_name"
              label="Metric Name"
              required
              placeholder="e.g. Enterprise Demos Held, Referral Introductions"
              value={customMetricName}
              onChange={(e: any) => setCustomMetricName(e.target.value)}
            />

            <div>
              <label className="block text-xs font-medium text-fg-subtle mb-1">
                Metric Type / Kind
              </label>
              <Grid gap="sm">
                {[
                  { value: 'COUNT', label: 'Count', desc: 'Number of occurrences' },
                  { value: 'SUM', label: 'Sum / Value', desc: 'Financial or numeric total' },
                  { value: 'TOUCHPOINT', label: 'Touchpoint', desc: 'Multi-channel interactions' },
                ].map((k) => (
                  <GridItem key={k.value} span={4}>
                  <Button
                    key={k.value}
                    type="button"
                    variant={customMetricKind === k.value ? 'primary' : 'secondary'}
                    onClick={() => {
                      setCustomMetricKind(k.value as any);
                      if (k.value === 'SUM') setCustomMetricUnit('currency');
                      else if (k.value === 'COUNT') setCustomMetricUnit('count');
                      else if (k.value === 'TOUCHPOINT') setCustomMetricUnit('touchpoints');
                    }}
                  >
                    {k.label} — {k.desc}
                  </Button>
                  </GridItem>
                ))}
              </Grid>
            </div>

            <TextField
              name="custom_metric_unit"
              label="Measurement Unit"
              placeholder="count, currency, hours, calls, etc."
              value={customMetricUnit}
              onChange={(e: any) => setCustomMetricUnit(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                onClick={() => setShowCustomMetricModal(false)} variant="secondary" size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!customMetricName.trim() || customMetricSaving} variant="primary" size="sm"
              >
                {customMetricSaving && <Loader2 size={12} className="animate-spin" />}
                Create & Add to Plan
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showLeadStageModal && (
        <Modal
          open={showLeadStageModal}
          onClose={() => setShowLeadStageModal(false)}
          title="Add Lead Stage Metric"
          size="md"
        >
          <div className="space-y-3">
            <p className="text-xs text-fg-subtle">
              Sourced live from CRM Lead Stage configuration. Selecting a stage
              measures leads entering it during the target period — moving a
              lead onward later does not remove the earlier achievement.
            </p>
            {unlinkedLeadStages.length === 0 ? (
              <p className="text-xs text-fg-muted italic">
                Every configured Lead Stage already has a metric.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {unlinkedLeadStages
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((stage: any) => (
                    <Button
                      key={stage.stage_id}
                      type="button"
                      variant="secondary"
                      disabled={leadStageSavingId === stage.stage_id}
                      onClick={async () => {
                        await handleAddLeadStageMetric(stage);
                        setShowLeadStageModal(false);
                      }}
                    >
                      <span className="flex items-center gap-nb-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color || '#64748B' }}
                        />
                        {stage.name}
                      </span>
                      {leadStageSavingId === stage.stage_id && (
                        <Loader2 size={12} className="animate-spin text-fg-subtle" />
                      )}
                    </Button>
                  ))}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-line">
              <Button
                type="button"
                onClick={() => setShowLeadStageModal(false)} variant="secondary" size="sm"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
    </ListPageTemplate>
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
      <label className="block text-xs text-fg-subtle mb-1">{label}</label>
      {children}
    </div>
  );
}
