import React, { useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { salesTargetService } from '../../services/salesTargetService';

const PERIOD_LABELS: Record<string, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' };

export default function AdminTargetsPage() {
  const shell = useShellBridge();
  const [targets, setTargets] = useState<any[]>([]);
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    task_type_id: '',
    owner_type: 'rep',
    owner_id: '',
    value: 10,
    period: 'week',
  });

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      salesTargetService.setTenantId(shell.currentTenant.id);
      salesTargetService.setOrgId(shell.currentOrg?.id ?? '');
      salesTargetService.setAccessToken(shell.accessToken ?? '');
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  const load = () => {
    setLoading(true);
    Promise.all([
      salesTargetService.listTargets(),
      salesTargetService.listTaskTypes(),
    ])
      .then(([t, tt]) => { setTargets(t); setTaskTypes(tt); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        task_type_id: form.task_type_id,
        owner_type: form.owner_type,
        value: form.value,
        period: form.period,
      };
      if (form.owner_type === 'rep' && form.owner_id) body.owner_id = form.owner_id;
      await salesTargetService.createTarget(body);
      setShowModal(false);
      setForm({ task_type_id: '', owner_type: 'rep', owner_id: '', value: 10, period: 'week' });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this target?')) return;
    try {
      await salesTargetService.deleteTarget(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Targets</h1>
          <p className="text-sm text-slate-400 mt-1">Assign activity targets to reps, teams, or the whole org</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
        >
          + Assign Target
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-400 text-sm">Loading…</div>
      ) : (
        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Activity Type</th>
                <th className="px-4 py-3 text-left">Owner</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {targets.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No targets assigned yet</td></tr>
              )}
              {targets.map((t: any) => (
                <tr key={t.id} className="bg-slate-950 hover:bg-slate-900 transition-colors">
                  <td className="px-4 py-3 text-slate-100 font-medium">{t.task_type?.name ?? t.task_type_id}</td>
                  <td className="px-4 py-3 text-slate-400">
                    <span className="capitalize">{t.owner_type}</span>
                    {t.owner_id && <span className="ml-1 text-slate-500 text-xs font-mono">…{t.owner_id.slice(-6)}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {t.value} / {PERIOD_LABELS[t.period] ?? t.period}
                    <span className="ml-2 text-slate-500 text-xs">{t.task_type?.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Assign Target</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Activity Type</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  value={form.task_type_id}
                  onChange={e => setForm(f => ({ ...f, task_type_id: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {taskTypes.filter(tt => tt.active).map((tt: any) => (
                    <option key={tt.id} value={tt.id}>{tt.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Owner Type</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  value={form.owner_type}
                  onChange={e => setForm(f => ({ ...f, owner_type: e.target.value }))}
                >
                  <option value="rep">Rep (individual)</option>
                  <option value="team">Team</option>
                  <option value="org">Org-wide</option>
                </select>
              </div>

              {form.owner_type === 'rep' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Rep Person ID</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="people.id of the rep"
                    value={form.owner_id}
                    onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Target Value</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Period</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    value={form.period}
                    onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.task_type_id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
              >
                {saving ? 'Saving…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
