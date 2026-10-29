import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { Plus, Radio } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
} from './targetUi';
import { ListPageTemplate, Button, DataTable, TextField, Select, Checkbox, Modal, SearchInput, Alert } from '@so360/design-system';
import type { DataTableColumn, FilterValues } from '@so360/design-system';

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
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ source: '', active: '' });
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | undefined>(undefined);
  const [keyError, setKeyError] = useState<string | undefined>(undefined);
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
    const lErr = label.trim() ? undefined : 'Label is required.';
    const kErr = value.trim() ? undefined : 'Key is required.';
    setLabelError(lErr);
    setKeyError(kErr);
    if (lErr || kErr) return;
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
      setFormError(
        clash.is_active === false
          ? `A channel with the key "${key}" already exists but is inactive — show inactive channels and reactivate it instead.`
          : `A channel with the key "${key}" already exists (${clash.label}). Pick a different key.`,
      );
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      await targetPlanService.createChannel({
        label: label.trim(),
        value: key,
        actuals_source: actualsSource,
      });
      setLabel('');
      setValue('');
      setAddOpen(false);
      setNotice(`Added ${label.trim()}.`);
      load();
    } catch (e: any) {
      const raw = String(e?.message ?? '');
      setFormError(
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

  const openAdd = () => {
    setFormError(null);
    setLabelError(undefined);
    setKeyError(undefined);
    setAddOpen(true);
  };

  const q = search.trim().toLowerCase();
  const rows = channels.filter(
    (c) =>
      (!filters.source || c.actuals_source === filters.source) &&
      (!filters.active || String(!!c.is_active) === filters.active) &&
      (!q || (c.label || '').toLowerCase().includes(q)),
  );

  return (
    <>
    <ListPageTemplate
      trail={[{ label: 'Targets', to: '/crm/targets' }]}
      title="Touchpoint Channels"
      count={channels.length}
      headerSecondaryActions={[
        <Button key="import" variant="secondary" onClick={importSources} disabled={busy}>
          Import from Lead Sources
        </Button>,
      ]}
      primaryAction={(
        <Button variant="primary" onClick={openAdd}>
          <Plus size={16} aria-hidden="true" /> Add channel
        </Button>
      )}
      search={<SearchInput value={search} onChange={setSearch} placeholder="Search channels…" />}
      filterConfig={{
        fields: [
          { key: 'source', label: 'Source', type: 'select', options: [
            { value: 'auto', label: 'Auto' },
            { value: 'manual', label: 'Manual' },
          ] },
          { key: 'active', label: 'Active', type: 'select', options: [
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ] },
        ],
        values: filters,
        onChange: setFilters,
        onClear: () => setFilters({ source: '', active: '' }),
      }}
      loading={loading}
      isEmpty={!loading && (!!error || !channels.length)}
      empty={
        error ? (
          <ErrorState error={error} onRetry={load} />
        ) : (
          <EmptyState
            icon={Radio}
            title="No channels configured"
            description="Import your lead sources or add a channel to start tracking touchpoints."
            action={{ label: 'Add channel', onClick: openAdd }}
          />
        )
      }
      isFilteredEmpty={!loading && channels.length > 0 && !rows.length}
      onClearFilters={() => { setFilters({ source: '', active: '' }); setSearch(''); }}
      footer={(
        <div className="space-y-1 text-xs text-fg-muted">
          <div>
            ↔ linked to an existing CRM lead source — configured once,
            reconcilable in reporting
          </div>
          <div className="text-warning">
            ⚠ Manual channels are self-reported. Compensation eligibility is
            off by default and must be enabled deliberately.
          </div>
        </div>
      )}
    >
      {notice && <Alert variant="success">{notice}</Alert>}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c: any) => c.id}
      />
    </ListPageTemplate>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a channel"
        size="md"
        dismissible={!busy}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={addChannel}
              disabled={busy}
            >
              Add channel
            </Button>
          </>
        )}
      >
        <div className="space-y-nb-3">
          {formError && <div className="text-sm text-danger">{formError}</div>}
          <TextField
            name="channel_label"
            label="Label"
            value={label}
            error={labelError}
            onChange={(e: any) => { setLabel(e.target.value); setLabelError(undefined); }}
            placeholder="Site Visit"
          />
          <TextField
            name="channel_key"
            label="Key"
            value={value}
            error={keyError}
            onChange={(e: any) => { setValue(e.target.value); setKeyError(undefined); }}
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
          {actualsSource === 'auto' && (
            <div className="text-xs text-warning">
              Auto channels need an emitter binding — configure it via the API
              until the binding picker ships.
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
