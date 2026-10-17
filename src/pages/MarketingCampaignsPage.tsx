import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatDateTime, mapCampaign } from './marketing/marketingMappers';
import { Badge, Button, Card, DataTable, EmptyState, ListPageTemplate, SearchInput, Select, TextField, Textarea, Grid, GridItem } from '@so360/design-system';
import type { DataTableColumn, FilterValues, MenuItem } from '@so360/design-system';
import CampaignTemplateEditor from '../components/CampaignTemplateEditor';
import { useShellBridge } from '@so360/shell-context';

const STORE_KEY = 'crm_marketing_store_id';

const initialForm = {
  name: '',
  description: '',
  campaignType: 'promotional',
  subjectTemplate: '',
  bodyTemplate: '',
  audienceFilterText: '',
};

const CAMPAIGN_TYPE_OPTIONS = [
  { value: 'promotional', label: 'Promotional' },
  { value: 'abandoned_cart', label: 'Abandoned Cart' },
  { value: 'win_back', label: 'Win Back' },
  { value: 'custom', label: 'Custom' },
];
const STATUS_OPTIONS = ['draft', 'scheduled', 'sending', 'sent', 'paused'].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));
const STATUS_TONE: Record<string, 'success' | 'warning' | 'primary' | 'neutral'> = { sent: 'success', paused: 'warning', sending: 'primary' };

const MarketingCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const shell = useShellBridge();
  const canCreateMarketing = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:marketing:create') ?? true);
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});

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

  const visibleRows = rows.filter((r) => {
    if (filters.status && r.status !== filters.status) return false;
    if (filters.type && r.campaignType !== filters.type) return false;
    return !search || String(r.name ?? '').toLowerCase().includes(search.toLowerCase());
  });

  const columns: DataTableColumn<any>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span className="font-medium text-fg">{r.name}</span> },
    { key: 'campaignType', header: 'Type', render: (r) => <span className="capitalize text-fg-muted">{String(r.campaignType ?? '').replace('_', ' ')}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'} size="sm">{r.status}</Badge> },
    { key: 'totalRecipients', header: 'Recipients', align: 'right', sortable: true, sortValue: (r) => r.totalRecipients || 0, render: (r) => r.totalRecipients || 0 },
    { key: 'sentAt', header: 'Sent At', render: (r) => <span className="text-xs text-fg-muted">{formatDateTime(r.sentAt)}</span> },
  ];

  const rowActions = (row: any): MenuItem[] => [
    { label: 'View', onSelect: () => navigate(`/crm/marketing/campaigns/${row.id}`) },
    ...(row.status !== 'sent' ? [{ label: 'Send', onSelect: async () => { await crmService.sendCampaignNow(storeId, row.id); await load(); } }] : []),
    ...(row.status === 'sending' || row.status === 'scheduled' ? [{ label: 'Pause', onSelect: async () => { await crmService.pauseCampaign(storeId, row.id); await load(); } }] : []),
    ...(canCreateMarketing ? [{ label: 'Delete', danger: true, onSelect: async () => { await crmService.deleteCampaign(storeId, row.id); await load(); } }] : []),
  ];

  return (
    <ListPageTemplate
      trail={[{ label: 'Marketing', to: '/crm/marketing/overview' }]}
      title="Campaigns"
      description="Create, send, and manage marketing campaigns from CRM."
      primaryAction={canCreateMarketing ? (
        <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Close Form' : 'New Campaign'}
        </Button>
      ) : undefined}
      search={<SearchInput placeholder="Search campaigns" value={search} onChange={setSearch} data-testid="campaigns-search" />}
      filterConfig={{
        fields: [
          { key: 'status', label: 'Status', type: 'select', quick: true, options: STATUS_OPTIONS },
          { key: 'type', label: 'Type', type: 'select', options: CAMPAIGN_TYPE_OPTIONS },
        ],
        values: filters,
        onChange: setFilters,
        onClear: () => setFilters({}),
      }}
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >

      {showCreate && (
        <Card title="Create Campaign" className="mb-nb-3">
          <Grid gap="md">
            <GridItem span={{ md: 4, lg: 6 }}><TextField
              name="campaign_name"
              aria-label="Campaign name"
              placeholder="Campaign name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            /></GridItem>
            <GridItem span={{ md: 4, lg: 6 }}><Select
              name="campaign_type"
              aria-label="Campaign type"
              options={CAMPAIGN_TYPE_OPTIONS}
              value={form.campaignType}
              onChange={(e) => setForm({ ...form, campaignType: e.target.value })}
            /></GridItem>
          </Grid>
          <div className="mt-nb-4">
            <TextField
              name="campaign_description"
              aria-label="Description"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="mt-nb-4">
            <TextField
              name="campaign_subject"
              aria-label="Subject template"
              placeholder="Subject template"
              value={form.subjectTemplate}
              onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })}
            />
          </div>
          <label className="block text-xs text-fg-muted mt-nb-5 mb-nb-2">Email Body</label>
          <CampaignTemplateEditor
            value={form.bodyTemplate}
            onChange={(html) => setForm({ ...form, bodyTemplate: html })}
          />
          <div className="mt-nb-5">
          <Textarea
            name="campaign_audience_filter"
            label="Audience Filter (JSON)"
            rows={5}
            value={form.audienceFilterText}
            onChange={(e) => setForm({ ...form, audienceFilterText: e.target.value })}
          />
          </div>
          <div className="mt-nb-5 flex justify-end">
            <Button
              variant="primary"
              onClick={createCampaign}
              disabled={!form.name || !form.subjectTemplate || !form.bodyTemplate}
            >
              Finish & Create
            </Button>
          </div>
        </Card>
      )}

      {error && <p className="text-danger mb-nb-3">{error}</p>}

      <DataTable
        columns={columns}
        rows={visibleRows}
        rowKey={(r: any) => r.id}
        loading={loading}
        onRowClick={(r: any) => navigate(`/crm/marketing/campaigns/${r.id}`)}
        rowActions={rowActions}
        getRowProps={(r: any) => ({ 'data-testid': `campaign-row-${r.id}` })}
        emptyState={<EmptyState title="No campaigns found." />}
      />
    </ListPageTemplate>
  );
};

export default MarketingCampaignsPage;
