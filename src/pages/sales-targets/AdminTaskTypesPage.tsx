import React, { useEffect, useState } from 'react';
import { useShellBridge } from '@so360/shell-context';
import { salesTargetService } from '../../services/salesTargetService';

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  FLOW_TRANSITION: 'Flow Transition',
  CRM_TABLE: 'CRM Auto',
};

const INDUSTRY_OPTIONS = [
  'all', 'professional_services', 'ecommerce', 'trading', 'construction', 'services',
];

const CRM_TABLE_RULES = [
  { label: 'New Lead Created', rule: { table: 'leads', owner_col: 'owner_person_id', date_col: 'created_at' } },
  { label: 'Deal Created', rule: { table: 'deals', owner_col: 'owner_person_id', date_col: 'created_at' } },
  { label: 'Deal Won', rule: { table: 'deals', owner_col: 'owner_person_id', date_col: 'won_at' } },
];

const EMPTY_FORM = {
  name: '',
  source: 'MANUAL',
  industry_tags: [] as string[],
  unit: '',
  flow_trigger: { entity_type: '', transition_key: '' },
  crm_table_rule_preset: '',
};

export default function AdminTaskTypesPage() {
  const shell = useShellBridge();
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState('all');

  useEffect(() => {
    if (shell?.currentTenant?.id) {
      salesTargetService.setTenantId(shell.currentTenant.id);
      salesTargetService.setOrgId(shell.currentOrg?.id ?? '');
      salesTargetService.setAccessToken(shell.accessToken ?? '');
    }
  }, [shell?.currentTenant?.id, shell?.currentOrg?.id, shell?.accessToken]);

  const load = () => {
    setLoading(true);
    salesTargetService.listTaskTypes()
      .then(setTaskTypes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const preset = CRM_TABLE_RULES.find(r => r.label === form.crm_table_rule_preset);
      const body: any = {
        name: form.name,
        source: form.source,
        industry_tags: form.industry_tags,
        unit: form.unit || 'activities',
      };
      if (form.source === 'FLOW_TRANSITION') body.flow_trigger = form.flow_trigger;
      if (form.source === 'CRM_TABLE' && preset) body.crm_table_rule = preset.rule;

      await salesTargetService.createTaskType(body);
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (tt: any) => {
    try {
      await salesTargetService.updateTaskType(tt.id, { active: !tt.active });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (tt: any) => {
    if (!confirm(`Delete "${tt.name}"?`)) return;
    try {
      await salesTargetService.deleteTaskType(tt.id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const visible = taskTypes.filter(tt =>
    filterIndustry === 'all' || (tt.industry_tags ?? []).includes(filterIndustry)
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Sales Activity Types</h1>
          <p className="text-sm text-slate-400 mt-1">Define what activities reps track — auto-counted or manual</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
        >
          + New Type
        </button>
      </div>

      {/* Industry filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {INDUSTRY_OPTIONS.map(ind => (
          <button
            key={ind}
            type="button"
            onClick={() => setFilterIndustry(ind)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterIndustry === ind
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {ind === 'all' ? 'All industries' : ind.replace(/_/g, ' ')}
          </button>
        ))}
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
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Unit</th>
                <th className="px-4 py-3 text-left">Industries</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No task types yet</td></tr>
              )}
              {visible.map((tt: any) => (
                <tr key={tt.id} className="bg-slate-950 hover:bg-slate-900 transition-colors">
                  <td className="px-4 py-3 text-slate-100 font-medium">
                    {tt.name}
                    {tt.is_predefined && (
                      <span className="ml-2 text-xs text-slate-500 font-normal">(predefined)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tt.source === 'MANUAL' ? 'bg-slate-700 text-slate-300'
                      : tt.source === 'FLOW_TRANSITION' ? 'bg-purple-900/50 text-purple-300'
                      : 'bg-green-900/50 text-green-300'
                    }`}>
                      {SOURCE_LABELS[tt.source] ?? tt.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{tt.unit}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {(tt.industry_tags ?? []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(tt)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${tt.active ? 'bg-green-600' : 'bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tt.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!tt.is_predefined && (
                      <button
                        type="button"
                        onClick={() => handleDelete(tt)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">New Activity Type</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. LinkedIn DM Sent"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Source</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                >
                  <option value="MANUAL">Manual (off-platform — rep taps +1)</option>
                  <option value="FLOW_TRANSITION">Flow Transition (auto-counted from workflow)</option>
                  <option value="CRM_TABLE">CRM Auto (counted from leads/deals table)</option>
                </select>
              </div>

              {form.source === 'FLOW_TRANSITION' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Entity Type</label>
                    <input
                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                      placeholder="e.g. deal"
                      value={form.flow_trigger.entity_type}
                      onChange={e => setForm(f => ({ ...f, flow_trigger: { ...f.flow_trigger, entity_type: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Transition Key</label>
                    <input
                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                      placeholder="e.g. sent_proposal"
                      value={form.flow_trigger.transition_key}
                      onChange={e => setForm(f => ({ ...f, flow_trigger: { ...f.flow_trigger, transition_key: e.target.value } }))}
                    />
                  </div>
                </div>
              )}

              {form.source === 'CRM_TABLE' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Count Rule</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    value={form.crm_table_rule_preset}
                    onChange={e => setForm(f => ({ ...f, crm_table_rule_preset: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {CRM_TABLE_RULES.map(r => (
                      <option key={r.label} value={r.label}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Unit (display label)</label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. DMs, proposals, leads"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Industries</label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_OPTIONS.filter(i => i !== 'all').map(ind => (
                    <label key={ind} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.industry_tags.includes(ind)}
                        onChange={e => setForm(f => ({
                          ...f,
                          industry_tags: e.target.checked
                            ? [...f.industry_tags, ind]
                            : f.industry_tags.filter(t => t !== ind),
                        }))}
                        className="accent-blue-500"
                      />
                      {ind.replace(/_/g, ' ')}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button
                type="button"
                onClick={() => { setShowModal(false); setForm({ ...EMPTY_FORM }); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.name}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
              >
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
