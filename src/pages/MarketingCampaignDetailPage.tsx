import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DetailPageTemplate } from '@so360/design-system';
import { crmService } from '../services/crmService';
import { useCRMFormatters } from '../utils/formatters';
import { formatDateTime } from './marketing/marketingMappers';
import { useActivity } from '@so360/shell-context';
import { goBackFrom } from '../components/common/DetailBackLink';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingCampaignDetailPage: React.FC = () => {
  const formatters = useCRMFormatters();
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [storeId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const { recordActivity } = useActivity();
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
    return <div className="text-warning">Select a store from Campaigns page first.</div>;
  }

  return (
    <DetailPageTemplate
      onBack={() => goBackFrom(navigate, '/crm/marketing/campaigns')}
      title={campaign ? campaign.name : 'Campaign'}
      status={campaign ? <span className="text-fg-subtle text-sm">{campaign.campaign_type} • {campaign.status}</span> : undefined}
    >
      {loading && <p className="text-fg-subtle">Loading...</p>}
      {error && <p className="text-danger">{error}</p>}

      {campaign && (
        <>
          <div className="bg-surface border border-line rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p className="text-fg-subtle"><span className="text-fg-muted">Subject:</span> {campaign.subject_template || '-'}</p>
              <p className="text-fg-subtle"><span className="text-fg-muted">Sent At:</span> {formatDateTime(campaign.sent_at)}</p>
              <p className="text-fg-subtle"><span className="text-fg-muted">Recipients:</span> {campaign.total_recipients || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Open Rate', value: `${Math.round((campaign.open_rate || 0) * 100)}%` },
              { label: 'Click Rate', value: `${Math.round((campaign.click_rate || 0) * 100)}%` },
              { label: 'Sent', value: (campaign.sent_count || 0).toLocaleString() },
              { label: 'Delivered', value: (campaign.delivered || 0).toLocaleString() },
              { label: 'Revenue', value: formatters.formatCurrency(campaign.revenue_attributed || 0) },
              { label: 'Unsubscribes', value: String(campaign.unsubscribes || 0) },
              { label: 'Clicks', value: String(campaign.clicks || 0) },
              ...(campaign.segment ? [{ label: 'Segment', value: campaign.segment }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface border border-line rounded-xl p-4">
                <p className="text-fg-subtle text-xs">{label}</p>
                <p className="text-fg text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-surface border border-line rounded-xl p-4">
              <h3 className="text-fg font-semibold mb-2">Test Send</h3>
              <div className="flex gap-2">
                <input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="flex-1 bg-bg border border-line rounded px-3 py-2 text-sm text-fg"
                />
                <button
                  className="px-3 py-2 text-sm rounded bg-primary hover:bg-primary/90 text-primary-fg"
                  onClick={async () => {
                    await crmService.testSendCampaign(storeId, campaignId!, testEmail);
                  }}
                >
                  Send Test
                </button>
              </div>
            </div>

            <div className="bg-surface border border-line rounded-xl p-4">
              <h3 className="text-fg font-semibold mb-2">Schedule</h3>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="flex-1 bg-bg border border-line rounded px-3 py-2 text-sm text-fg"
                />
                <button
                  className="px-3 py-2 text-sm rounded bg-success hover:bg-success/90 text-success-fg"
                  onClick={async () => {
                    if (!scheduleAt) return;
                    await crmService.scheduleCampaign(storeId, campaignId!, new Date(scheduleAt).toISOString());
                    recordActivity({ eventType: 'campaign.activated', eventCategory: 'crm', description: `Scheduled campaign "${campaign?.name || campaignId}"`, resourceType: 'campaign', resourceId: campaignId! }).catch(() => {});
                    await load();
                  }}
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-line rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-high text-fg-subtle">
                <tr>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-2 text-fg">{row.email}</td>
                    <td className="px-3 py-2 text-fg-subtle">{row.status}</td>
                    <td className="px-3 py-2 text-fg-muted">{formatDateTime(row.sent_at)}</td>
                  </tr>
                ))}
                {recipients.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-fg-muted">No recipients yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DetailPageTemplate>
  );
};

export default MarketingCampaignDetailPage;
