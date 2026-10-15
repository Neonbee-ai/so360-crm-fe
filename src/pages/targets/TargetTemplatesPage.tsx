import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import { FileStack } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  loadDirectoryPeople,
  personIdOf,
} from './targetUi';
import { PeopleSelector, ListPageTemplate, DataTable, SearchInput, Alert, Modal, Stack, FormField, Button, DatePicker } from '@so360/design-system';
import type { DataTableColumn, FilterValues } from '@so360/design-system';

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

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ period: '' });
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

  const periodOptions = Array.from(new Set(templates.map((t) => t.period).filter(Boolean))).map(
    (p: any) => ({ value: String(p), label: String(p) }),
  );
  const q = search.trim().toLowerCase();
  const rows = templates.filter(
    (t) =>
      (!filters.period || t.period === filters.period) &&
      (!q || [t.name, t.role, t.description].some((v) => (v || '').toLowerCase().includes(q))),
  );

  const columns: DataTableColumn<any>[] = [
    {
      key: 'name',
      header: 'Template',
      sortable: true,
      sortValue: (t) => t.name ?? '',
      render: (t) => (
        <div>
          <div className="text-fg">{t.name}</div>
          {t.description && <div className="text-xs text-fg-subtle">{t.description}</div>}
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (t) => <span className="text-fg-subtle">{t.role || '—'}</span> },
    { key: 'period', header: 'Period', render: (t) => <span className="text-fg-subtle">{t.period}</span> },
    {
      key: 'duration',
      header: 'Duration',
      render: (t) => (
        <span className="text-fg-subtle">
          {t.duration_periods} period{t.duration_periods === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Metrics',
      render: (t) =>
        (t.lines ?? []).length ? (
          <div className="space-y-1">
            {(t.lines ?? []).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between gap-nb-4 text-xs text-fg-subtle">
                <span>
                  {l.task_type?.name ?? nameOf(l.task_type_id)}
                  {l.dimension_value ? ` · ${l.dimension_value}` : ''}
                </span>
                <span>{l.ramp && l.ramp.length ? l.ramp.join(' → ') : Number(l.value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-fg-muted">No lines</span>
        ),
    },
  ];

  return (
    <>
      <ListPageTemplate
        title="Target Templates"
        count={templates.length}
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />}
        filterConfig={{
          fields: [{ key: 'period', label: 'Period', type: 'select', options: periodOptions }],
          values: filters,
          onChange: setFilters,
          onClear: () => setFilters({ period: '' }),
        }}
        loading={loading}
        isEmpty={!loading && !templates.length}
        empty={
          error ? (
            <ErrorState error={error} onRetry={load} />
          ) : (
            <EmptyState
              icon={FileStack}
              title="No templates yet"
              description="A template captures a role's standard metrics and ramp so a new hire can be set up in one step."
            />
          )
        }
      >
        {error && templates.length > 0 && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(t: any) => t.id}
          rowActions={(t: any) => [{ label: 'Assign…', onSelect: () => setAssigning(t) }]}
        />
      </ListPageTemplate>

      <Modal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        title={assigning ? `Assign "${assigning.name}"` : 'Assign template'}
        description="Lines are copied into the new plan. Editing this template later will not change the plan you create here."
        size="md"
        dismissible={!busy}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setAssigning(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={assign}
              disabled={busy || !ownerId || !startDate || !endDate}
            >
              {busy ? 'Creating…' : 'Create plan'}
            </Button>
          </>
        )}
      >
        <Stack>
          <FormField label="Person" name="template_person">
            <PeopleSelector loadOptions={loadDirectoryPeople} value={ownerId} onChange={(id) => setOwnerId(personIdOf(id))} />
          </FormField>
          <DatePicker
            name="template_startDate"
            label="Start"
            value={startDate}
            onChange={(iso: string) => setStartDate(iso)}
          />
          <DatePicker
            name="template_endDate"
            label="End"
            value={endDate}
            onChange={(iso: string) => setEndDate(iso)}
          />
        </Stack>
      </Modal>
    </>
  );
}
