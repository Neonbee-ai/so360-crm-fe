import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { Copy, Trash2, Plus, Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import { EmptyState, Panel, PersonName, PersonPicker, formatValue } from './targetUi';
import {
  classifyTaskTypes,
  unlinkedLeadStages as computeUnlinkedLeadStages,
  buildLeadStageTaskTypePayload,
  buildCustomMetricTaskTypePayload,
} from './metricCatalog';
import AllocateTeamPlanPanel from './AllocateTeamPlanPanel';
import EditPlanPanel from './EditPlanPanel';
import { canCreatePlan, canEditPlan, canAllocatePlan } from './targetPlanPermissions';
import { DashboardPageTemplate, Button, EmptyState as DsEmptyState } from '@so360/design-system';

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

  return (
    <DashboardPageTemplate
      title="Target Plans"
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
        <Panel title="Set up your metrics first">
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
                  className="w-full rounded bg-surface-raised px-2 py-1.5 text-sm text-fg outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sales Intern — Sep–Dec 2026"
                />
              </Field>
              <Field label="Assign to">
                <select
                  className="rounded bg-surface-raised px-2 py-1.5 text-sm text-fg"
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
                  <div className="px-2 py-1.5 text-sm text-fg-subtle">
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
                  className="rounded bg-surface-raised px-2 py-1.5 text-sm text-fg outline-none"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </Field>
              <Field label="Period">
                <select
                  className="rounded bg-surface-raised px-2 py-1.5 text-sm text-fg"
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
                  className="rounded bg-surface-raised px-2 py-1.5 text-sm text-fg"
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
                  className="rounded bg-surface-raised px-2 py-1.5 text-sm text-fg"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field label="End">
                <input
                  type="date"
                  className="rounded bg-surface-raised px-2 py-1.5 text-sm text-fg"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
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
                <div className="overflow-x-auto rounded-nb border border-line bg-surface-sunken shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface-high text-fg-subtle font-semibold text-xs">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-48">Metric</th>
                        <th className="py-2.5 px-3 w-28">Unit</th>
                        <th className="py-2.5 px-3 w-32 text-right">Target Value</th>
                        <th className="py-2.5 px-3 w-32 text-right">Weight (%)</th>
                        <th className="py-2.5 px-3 min-w-40">Channel / Dimension</th>
                        <th className="py-2.5 px-3 w-16 text-center">Ramp</th>
                        <th className="py-2.5 px-3 w-20 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {lines.map((l, idx) => {
                        const metric = taskTypes.find((t) => t.id === l.task_type_id);
                        const isTouchpoint = metric?.kind === 'TOUCHPOINT';
                        return (
                          <React.Fragment key={l.key}>
                            <tr className="hover:bg-surface-high transition-colors">
                              <td className="py-2.5 px-3 text-center text-fg-muted font-mono">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <select
                                  className="w-full rounded bg-surface-raised border border-line px-2 py-1.5 text-xs text-fg focus:border-primary focus:outline-none"
                                  value={l.task_type_id}
                                  onChange={(e) =>
                                    updateLine(l.key, { task_type_id: e.target.value })
                                  }
                                >
                                  {groupedTaskTypes ? (
                                    <>
                                      {groupedTaskTypes.leadStage.length > 0 && (
                                        <optgroup label="Lead Stage Metrics">
                                          {groupedTaskTypes.leadStage.map((t) => (
                                            <option key={t.id} value={t.id}>
                                              {t.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      {groupedTaskTypes.standard.length > 0 && (
                                        <optgroup label="Standard Sales Metrics">
                                          {groupedTaskTypes.standard.map((t) => (
                                            <option key={t.id} value={t.id}>
                                              {t.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      {groupedTaskTypes.custom.length > 0 && (
                                        <optgroup label="Custom Metrics">
                                          {groupedTaskTypes.custom.map((t) => (
                                            <option key={t.id} value={t.id}>
                                              {t.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    </>
                                  ) : (
                                    taskTypes.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name}
                                      </option>
                                    ))
                                  )}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <span className="inline-block px-2 py-0.5 rounded bg-surface-raised border border-line text-xs text-fg-subtle font-mono truncate max-w-28">
                                  {metric?.unit || metric?.kind || 'count'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="w-full rounded bg-surface-raised border border-line px-2 py-1.5 text-xs text-fg text-right font-mono focus:border-primary focus:outline-none"
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
                                    className="w-full rounded bg-surface-raised border border-line pl-2 pr-5 py-1.5 text-xs text-fg text-right font-mono focus:border-primary focus:outline-none"
                                    value={l.weight ?? 0}
                                    onChange={(e) =>
                                      updateLine(l.key, { weight: Number(e.target.value) })
                                    }
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted text-xs pointer-events-none">%</span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                {isTouchpoint ? (
                                  <select
                                    className="w-full rounded bg-surface-raised border border-line px-2 py-1.5 text-xs text-fg focus:border-primary focus:outline-none"
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
                                  <span className="text-xs text-fg-muted italic px-1">All Channels / N/A</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  className="rounded border-line bg-surface-raised text-primary focus:ring-0 cursor-pointer"
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
                                    className="p-1 rounded hover:bg-surface-raised text-fg-subtle hover:text-fg transition-colors"
                                    title="Duplicate row"
                                  >
                                    <Copy size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeLine(l.key)}
                                    className="p-1 rounded hover:bg-surface-raised text-fg-muted hover:text-danger transition-colors"
                                    title="Remove line"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {l.useRamp && (
                              <tr className="bg-surface-sunken border-b border-line">
                                <td colSpan={8} className="px-4 py-2 text-xs">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-fg-subtle font-medium whitespace-nowrap">Ramp Curve:</span>
                                    <input
                                      className="flex-1 rounded bg-surface-raised border border-line px-2.5 py-1 text-xs text-fg font-mono focus:border-primary focus:outline-none"
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
                      <tr className="border-t border-line bg-surface-high text-xs font-semibold">
                        <td colSpan={3} className="py-2.5 px-3 text-fg-subtle">
                          Total Lines: <span className="text-fg">{lines.length}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-fg">
                          {lines.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              isWeightValid
                                ? 'bg-success/15 text-success border border-success/30'
                                : 'bg-warning/15 text-warning border border-warning/30'
                            }`}
                          >
                            {totalWeight.toFixed(1)}% {isWeightValid ? '✓ 100% Valid' : '⚠ Sum to 100%'}
                          </span>
                        </td>
                        <td colSpan={3} className="py-2.5 px-3 text-fg-muted text-right text-xs">
                          {!isWeightValid && 'Total line weights must equal 100% to save'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
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
        </Panel>
      )}

      {loading ? (
        <div className="text-sm text-fg-subtle">Loading plans…</div>
      ) : !plans.length ? (
        <EmptyState message="No target plans yet." />
      ) : (
        <Panel title="Plans">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-fg-subtle border-b border-line">
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
                  <tr key={p.id} className="border-b border-line">
                    <td className="py-2 pr-4 text-fg">{p.name}</td>
                    <td className="py-2 pr-4 text-fg-subtle">
                      {p.owner_type}
                      {p.owner_id ? (
                        <>
                          {' · '}
                          <PersonName id={p.owner_id} />
                        </>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-fg-subtle">{p.period}</td>
                    <td className="py-2 pr-4 text-fg-subtle">
                      {p.start_date} → {p.end_date}
                    </td>
                    <td className="py-2 pr-4 text-fg-subtle">{p.status}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-3">
                        {canEditPlan(shell) && (
                          <Button variant="secondary" size="sm"
                            onClick={() => setEditing(p.id)}
                          >
                            Edit
                          </Button>
                        )}
                        {canAllocatePlan(shell, p.owner_type) && (
                          <Button variant="secondary" size="sm"
                            onClick={() => setAllocating(p.id)}
                          >
                            Allocate
                          </Button>
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
              <label className="block text-xs font-medium text-fg-subtle mb-1">
                Metric Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full rounded bg-surface-raised border border-line px-3 py-2 text-sm text-fg placeholder-fg-subtle focus:border-primary focus:outline-none"
                placeholder="e.g. Enterprise Demos Held, Referral Introductions"
                value={customMetricName}
                onChange={(e) => setCustomMetricName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-fg-subtle mb-1">
                Metric Type / Kind
              </label>
              <div className="grid grid-cols-1 wc-medium:grid-cols-3 gap-nb-2">
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
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-line bg-surface-high text-fg-subtle hover:border-line'
                    }`}
                  >
                    <span className="font-semibold text-fg">{k.label}</span>
                    <span className="text-xs mt-0.5 text-fg-subtle">{k.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-fg-subtle mb-1">
                Measurement Unit
              </label>
              <input
                type="text"
                className="w-full rounded bg-surface-raised border border-line px-3 py-2 text-sm text-fg placeholder-fg-subtle focus:border-primary focus:outline-none font-mono"
                placeholder="count, currency, hours, calls, etc."
                value={customMetricUnit}
                onChange={(e) => setCustomMetricUnit(e.target.value)}
              />
            </div>

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
          isOpen={showLeadStageModal}
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
                    <button
                      key={stage.stage_id}
                      type="button"
                      disabled={leadStageSavingId === stage.stage_id}
                      onClick={async () => {
                        await handleAddLeadStageMetric(stage);
                        setShowLeadStageModal(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-line bg-surface-high hover:border-primary/40 text-left text-xs text-fg disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color || '#64748B' }}
                        />
                        {stage.name}
                      </span>
                      {leadStageSavingId === stage.stage_id && (
                        <Loader2 size={12} className="animate-spin text-fg-subtle" />
                      )}
                    </button>
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
    </DashboardPageTemplate>
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
