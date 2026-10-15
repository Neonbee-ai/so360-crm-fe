import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { EmptyState, Panel } from './targetUi';
import { DashboardPageTemplate, Button, DataTable, TextField, Select, Checkbox } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';

/**
 * Channel catalog admin.
 *
 * Channels are deliberately NOT tied to the Inbox platform list: a target
 * should be settable on a site visit, walk-in or trade show, none of which
 * have a software integration. Those channels are logged by the rep, which
 * makes them self-reported — hence they are excluded from compensation by
 * default and must be opted in deliberately.
 */
export default function TouchpointChannelsPage() {
  const shell = useShellBridge();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [actualsSource, setActualsSource] = useState<'auto' | 'manual'>(
    'manual',
  );

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
      .listChannels(true)
      .then(setChannels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (id: string, field: string, current: boolean) => {
    setBusy(true);
    try {
      await targetPlanService.updateChannel(id, { [field]: !current });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addChannel = async () => {
    if (!label.trim() || !value.trim()) return;
    const key = value.trim().toLowerCase().replace(/\s+/g, '_');

    // `crm_touchpoint_channels` has UNIQUE (org_id, value), and provisioning
    // seeds a set of system channels — so the most likely reason an add fails
    // is that the key already exists, possibly on a channel that is currently
    // INACTIVE and therefore invisible in the default list. A raw Postgres
    // duplicate-key message tells the user none of that.
    const clash = channels.find(
      (c: any) => String(c.value).toLowerCase() === key,
    );
    if (clash) {
      setError(
        clash.is_active === false
          ? `A channel with the key "${key}" already exists but is inactive — show inactive channels and reactivate it instead.`
          : `A channel with the key "${key}" already exists (${clash.label}). Pick a different key.`,
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await targetPlanService.createChannel({
        label: label.trim(),
        value: key,
        actuals_source: actualsSource,
      });
      setLabel('');
      setValue('');
      setNotice(`Added ${label.trim()}.`);
      load();
    } catch (e: any) {
      const raw = String(e?.message ?? '');
      setError(
        /duplicate key|already exists|unique/i.test(raw)
          ? `A channel with the key "${key}" already exists in this organisation. Pick a different key.`
          : raw || 'Could not add the channel.',
      );
    } finally {
      setBusy(false);
    }
  };

  const importSources = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await targetPlanService.importChannelsFromLeadSources();
      setNotice(
        `Imported ${res.imported} channel${res.imported === 1 ? '' : 's'} from lead sources` +
          (res.skipped ? `, ${res.skipped} already existed` : ''),
      );
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const flagCol = (key: string, header: string, field: string): DataTableColumn<any> => ({
    key,
    header,
    render: (c) => (
      <Checkbox
        name={`${field}-${c.id}`}
        label={header}
        aria-label={`${header} ${c.label}`}
        checked={!!c[field]}
        disabled={busy}
        onChange={() => toggle(c.id, field, !!c[field])}
      />
    ),
  });

  const columns: DataTableColumn<any>[] = [
    { key: 'channel', header: 'Channel', sortable: true, sortValue: (c) => c.label || '', render: (c) => (
      <span className="text-fg">
        {c.label}
        {c.linked_source_value && (
          <span className="ml-nb-2 text-xs text-fg-muted" title="Linked to an existing CRM lead source">
            ↔ lead source
          </span>
        )}
      </span>
    ) },
    { key: 'source', header: 'Source', render: (c) => <span className="text-fg-subtle">{c.actuals_source === 'auto' ? 'Auto' : 'Manual'}</span> },
    { key: 'bound', header: 'Bound to', render: (c) => (
      <span className="text-fg-muted text-xs">
        {c.emitter_binding ? `${c.emitter_binding.module} · ${c.emitter_binding.platform ?? c.emitter_binding.entity}` : '—'}
      </span>
    ) },
    flagCol('counts', 'Counts', 'counts_toward_targets'),
    flagCol('comp', 'Comp', 'comp_eligible'),
    flagCol('active', 'Active', 'is_active'),
  ];

  return (
    <DashboardPageTemplate
      title="Touchpoint Channels"
      secondaryActions={(
        <Button variant="secondary" onClick={importSources} disabled={busy}>
          Import from Lead Sources
        </Button>
      )}
    >
    <div className="space-y-5">

      {error && <div className="text-sm text-danger">{error}</div>}
      {notice && <div className="text-sm text-success">{notice}</div>}

      <Panel title="Add a channel">
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            name="channel_label"
            label="Label"
            value={label}
            onChange={(e: any) => setLabel(e.target.value)}
            placeholder="Site Visit"
          />
          <TextField
            name="channel_key"
            label="Key"
            value={value}
            onChange={(e: any) => setValue(e.target.value)}
            placeholder="site_visit"
          />
          <Select
            name="channel_actuals"
            label="Actuals"
            value={actualsSource}
            onChange={(e: any) => setActualsSource(e.target.value as any)}
            options={[
              { value: 'manual', label: 'Manual (rep logs it)' },
              { value: 'auto', label: 'Auto (system emits it)' },
            ]}
          />
          <Button variant="primary" size="sm"
            onClick={addChannel}
            disabled={busy || !label.trim() || !value.trim()}
          >
            Add
          </Button>
        </div>
        {actualsSource === 'auto' && (
          <div className="mt-2 text-xs text-warning">
            Auto channels need an emitter binding — configure it via the API
            until the binding picker ships.
          </div>
        )}
      </Panel>

      {loading ? (
        <div className="text-sm text-fg-subtle">Loading channels…</div>
      ) : !channels.length ? (
        <EmptyState message="No channels configured. Import from lead sources or add one above." />
      ) : (
        <Panel title="Channels">
          <DataTable
            columns={columns}
            rows={channels}
            rowKey={(c: any) => c.id}
          />

          <div className="mt-3 space-y-1 text-xs text-fg-muted">
            <div>
              ↔ linked to an existing CRM lead source — configured once,
              reconcilable in reporting
            </div>
            <div className="text-warning">
              ⚠ Manual channels are self-reported. Compensation eligibility is
              off by default and must be enabled deliberately.
            </div>
          </div>
        </Panel>
      )}
    </div>
    </DashboardPageTemplate>
  );
}
