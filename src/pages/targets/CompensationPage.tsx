import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PersonName,
  loadDirectoryPeople,
  personIdOf,
  formatValue,
} from './targetUi';
import {
  EMPTY_INCENTIVE_RULE,
  buildIncentiveRulePayload,
  type IncentiveRuleForm,
  type IncentiveRuleType,
} from './incentiveRule';
import { PeopleSelector, DashboardPageTemplate, Button, DataTable, TextField, Select, DatePicker, DateInput, FormField, Card, Modal, Grid, GridItem } from '@so360/design-system';
import { Calculator, Plus } from 'lucide-react';
import type { DataTableColumn } from '@so360/design-system';

/**
 * Incentive and commission review.
 *
 * ⚠ ADVISORY ONLY. Nothing on this screen or behind it writes to payroll,
 * triggers a payment, or marks anything payable — the figure exists for a
 * manager to read and approve.
 *
 * That boundary is deliberate. Part of the input can come from self-reported
 * manual channels, so an automated payout would be a materially different risk
 * from a number a human signs off. Manual channels are excluded from per-unit
 * bases by default for the same reason, and the basis line says so explicitly
 * when an exclusion applied.
 */
export default function CompensationPage() {
  const shell = useShellBridge();
  const [rules, setRules] = useState<any[]>([]);
  const [calc, setCalc] = useState<any | null>(null);
  const [personId, setPersonId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<IncentiveRuleForm>(EMPTY_INCENTIVE_RULE);

  // `base_currency` is the field Core actually returns on business_settings.
  // Reading `currency` yielded undefined, so every money figure on these
  // screens formatted as USD regardless of the org's configured currency.
  const currency = (shell as any)?.businessSettings?.base_currency ?? undefined;

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      targetPlanService.setTenantId(shell.currentTenant.id);
      targetPlanService.setOrgId(shell.currentOrg?.id ?? '');
      targetPlanService.setAccessToken(shell.accessToken ?? '');
      salesTargetService.setTenantId(shell.currentTenant.id);
      salesTargetService.setOrgId(shell.currentOrg?.id ?? '');
      salesTargetService.setAccessToken(shell.accessToken ?? '');
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  // Attainment and per-unit rules watch a configured metric, so the picker has
  // to offer the org's real metric list rather than a free-text id.
  useEffect(() => {
    salesTargetService
      .listTaskTypes()
      .then((rows) => setTaskTypes(Array.isArray(rows) ? rows : []))
      .catch(() => setTaskTypes([]));
  }, []);

  const saveRule = async () => {
    const built = buildIncentiveRulePayload(form);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await targetPlanService.createIncentiveRule(built.payload);
      setForm(EMPTY_INCENTIVE_RULE);
      setShowRuleForm(false);
      load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    targetPlanService
      .listIncentiveRules()
      .then(setRules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // Default to the current calendar month, which is the period a manager
    // almost always wants first.
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setPeriodStart(first.toISOString().slice(0, 10));
    setPeriodEnd(last.toISOString().slice(0, 10));
  }, [load]);

  const calculate = async () => {
    if (!personId || !periodStart || !periodEnd) return;
    setBusy(true);
    setError(null);
    try {
      setCalc(
        await targetPlanService.calculateIncentives(
          personId,
          periodStart,
          periodEnd,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const summaryColumns: DataTableColumn<any>[] = [
    { key: 'component', header: 'Component', render: (c) => <span className={c.__total ? 'font-medium text-fg' : 'text-fg'}>{c.rule_name}</span> },
    { key: 'basis', header: 'Basis', render: (c) => c.__total ? null : (
      <span className="text-fg-subtle text-xs">
        {c.basis}
        {!c.eligible && <span className="text-fg-muted"> — not eligible</span>}
      </span>
    ) },
    { key: 'amount', header: 'Amount', align: 'right', render: (c) => <span className={c.__total ? 'font-medium text-fg' : 'text-fg'}>{formatValue(c.amount, 'currency', currency)}</span> },
  ];

  const ruleColumns: DataTableColumn<any>[] = [
    { key: 'name', header: 'Name', sortable: true, sortValue: (r) => r.name || '', render: (r) => <span className="text-fg">{r.name}</span> },
    { key: 'type', header: 'Type', render: (r) => <span className="text-fg-subtle">{r.rule_type}</span> },
    { key: 'trigger', header: 'Trigger', render: (r) => (
      <span className="text-fg-subtle text-xs">
        {r.rule_type === 'attainment_bonus' && `at ${Math.round(Number(r.attainment_threshold ?? 1) * 100)}% attainment`}
        {r.rule_type === 'per_unit' && `${formatValue(r.amount, 'currency', currency)} per unit`}
        {r.rule_type === 'deal_commission' && `${(r.bands ?? []).length} band${(r.bands ?? []).length === 1 ? '' : 's'}`}
      </span>
    ) },
    { key: 'scope', header: 'Scope', render: (r) => (
      <span className="text-fg-subtle text-xs">
        {r.applies_to_person_id ? <PersonName id={r.applies_to_person_id} /> : r.applies_to_role ? r.applies_to_role : 'all'}
      </span>
    ) },
  ];

  return (
    <DashboardPageTemplate
      trail={[{ label: 'Targets', to: '/crm/targets' }]}
      title="Compensation"
      meta={<span className="text-xs text-warning">⚠ For manager review only. No payroll or payment action is taken.</span>}
      primaryAction={(
        <Button variant="primary" onClick={() => { setFormError(null); setShowRuleForm(true); }}>
          <Plus size={16} aria-hidden="true" /> Add rule
        </Button>
      )}
      filters={(
        <Grid columns={12}>
          <GridItem span={6}>
            <FormField label="Person" name="comp_person">
              <PeopleSelector clearable loadOptions={loadDirectoryPeople} value={personId} onChange={(id) => setPersonId(personIdOf(id))} />
            </FormField>
          </GridItem>
          <GridItem span={3}>
            <DateInput name="comp_from" label="From" value={periodStart} onChange={(iso: string) => setPeriodStart(iso)} />
          </GridItem>
          <GridItem span={3}>
            <DateInput name="comp_to" label="To" value={periodEnd} onChange={(iso: string) => setPeriodEnd(iso)} />
          </GridItem>
          <GridItem span={12}>
            <Button variant="primary" onClick={calculate} disabled={busy || !personId}>
              {busy ? 'Calculating…' : 'Calculate'}
            </Button>
          </GridItem>
        </Grid>
      )}
    >
    <div className="space-y-5">

      {error && !loading && <ErrorState error={error} onRetry={load} />}

      {calc && (
        <Card title="Incentive summary">
          <DataTable
            columns={summaryColumns}
            rows={[
              ...(calc.components ?? []),
              { rule_id: '__total', rule_name: 'Total calculated', __total: true, amount: calc.total_amount },
            ]}
            rowKey={(c: any) => c.rule_id}
          />
          <div className="mt-3 text-xs text-warning">
            {calc.advisory_notice}
          </div>
        </Card>
      )}

      <Modal
        open={showRuleForm}
        onClose={() => setShowRuleForm(false)}
        title="New rule"
        description="Rules are read during calculation only. Adding one never pays anyone."
        size="lg"
        dismissible={!busy}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowRuleForm(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveRule} disabled={busy}>
              Save rule
            </Button>
          </>
        )}
      >
        {formError && <div className="mb-nb-3 text-sm text-danger">{formError}</div>}
    <div className="space-y-nb-3">
      <div className="space-y-nb-3">
        <div>
          <TextField
            name="rule_name"
            label="Name"
            aria-label="Rule name"
            value={form.name}
            error={formError === 'Rule name is required.' ? formError : undefined}
            onChange={(e: any) => setForm({ ...form, name: e.target.value })}
            placeholder="Q3 new-business bonus"
          />
        </div>
        <Select
          name="rule_type"
          label="Type"
          aria-label="Rule type"
          value={form.rule_type}
          onChange={(e: any) => setForm({ ...form, rule_type: e.target.value as IncentiveRuleType })}
          options={[
            { value: 'attainment_bonus', label: 'Bonus at attainment' },
            { value: 'per_unit', label: 'Per unit of a metric' },
            { value: 'deal_commission', label: 'Deal commission' },
          ]}
        />

        {form.rule_type !== 'deal_commission' && (
          <>
            <Select
              name="rule_metric"
              label="Metric"
              aria-label="Metric"
              value={form.task_type_id}
              onChange={(e: any) => setForm({ ...form, task_type_id: e.target.value })}
              options={[{ value: '', label: 'Select…' }, ...taskTypes.map((t) => ({ value: t.id, label: t.name }))]}
            />
            <TextField
              name="rule_amount"
              label="Amount"
              aria-label="Amount"
              value={form.amount}
              onChange={(e: any) => setForm({ ...form, amount: e.target.value })}
            />
          </>
        )}

        {form.rule_type === 'attainment_bonus' && (
          <TextField
            name="rule_threshold"
            label="At attainment (%)"
            aria-label="Attainment threshold"
            value={form.attainment_threshold_pct}
            onChange={(e: any) => setForm({ ...form, attainment_threshold_pct: e.target.value })}
          />
        )}
      </div>

      {form.rule_type === 'deal_commission' && (
        <div className="space-y-2">
          <div className="text-xs text-fg-subtle">
            Bands by deal value. Leave the top band&apos;s maximum empty
            so the largest deals still earn commission.
          </div>
          {form.bands.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              {(['min', 'max', 'percent'] as const).map((f) => (
                <TextField
                  key={f}
                  name={`band_${i}_${f}`}
                  aria-label={`Band ${i + 1} ${f === 'percent' ? 'percent' : f === 'min' ? 'minimum' : 'maximum'}`}
                  placeholder={f === 'min' ? 'min' : f === 'max' ? 'max (open)' : '%'}
                  value={b[f]}
                  onChange={(e: any) => {
                    const bands = [...form.bands];
                    bands[i] = { ...b, [f]: e.target.value };
                    setForm({ ...form, bands });
                  }}
                />
              ))}
              {form.bands.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Remove band ${i + 1}`}
                  onClick={() =>
                    setForm({
                      ...form,
                      bands: form.bands.filter((_, j) => j !== i),
                    })
                  }
                >
                  remove
                </Button>
              )}
            </div>
          ))}
          <Button variant="secondary" size="sm"
            onClick={() =>
              setForm({
                ...form,
                bands: [...form.bands, { min: '', max: '', percent: '' }],
              })
            }
          >
            + band
          </Button>
        </div>
      )}

      <div className="space-y-nb-3">
        <Select
          name="rule_scope"
          label="Applies to"
          aria-label="Scope"
          value={form.scope}
          onChange={(e: any) => setForm({ ...form, scope: e.target.value as IncentiveRuleForm['scope'] })}
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'role', label: 'A role' },
            { value: 'person', label: 'One person' },
          ]}
        />
        {form.scope === 'role' && (
          <TextField
            name="rule_role"
            label="Role"
            aria-label="Role"
            value={form.applies_to_role}
            onChange={(e: any) => setForm({ ...form, applies_to_role: e.target.value })}
          />
        )}
        {form.scope === 'person' && (
          <FormField label="Person" name="rule_person">
            <PeopleSelector
              clearable
              loadOptions={loadDirectoryPeople}
              value={form.applies_to_person_id}
              onChange={(id) => setForm({ ...form, applies_to_person_id: personIdOf(id) })}
            />
          </FormField>
        )}
        <DatePicker name="rule_from" label="From" aria-label="Effective from" value={form.effective_from} onChange={(iso: string) => setForm({ ...form, effective_from: iso })} />
        <DatePicker name="rule_to" label="To" aria-label="Effective to" value={form.effective_to} onChange={(iso: string) => setForm({ ...form, effective_to: iso })} />
      </div>
    </div>

      </Modal>

      {loading ? (
        <LoadingState />
      ) : !rules.length ? (
        error ? null : (
          <EmptyState
            icon={Calculator}
            title="No incentive rules"
            description="Add a rule to start calculating incentives and commissions."
            action={{ label: 'Add rule', onClick: () => { setFormError(null); setShowRuleForm(true); } }}
          />
        )
      ) : (
        <Card title="Rules">
          <DataTable columns={ruleColumns} rows={rules} rowKey={(r: any) => r.id} />
        </Card>
      )}
    </div>
    </DashboardPageTemplate>
  );
}
