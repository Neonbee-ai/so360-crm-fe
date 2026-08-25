import React, { useCallback, useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { targetPlanService } from '../../services/targetPlanService';
import { EmptyState, Panel } from './targetUi';

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
    setBusy(true);
    setError(null);
    try {
      await targetPlanService.createChannel({
        label: label.trim(),
        value: value.trim().toLowerCase().replace(/\s+/g, '_'),
        actuals_source: actualsSource,
      });
      setLabel('');
      setValue('');
      load();
    } catch (e: any) {
      setError(e.message);
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

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">
          Touchpoint Channels
        </h1>
        <button
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
          onClick={importSources}
          disabled={busy}
        >
          Import from Lead Sources
        </button>
      </div>

      {error && <div className="text-sm text-rose-300">{error}</div>}
      {notice && <div className="text-sm text-emerald-300">{notice}</div>}

      <Panel title="Add a channel">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Label
            </label>
            <input
              className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Site Visit"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Key</label>
            <input
              className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="site_visit"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Actuals
            </label>
            <select
              className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={actualsSource}
              onChange={(e) => setActualsSource(e.target.value as any)}
            >
              <option value="manual">Manual (rep logs it)</option>
              <option value="auto">Auto (system emits it)</option>
            </select>
          </div>
          <button
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:opacity-50"
            onClick={addChannel}
            disabled={busy || !label.trim() || !value.trim()}
          >
            Add
          </button>
        </div>
        {actualsSource === 'auto' && (
          <div className="mt-2 text-[11px] text-amber-300">
            Auto channels need an emitter binding — configure it via the API
            until the binding picker ships.
          </div>
        )}
      </Panel>

      {loading ? (
        <div className="text-sm text-slate-400">Loading channels…</div>
      ) : !channels.length ? (
        <EmptyState message="No channels configured. Import from lead sources or add one above." />
      ) : (
        <Panel title="Channels">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-4 font-medium">Channel</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Bound to</th>
                  <th className="py-2 pr-4 font-medium">Counts</th>
                  <th className="py-2 pr-4 font-medium">Comp</th>
                  <th className="py-2 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-4 text-slate-200">
                      {c.label}
                      {c.linked_source_value && (
                        <span
                          className="ml-2 text-[11px] text-slate-500"
                          title="Linked to an existing CRM lead source"
                        >
                          ↔ lead source
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">
                      {c.actuals_source === 'auto' ? 'Auto' : 'Manual'}
                    </td>
                    <td className="py-2 pr-4 text-slate-500 text-xs">
                      {c.emitter_binding
                        ? `${c.emitter_binding.module} · ${c.emitter_binding.platform ?? c.emitter_binding.entity}`
                        : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={!!c.counts_toward_targets}
                        disabled={busy}
                        onChange={() =>
                          toggle(
                            c.id,
                            'counts_toward_targets',
                            !!c.counts_toward_targets,
                          )
                        }
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={!!c.comp_eligible}
                        disabled={busy}
                        onChange={() =>
                          toggle(c.id, 'comp_eligible', !!c.comp_eligible)
                        }
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={!!c.is_active}
                        disabled={busy}
                        onChange={() =>
                          toggle(c.id, 'is_active', !!c.is_active)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 space-y-1 text-[11px] text-slate-500">
            <div>
              ↔ linked to an existing CRM lead source — configured once,
              reconcilable in reporting
            </div>
            <div className="text-amber-300">
              ⚠ Manual channels are self-reported. Compensation eligibility is
              off by default and must be enabled deliberately.
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
