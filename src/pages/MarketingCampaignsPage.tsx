import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatDateTime, mapCampaign } from './marketing/marketingMappers';
import { Button } from '@so360/design-system';

const STORE_KEY = 'crm_marketing_store_id';

const initialForm = {
  name: '',
  description: '',
  campaignType: 'promotional',
  subjectTemplate: '',
  bodyTemplate: '',
  audienceFilterText: '',
};

const MarketingCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await crmService.getCampaigns(storeId, { page: 1, limit: 50 });
      setRows(Array.isArray(res?.data) ? res.data.map(mapCampaign) : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const createCampaign = async () => {
    try {
      const audienceFilter = JSON.parse(form.audienceFilterText || '{}');
      await crmService.createCampaign(storeId, {
        name: form.name,
        description: form.description,
        campaignType: form.campaignType,
        subjectTemplate: form.subjectTemplate,
        bodyTemplate: form.bodyTemplate,
        audienceFilter,
      });
      setForm(initialForm);
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create campaign');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Campaigns</h1>
          <p className="text-slate-400">Create, send, and manage marketing campaigns from CRM.</p>
        </div>
        <div className="flex items-center gap-4">
          <MarketingStorePicker storeId={storeId} onChange={applyStore} />
          <Button
            variant="primary"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Close Form' : 'New Campaign'}
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
          <h3 className="text-slate-100 font-bold mb-5">Create Campaign</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Campaign name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              value={form.campaignType}
              onChange={(e) => setForm({ ...form, campaignType: e.target.value })}
            >
              <option value="promotional">Promotional</option>
              <option value="abandoned_cart">Abandoned Cart</option>
              <option value="win_back">Win Back</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <input
            className="mt-4 w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            className="mt-4 w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Subject template"
            value={form.subjectTemplate}
            onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })}
          />
          <textarea
            className="mt-4 w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            rows={6}
            placeholder="Body template (HTML)"
            value={form.bodyTemplate}
            onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
          />
          <label className="block text-xs font-semibold text-slate-400 mt-5 mb-2 uppercase tracking-wider">Audience Filter (JSON)</label>
          <textarea
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            rows={5}
            value={form.audienceFilterText}
            onChange={(e) => setForm({ ...form, audienceFilterText: e.target.value })}
          />
          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              onClick={createCampaign}
              disabled={!form.name || !form.subjectTemplate || !form.bodyTemplate}
            >
              Finish & Create
            </Button>
          </div>
        </div>
      )}

      {loading && <p className="text-slate-400">Loading...</p>}
      {error && <p className="text-rose-400 mb-3">{error}</p>}

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Recipients</th>
                <th className="px-4 py-3 font-semibold">Sent At</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 border-t border-slate-800/50">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-200 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-slate-400 capitalize">{row.campaignType.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${row.status === 'sent'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : row.status === 'paused'
                          ? 'bg-amber-500/10 text-amber-400'
                          : row.status === 'sending'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-medium">{row.totalRecipients || 0}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDateTime(row.sentAt)}</td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/crm/marketing/campaigns/${row.id}`)}
                    >
                      View
                    </Button>
                    {row.status !== 'sent' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          await crmService.sendCampaignNow(storeId, row.id);
                          await load();
                        }}
                      >
                        Send
                      </Button>
                    )}
                    {(row.status === 'sending' || row.status === 'scheduled') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          await crmService.pauseCampaign(storeId, row.id);
                          await load();
                        }}
                      >
                        Pause
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        await crmService.deleteCampaign(storeId, row.id);
                        await load();
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">No campaigns found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MarketingCampaignsPage;
