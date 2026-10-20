import React, { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatDateTime, formatMoney } from './marketing/marketingMappers';
import { useBusinessSettings, useShell, useShellBridge } from '@so360/shell-context';
import { Button, DataTable, EmptyState, ListPageTemplate, SearchInput, SegmentedControl, Select, Tabs, TextField, Grid, GridItem } from '@so360/design-system';
import type { DataTableColumn, FilterValues } from '@so360/design-system';

const STORE_KEY = 'crm_marketing_store_id';

type SegmentMemberType = 'lead' | 'customer';

const CHANNEL_OPTIONS = [
  { value: 'storefront_web', label: 'Web' },
  { value: 'storefront_mobile', label: 'Mobile' },
  { value: 'pos', label: 'POS' },
  { value: 'manual', label: 'Manual' },
];
const CATEGORY_OPTIONS = [
  { value: 'b2b', label: 'B2B' },
  { value: 'b2c', label: 'B2C' },
];
const FORM_CHANNEL_OPTIONS = [{ value: '', label: 'All Channels' }, ...CHANNEL_OPTIONS];
const FORM_CATEGORY_OPTIONS = [{ value: '', label: 'All Categories' }, ...CATEGORY_OPTIONS];
const PRESET_OPTIONS = [
  { value: '', label: 'No Preset' },
  { value: 'top_buyer', label: 'Top Buyer' },
  { value: 'inactive', label: 'Inactive' },
];

const MarketingSegmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const shell = useShell();
  const shellBridge = useShellBridge();
  const canCreateMarketing = (shellBridge?.effectiveFlagsLoaded !== false) && (shellBridge?.isFeatureEnabled?.('action:crm:marketing:create') ?? true);
  const { settings } = useBusinessSettings();
  const currencyCode = settings?.base_currency;
  const locale = settings?.document_language || 'en-US';
  const dailystoreEnabled = shell.isModuleEnabled('dailystore');

  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [storeCount, setStoreCount] = useState<number | null>(null);
  const [view, setView] = useState<'segments' | 'storefront'>('segments');
  const [loading, setLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [segments, setSegments] = useState<any>(null);
  const [topBuyers, setTopBuyers] = useState<any[]>([]);
  const [inactive, setInactive] = useState<any[]>([]);
  const [manualSegments, setManualSegments] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ channel: '', category: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [activeSegment, setActiveSegment] = useState<any | null>(null);
  const [memberType, setMemberType] = useState<SegmentMemberType>('customer');
  const [memberSearch, setMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [segmentMembers, setSegmentMembers] = useState<any[]>([]);
  const [memberCandidates, setMemberCandidates] = useState<any[]>([]);

  const [segmentForm, setSegmentForm] = useState({
    name: '',
    description: '',
    q: '',
    channel: '',
    category: '',
    preset: '',
  });

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const loadManualSegments = async () => {
    setManualLoading(true);
    try {
      const manual = await crmService.getCustomerSegments();
      setManualSegments(Array.isArray(manual) ? manual : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load manual segments');
    } finally {
      setManualLoading(false);
    }
  };

  const loadStorefrontSections = async () => {
    if (!dailystoreEnabled || !storeId || storeCount === 0) {
      setSegments(null);
      setTopBuyers([]);
      setInactive([]);
      return;
    }

    setLoading(true);
    try {
      const [seg, buyers, inactiveRes] = await Promise.all([
        crmService.getMarketingSegments(storeId),
        crmService.getMarketingTopBuyers(storeId, { limit: 20 }),
        crmService.getMarketingInactiveCustomers(storeId, { limit: 20 }),
      ]);
      setSegments(seg);
      setTopBuyers(Array.isArray(buyers?.data) ? buyers.data : []);
      setInactive(Array.isArray(inactiveRes?.data) ? inactiveRes.data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load storefront segments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError(null);
    loadManualSegments();
  }, []);

  useEffect(() => {
    setError(null);
    loadStorefrontSections();
  }, [dailystoreEnabled, storeId, storeCount]);

  const hasStores = dailystoreEnabled && storeCount !== 0;

  const segmentEntries = Object.entries(segments?.segments || {});
  const mappedSummarySegments = useMemo(() => {
    const mapRule = (key: string) => {
      if (key === 'b2b') return { category: 'b2b' };
      if (key === 'b2c') return { category: 'b2c' };
      if (['storefront_web', 'storefront_mobile', 'pos', 'manual'].includes(key)) return { channel: key };
      return null;
    };

    return segmentEntries.map(([key, value]) => ({
      key,
      value,
      rule: mapRule(key),
      label: key.replaceAll('_', ' '),
    }));
  }, [segmentEntries]);

  const navigateToCustomers = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    navigate(`/crm/customers${search.toString() ? `?${search.toString()}` : ''}`);
  };

  const navigateToLeads = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    navigate(`/crm/leads${search.toString() ? `?${search.toString()}` : ''}`);
  };

  const getRulesPreview = (rules: any) => {
    if (!rules || typeof rules !== 'object') return '-';
    const chunks: string[] = [];
    if (rules.q) chunks.push(`q: ${rules.q}`);
    if (rules.channel) chunks.push(`channel: ${rules.channel}`);
    if (rules.category) chunks.push(`category: ${rules.category}`);
    if (rules.preset) chunks.push(`preset: ${rules.preset}`);
    if (Array.isArray(rules.customer_ids) && rules.customer_ids.length > 0) {
      chunks.push(`ids: ${rules.customer_ids.length}`);
    }
    return chunks.length > 0 ? chunks.join(' | ') : '-';
  };

  const createManualSegment = async () => {
    if (!segmentForm.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const rules: any = {};
      if (segmentForm.q.trim()) rules.q = segmentForm.q.trim();
      if (segmentForm.channel) rules.channel = segmentForm.channel;
      if (segmentForm.category) rules.category = segmentForm.category;
      if (segmentForm.preset) {
        rules.preset = segmentForm.preset;
        if (storeId) rules.store_id = storeId;
      }

      await crmService.createCustomerSegment({
        name: segmentForm.name.trim(),
        description: segmentForm.description.trim() || undefined,
        rules,
      });

      setSegmentForm({
        name: '',
        description: '',
        q: '',
        channel: '',
        category: '',
        preset: '',
      });
      setShowCreate(false);
      await loadManualSegments();
    } catch (e: any) {
      setError(e?.message || 'Failed to create segment');
    } finally {
      setCreating(false);
    }
  };

  const loadMemberPanel = async (segment: any, type: SegmentMemberType, q: string) => {
    setMembersLoading(true);
    setError(null);
    try {
      const [membersRes, candidatesRes] = await Promise.all([
        crmService.getCustomerSegmentMembers(segment.id, { type }),
        type === 'customer'
          ? crmService.getCustomers({ q: q || undefined, take: 50 })
          : crmService.getLeads({ q: q || undefined, take: 50 }),
      ]);

      setSegmentMembers(Array.isArray(membersRes?.members) ? membersRes.members : []);
      setMemberCandidates(Array.isArray(candidatesRes) ? candidatesRes : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load segment members');
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSegment) return;
    const timer = setTimeout(() => {
      loadMemberPanel(activeSegment, memberType, memberSearch.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [activeSegment?.id, memberType, memberSearch]);

  const existingMemberIds = useMemo(
    () => new Set(segmentMembers.map((m: any) => m?.lead_record?.id || m.id).filter(Boolean)),
    [segmentMembers],
  );

  const addMember = async (id: string) => {
    if (!activeSegment) return;
    try {
      await crmService.addCustomerSegmentMembers(activeSegment.id, [{ id, type: memberType }]);
      await loadMemberPanel(activeSegment, memberType, memberSearch.trim());
    } catch (e: any) {
      setError(e?.message || 'Failed to add member');
    }
  };

  const removeMember = async (id: string) => {
    if (!activeSegment) return;
    try {
      await crmService.removeCustomerSegmentMembers(activeSegment.id, [{ id, type: memberType }]);
      await loadMemberPanel(activeSegment, memberType, memberSearch.trim());
    } catch (e: any) {
      setError(e?.message || 'Failed to remove member');
    }
  };

  const visibleSegments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return manualSegments.filter((row) => {
      if (q && !`${row.name || ''} ${row.description || ''}`.toLowerCase().includes(q)) return false;
      if (filters.channel && row.rules?.channel !== filters.channel) return false;
      if (filters.category && row.rules?.category !== filters.category) return false;
      return true;
    });
  }, [manualSegments, search, filters]);

  const deleteSegment = async (row: any) => {
    await crmService.deleteCustomerSegment(row.id);
    setManualSegments((prev) => prev.filter((seg) => seg.id !== row.id));
    if (activeSegment?.id === row.id) {
      setActiveSegment(null);
      setSegmentMembers([]);
      setMemberCandidates([]);
    }
  };

  const segmentColumns: DataTableColumn<any>[] = [
    { key: 'name', header: 'Name', sortable: true, sortValue: (r) => r.name || '', render: (r) => <span className="text-fg font-medium">{r.name}</span> },
    { key: 'description', header: 'Description', render: (r) => <span className="text-fg-subtle">{r.description || '-'}</span> },
    { key: 'rules', header: 'Rules', render: (r) => <span className="text-fg-subtle text-xs font-mono whitespace-nowrap">{getRulesPreview(r.rules)}</span> },
  ];

  const buyerColumns: DataTableColumn<any>[] = [
    { key: 'customer', header: 'Customer', render: (r) => <span className="text-fg font-medium">{r.name || r.email || r.customerId || '-'}</span> },
    { key: 'orders', header: 'Orders', align: 'right', sortable: true, sortValue: (r) => Number(r.orderCount || 0), render: (r) => r.orderCount || 0 },
    { key: 'spent', header: 'Spent', align: 'right', sortable: true, sortValue: (r) => Number(r.totalSpent || 0), render: (r) => <span className="text-success font-semibold">{formatMoney(r.totalSpent, currencyCode, locale)}</span> },
    { key: 'last', header: 'Last Order', render: (r) => <span className="text-fg-muted text-xs">{formatDateTime(r.lastOrderAt)}</span> },
  ];

  const inactiveColumns: DataTableColumn<any>[] = [
    { key: 'customer', header: 'Customer', render: (r) => <span className="text-fg font-medium">{r.name || r.customerId || '-'}</span> },
    { key: 'email', header: 'Email', render: (r) => <span className="text-fg-subtle">{r.email || '-'}</span> },
    { key: 'spent', header: 'Total Spent', align: 'right', sortable: true, sortValue: (r) => Number(r.totalSpent || 0), render: (r) => formatMoney(r.totalSpent, currencyCode, locale) },
    { key: 'days', header: 'Days Inactive', align: 'right', sortable: true, sortValue: (r) => Number(r.daysSinceLastOrder || 0), render: (r) => `${r.daysSinceLastOrder || 0} days` },
  ];

  return (
    <ListPageTemplate
      trail={[{ label: 'Marketing', to: '/crm/marketing/overview' }]}
      title="Customer Segments"
      description="Create CRM segments for leads/customers. Storefront segments are read-only."
      primaryAction={canCreateMarketing ? (
        <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Close Form' : 'Create Segment'}
        </Button>
      ) : undefined}
      count={visibleSegments.length}
      search={<SearchInput value={search} onChange={setSearch} placeholder="Search segments" />}
      filterConfig={{
        fields: [
          { key: 'channel', label: 'Channel', type: 'select', quick: true, options: CHANNEL_OPTIONS },
          { key: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS },
        ],
        values: filters,
        onChange: setFilters,
        onClear: () => setFilters({ channel: '', category: '' }),
      }}
      toolbarEnd={hasStores ? <MarketingStorePicker storeId={storeId} onChange={applyStore} onStoresLoaded={setStoreCount} /> : undefined}
    >
      {loading && <p className="text-fg-subtle text-sm mb-4">Loading Storefront insights...</p>}
      {manualLoading && <p className="text-fg-subtle text-sm mb-4">Loading CRM segments...</p>}
      {error && <p className="text-danger mb-4 bg-danger/10 border border-danger/20 p-3 rounded-lg text-sm">{error}</p>}

      {hasStores && (
        <div className="mb-nb-4">
          <Tabs
            name="segments-view"
            items={[
              { id: 'segments', label: 'Segments' },
              { id: 'storefront', label: 'Storefront insights' },
            ]}
            value={view}
            onChange={(id: string) => setView(id as 'segments' | 'storefront')}
          />
        </div>
      )}

      <Grid gap="md">
        {(!hasStores || view === 'segments') && (
        <GridItem span="full">
          {showCreate && (
            <div className="mb-nb-4 rounded-nb p-nb-4 bg-surface-sunken">
              <Grid gap="md">
                <GridItem span={{ md: 4, lg: 6 }}><TextField
                  name="segment-name"
                  aria-label="Segment name"
                  placeholder="Segment name"
                  value={segmentForm.name}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, name: e.target.value }))}
                /></GridItem>
                <GridItem span={{ md: 4, lg: 6 }}><TextField
                  name="segment-description"
                  aria-label="Description"
                  placeholder="Description (optional)"
                  value={segmentForm.description}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, description: e.target.value }))}
                /></GridItem>
                <GridItem span="full"><div>
                  <TextField
                    name="segment-query"
                  aria-label="Search query"
                    placeholder="Search query (name/email/phone/company)"
                    value={segmentForm.q}
                    onChange={(e) => setSegmentForm((prev) => ({ ...prev, q: e.target.value }))}
                  />
                </div></GridItem>
                <GridItem span={{ md: 4, lg: 6 }}><Select
                  name="segment-channel"
                  aria-label="Channel"
                  options={FORM_CHANNEL_OPTIONS}
                  value={segmentForm.channel}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, channel: e.target.value }))}
                /></GridItem>
                <GridItem span={{ md: 4, lg: 6 }}><Select
                  name="segment-category"
                  aria-label="Category"
                  options={FORM_CATEGORY_OPTIONS}
                  value={segmentForm.category}
                  onChange={(e) => setSegmentForm((prev) => ({ ...prev, category: e.target.value }))}
                /></GridItem>
                <GridItem span="full"><div>
                  <Select
                    name="segment-preset"
                  aria-label="Preset"
                    options={PRESET_OPTIONS}
                    value={segmentForm.preset}
                    onChange={(e) => setSegmentForm((prev) => ({ ...prev, preset: e.target.value }))}
                    disabled={!dailystoreEnabled}
                  />
                </div></GridItem>
              </Grid>
              <div className="mt-nb-4 flex justify-end">
                <Button
                  variant="primary"
                  onClick={createManualSegment}
                  disabled={creating || !segmentForm.name.trim()}
                >
                  {creating ? 'Creating...' : 'Save Segment'}
                </Button>
              </div>
            </div>
          )}

          <DataTable
            columns={segmentColumns}
            rows={visibleSegments}
            rowKey={(r: any) => r.id}
            loading={manualLoading && manualSegments.length === 0}
            rowActions={(row: any) => [
              { label: 'Manage Members', onSelect: () => setActiveSegment(row) },
              { label: 'Leads', onSelect: () => navigateToLeads({ segmentId: row.id, segmentName: row.name }) },
              { label: 'Customers', onSelect: () => navigateToCustomers({ segmentId: row.id, segmentName: row.name }) },
              ...(canCreateMarketing ? [{ label: 'Delete', danger: true, onSelect: () => deleteSegment(row) }] : []),
            ]}
            getRowProps={(r: any) => ({ 'data-testid': `segment-row-${r.id}` })}
            emptyState={
              <EmptyState
                icon={Users}
                title="No segments yet"
                description="Group leads and customers into segments to target them in campaigns."
                action={canCreateMarketing ? { label: 'Create segment', onClick: () => setShowCreate(true) } : undefined}
              />
            }
          />
        </GridItem>
        )}

        {activeSegment && (!hasStores || view === 'segments') && (
          <GridItem span="full"><div className="bg-surface border border-line rounded-nb-lg p-nb-4">
            <div className="flex items-center justify-between mb-nb-4 gap-nb-2 flex-wrap pb-nb-4 border-b border-line">
              <h3 className="text-sm font-semibold text-fg">
                Manage Members: <span className="text-fg-subtle font-normal">{activeSegment.name}</span>
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setActiveSegment(null);
                  setSegmentMembers([]);
                  setMemberCandidates([]);
                }}
              >
                Close Panel
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-nb-3 mb-nb-4">
              <SegmentedControl
                size="sm"
                aria-label="Member type"
                data-testid="segment-member-type"
                value={memberType}
                onChange={(v) => setMemberType(v as typeof memberType)}
                options={[{ value: 'customer', label: 'Customers' }, { value: 'lead', label: 'Leads' }]}
              />
              <div className="ml-auto w-full md:w-72">
                <SearchInput value={memberSearch} onChange={setMemberSearch} placeholder={`Search ${memberType}s...`} />
              </div>
            </div>

            {membersLoading && <p className="text-fg-subtle text-sm mb-nb-3">Loading members...</p>}

            <Grid gap="md">
              <GridItem span={{ md: 4, lg: 6 }}><div className="bg-surface p-nb-4 border border-line rounded-nb-lg">
                <h4 className="text-sm font-semibold text-fg mb-nb-3">Current Members</h4>
                <div className="space-y-nb-2 max-h-80 overflow-y-auto">
                  {segmentMembers.map((member: any) => {
                    const row = member.lead_record;
                    return (
                      <div key={`${member.type}-${row?.id || member.id}`} className="flex items-center justify-between border-b border-line pb-nb-2">
                        <div className="overflow-hidden">
                          <p className="text-fg text-sm font-medium truncate">{row?.contact_name || row?.company_name || row?.email || row?.id}</p>
                          <p className="text-fg-muted text-xs truncate">{row?.email || row?.phone || '-'}</p>
                        </div>
                        <Button variant="secondary" size="sm" className="shrink-0" onClick={() => removeMember(row?.id || member.id)}>
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                  {segmentMembers.length === 0 && <p className="text-fg-muted text-sm py-nb-4 text-center">No current members found.</p>}
                </div>
              </div></GridItem>

              <GridItem span={{ md: 4, lg: 6 }}><div className="bg-surface p-nb-4 border border-line rounded-nb-lg">
                <h4 className="text-sm font-semibold text-fg mb-nb-3">Add {memberType === 'customer' ? 'Customers' : 'Leads'}</h4>
                <div className="space-y-nb-2 max-h-80 overflow-y-auto">
                  {memberCandidates.map((candidate: any) => {
                    const id = candidate.id;
                    const exists = existingMemberIds.has(id);
                    return (
                      <div key={id} className="flex items-center justify-between border-b border-line pb-nb-2">
                        <div className="overflow-hidden">
                          <p className="text-fg text-sm font-medium truncate">{candidate.contact_name || candidate.company_name || candidate.email || id}</p>
                          <p className="text-fg-muted text-xs truncate">{candidate.email || candidate.phone || '-'}</p>
                        </div>
                        <Button
                          variant={exists ? 'secondary' : 'primary'}
                          size="sm"
                          className="shrink-0"
                          onClick={() => !exists && addMember(id)}
                          disabled={exists}
                        >
                          {exists ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    );
                  })}
                  {memberCandidates.length === 0 && <p className="text-fg-muted text-sm py-nb-4 text-center">No records available to add.</p>}
                </div>
              </div></GridItem>
            </Grid>
          </div></GridItem>
        )}

        {hasStores && view === 'storefront' && (
          <>
            <GridItem span={{ md: 4, lg: 4 }}><div className="bg-surface border border-line rounded-nb-lg p-nb-4 h-fit">
              <h3 className="text-sm font-semibold text-fg mb-nb-3">Storefront Summary</h3>
              <div className="space-y-nb-2">
                {mappedSummarySegments.map((entry) => (
                  <Button
                    key={entry.key}
                    variant="secondary"
                    className="w-full !justify-between"
                    onClick={() => entry.rule && navigateToCustomers({
                      channel: (entry.rule as any).channel,
                      category: (entry.rule as any).category,
                    })}
                    disabled={!entry.rule}
                    title={entry.rule ? 'Open matching customers' : 'No filter mapping for this segment'}
                  >
                    <span className="capitalize">{entry.label}</span>
                    <span className="font-bold">{String(entry.value)}</span>
                  </Button>
                ))}
                {mappedSummarySegments.length === 0 && <p className="text-fg-muted text-sm py-nb-4 text-center">No segment data.</p>}
              </div>
            </div></GridItem>

            <GridItem span={{ md: 4, lg: 8 }}>
              <h3 className="text-sm font-semibold text-fg mb-nb-3">Top Buyers</h3>
              <DataTable
                columns={buyerColumns}
                rows={topBuyers}
                rowKey={(r: any) => r.customerId}
                onRowClick={(r: any) => navigateToCustomers({ customer_ids: r.customerId, preset: 'top_buyer', storeId })}
                emptyState={<EmptyState title="No buyer data." />}
              />
            </GridItem>

            <GridItem span="full">
              <h3 className="text-sm font-semibold text-fg mb-nb-3">Inactive Customers</h3>
              <DataTable
                columns={inactiveColumns}
                rows={inactive}
                rowKey={(r: any) => r.customerId}
                onRowClick={(r: any) => navigateToCustomers({ customer_ids: r.customerId, preset: 'inactive', storeId })}
                emptyState={<EmptyState title="No inactive customers identified." />}
              />
            </GridItem>
          </>
        )}
      </Grid>
    </ListPageTemplate>
  );
};

export default MarketingSegmentsPage;
