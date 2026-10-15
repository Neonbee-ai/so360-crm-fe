import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DetailPageTemplate, Card, Badge, Button, KpiCard, EmptyState, DataTable, TextField, DateTimePicker } from '@so360/design-system';
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
      status={campaign ? (
        <span className="flex items-center gap-nb-2">
          <Badge size="sm" tone="neutral">{campaign.campaign_type}</Badge>
          <Badge size="sm" tone="info">{campaign.status}</Badge>
        </span>
      ) : undefined}
      sidePanel={campaign ? (
        <div className="flex flex-col gap-nb-3">
          <Card title="Campaign details">
            <dl className="flex flex-col gap-nb-3 text-sm">
              <div>
                <dt className="text-xs text-fg-muted">Subject</dt>
                <dd className="text-fg">{campaign.subject_template || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Sent at</dt>
                <dd className="text-fg">{formatDateTime(campaign.sent_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Recipients</dt>
                <dd className="text-fg">{campaign.total_recipients || 0}</dd>
              </div>
            </dl>
          </Card>
        </div>
      ) : undefined}
    >
      {loading && <p className="text-fg-subtle">Loading...</p>}
      {error && <p className="text-danger">{error}</p>}

      {campaign && (
        <div className="flex flex-col gap-nb-3">
          <div className="grid grid-cols-2 wc-medium:grid-cols-4 gap-nb-3">
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
              <KpiCard key={label} label={label} value={value} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-nb-3">
            <div className="lg:col-span-6"><Card title="Test Send">
              <div className="flex gap-nb-2">
                <div className="flex-1">
                  <TextField
                    name="test-email"
                    aria-label="Test email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await crmService.testSendCampaign(storeId, campaignId!, testEmail);
                  }}
                >
                  Send Test
                </Button>
              </div>
            </Card></div>

            <div className="lg:col-span-6"><Card title="Schedule">
              <div className="flex gap-nb-2">
                <div className="flex-1">
                  <DateTimePicker
                    name="schedule-at"
                    label="Schedule at"
                    value={scheduleAt}
                    onChange={setScheduleAt}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={async () => {
                    if (!scheduleAt) return;
                    await crmService.scheduleCampaign(storeId, campaignId!, new Date(scheduleAt).toISOString());
                    recordActivity({ eventType: 'campaign.activated', eventCategory: 'crm', description: `Scheduled campaign "${campaign?.name || campaignId}"`, resourceType: 'campaign', resourceId: campaignId! }).catch(() => {});
                    await load();
                  }}
                >
                  Schedule
                </Button>
              </div>
            </Card></div>
          </div>

          <Card title="Recipients" padding="none">
            {recipients.length === 0 ? (
              <EmptyState title="No recipients yet." />
            ) : (
              <DataTable
                name="campaign-recipients"
                columns={[
                  { key: 'email', header: 'Email', render: (row: any) => <span className="text-fg">{row.email}</span> },
                  { key: 'status', header: 'Status', render: (row: any) => <span className="text-fg-subtle">{row.status}</span> },
                  { key: 'sent_at', header: 'Sent At', render: (row: any) => <span className="text-fg-muted">{formatDateTime(row.sent_at)}</span> },
                ]}
                rows={recipients}
                rowKey={(row: any) => String(row.id)}
              />
            )}
          </Card>
        </div>
      )}
    </DetailPageTemplate>
  );
};

export default MarketingCampaignDetailPage;
