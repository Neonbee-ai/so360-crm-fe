import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { salesTargetService } from '../../services/salesTargetService';
import { EmptyState, Panel, PersonPicker } from './targetUi';
import { DashboardPageTemplate, Button, DatePicker } from '@so360/design-system';

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

  if (loading) {
    return <div className="text-sm text-fg-subtle">Loading templates…</div>;
  }

  return (
    <DashboardPageTemplate title="Target Templates">
    <div className="space-y-5">

      {error && <div className="text-sm text-danger">{error}</div>}
      {notice && <div className="text-sm text-success">{notice}</div>}

      {!templates.length ? (
        <EmptyState message="No templates yet. A template captures a role's standard metrics and ramp so a new hire can be set up in one step." />
      ) : (
        <div className="flex flex-wrap gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-line bg-surface-sunken p-4 grow basis-80 max-w-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-fg">
                    {t.name}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {t.role ? `${t.role} · ` : ''}
                    {t.period} · {t.duration_periods} period
                    {t.duration_periods === 1 ? '' : 's'}
                  </div>
                </div>
                <Button variant="secondary" size="sm"
                  onClick={() => setAssigning(t)}
                >
                  Assign
                </Button>
              </div>

              {t.description && (
                <div className="mt-2 text-xs text-fg-subtle">
                  {t.description}
                </div>
              )}

              <div className="mt-3 space-y-1">
                {(t.lines ?? []).map((l: any) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-fg-subtle">
                      {l.task_type?.name ?? nameOf(l.task_type_id)}
                      {l.dimension_value ? ` · ${l.dimension_value}` : ''}
                    </span>
                    <span className="text-fg-subtle">
                      {l.ramp && l.ramp.length
                        ? l.ramp.join(' → ')
                        : Number(l.value)}
                    </span>
                  </div>
                ))}
                {!(t.lines ?? []).length && (
                  <div className="text-xs text-fg-muted">No lines</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {assigning && (
        <Panel
          title={`Assign "${assigning.name}"`}
          action={
            <Button variant="secondary" size="sm"
              onClick={() => setAssigning(null)}
            >
              Cancel
            </Button>
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64">
              <label className="block text-xs text-fg-subtle mb-1">
                Person
              </label>
              <PersonPicker value={ownerId} onChange={setOwnerId} />
            </div>
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
            <Button variant="primary" size="sm"
              onClick={assign}
              disabled={busy || !ownerId || !startDate || !endDate}
            >
              {busy ? 'Creating…' : 'Create plan'}
            </Button>
          </div>
          <div className="mt-2 text-xs text-fg-muted">
            Lines are copied into the new plan. Editing this template later will
            not change the plan you create here.
          </div>
        </Panel>
      )}
    </div>
    </DashboardPageTemplate>
  );
}
