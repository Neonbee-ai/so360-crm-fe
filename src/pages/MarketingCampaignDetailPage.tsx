import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { formatDateTime } from './marketing/marketingMappers';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingCampaignDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const [storeId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [campaign, setCampaign] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!storeId || !campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const [campaignRes, recipientsRes] = await Promise.all([
        crmService.getCampaign(storeId, campaignId),
        crmService.getCampaignRecipients(storeId, campaignId, { page: 1, limit: 50 }),
      ]);
      setCampaign(campaignRes);
      setRecipients(Array.isArray(recipientsRes?.data) ? recipientsRes.data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load campaign detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId, campaignId]);

  if (!storeId) {
    return <div className="p-8 text-amber-400">Select a store from Campaigns page first.</div>;
  }

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/crm/marketing/campaigns')}
        className="text-slate-400 hover:text-slate-100 mb-4 text-sm"
      >
        ← Back to Campaigns
      </button>

      {loading && <p className="text-slate-400">Loading...</p>}
      {error && <p className="text-rose-400">{error}</p>}

      {campaign && (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
            <h1 className="text-2xl font-semibold text-white">{campaign.name}</h1>
            <p className="text-slate-400 mt-1">{campaign.campaign_type} • {campaign.status}</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p className="text-slate-300"><span className="text-slate-500">Subject:</span> {campaign.subject_template || '-'}</p>
              <p className="text-slate-300"><span className="text-slate-500">Sent At:</span> {formatDateTime(campaign.sent_at)}</p>
              <p className="text-slate-300"><span className="text-slate-500">Recipients:</span> {campaign.total_recipients || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-slate-200 font-semibold mb-2">Test Send</h3>
              <div className="flex gap-2">
                <input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                />
                <button
                  className="px-3 py-2 text-sm rounded bg-blue-600 hover:bg-blue-500 text-white"
                  onClick={async () => {
                    await crmService.testSendCampaign(storeId, campaignId!, testEmail);
                  }}
                >
                  Send Test
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-slate-200 font-semibold mb-2">Schedule</h3>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                />
                <button
                  className="px-3 py-2 text-sm rounded bg-emerald-700 hover:bg-emerald-600 text-white"
                  onClick={async () => {
                    if (!scheduleAt) return;
                    await crmService.scheduleCampaign(storeId, campaignId!, new Date(scheduleAt).toISOString());
                    await load();
                  }}
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{row.email}</td>
                    <td className="px-3 py-2 text-slate-300">{row.status}</td>
                    <td className="px-3 py-2 text-slate-500">{formatDateTime(row.sent_at)}</td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">No recipients yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketingCampaignDetailPage;
