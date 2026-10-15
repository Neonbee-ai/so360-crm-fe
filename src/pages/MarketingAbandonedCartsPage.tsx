import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatDateTime, formatMoney, mapAbandonedCart } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';
import { Badge, DataTable, EmptyState, KpiCard, ListPageTemplate, SearchInput } from '@so360/design-system';
import type { DataTableColumn, FilterValues } from '@so360/design-system';

const STORE_KEY = 'crm_marketing_store_id';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'expired', label: 'Expired' },
];
const STATUS_TONE: Record<string, any> = { recovered: 'success', pending: 'warning', email_sent: 'info' };

const MarketingAbandonedCartsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useBusinessSettings();
  const currencyCode = settings?.base_currency;
  const locale = settings?.document_language || 'en-US';
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [stats, setStats] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, listRes] = await Promise.all([
        crmService.getAbandonedCartStats(storeId),
        crmService.getAbandonedCarts(storeId, { page: 1, limit: 50, ...(statusFilter ? { recovery_status: statusFilter } : {}) }),
      ]);
      setStats(statsRes);
      setRows(Array.isArray(listRes?.data) ? listRes.data.map(mapAbandonedCart) : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load abandoned carts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId, statusFilter]);

  const cards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Abandoned', value: stats.totalAbandoned || 0 },
      { label: 'Recovered', value: stats.totalRecovered || 0 },
      { label: 'Recovery Rate', value: `${stats.recoveryRate || 0}%` },
      { label: 'Recovered Revenue', value: formatMoney(stats.revenueRecovered || 0, currencyCode, locale) },
    ];
  }, [stats, currencyCode, locale]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => (r.customerEmail || '').toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const columns: DataTableColumn<any>[] = [
    { key: 'customerEmail', header: 'Customer Email', sortable: true, sortValue: (r) => r.customerEmail || '', render: (r) => <span className="text-fg font-medium">{r.customerEmail || '-'}</span> },
    { key: 'itemCount', header: 'Items', align: 'right', sortable: true, sortValue: (r) => Number(r.itemCount || 0), render: (r) => <>{r.itemCount} <span className="text-fg-muted text-xs">items</span></> },
    { key: 'cartTotal', header: 'Cart Total', align: 'right', sortable: true, sortValue: (r) => Number(r.cartTotal || 0), render: (r) => formatMoney(r.cartTotal, currencyCode, locale) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{(r.status || '-').replace('_', ' ').toUpperCase()}</Badge> },
    { key: 'abandonedAt', header: 'Abandoned At', sortable: true, sortValue: (r) => r.abandonedAt || '', render: (r) => <span className="text-fg-subtle text-xs">{formatDateTime(r.abandonedAt)}</span> },
  ];

  const rowActions = (row: any) => [
    { label: 'View', onSelect: () => navigate(`/crm/marketing/abandoned-carts/${row.id}`) },
    ...(row.status !== 'recovered' ? [
      { label: 'Send Recovery', onSelect: async () => { await crmService.sendAbandonedCartRecovery(storeId, row.id); await load(); } },
      { label: 'Mark Recovered', onSelect: async () => { await crmService.updateAbandonedCartStatus(storeId, row.id, 'recovered'); await load(); } },
    ] : []),
  ];

  const filterValues: FilterValues = { status: statusFilter };

  return (
    <ListPageTemplate
      title="Abandoned Carts"
      description="Managed from CRM, sourced from Storefront."
      count={visibleRows.length}
      search={<SearchInput value={search} onChange={setSearch} placeholder="Search by customer email" />}
      filterConfig={{
        fields: [{ key: 'status', label: 'Status', type: 'select', quick: true, options: STATUS_OPTIONS }],
        values: filterValues,
        onChange: (v: FilterValues) => setStatusFilter(String(v.status || '')),
        onClear: () => setStatusFilter(''),
      }}
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >
      {error && <p className="text-danger mb-nb-3">{error}</p>}

      {cards.length > 0 && (
        <div className="grid grid-cols-2 wc-medium:grid-cols-4 gap-nb-3 mb-nb-3">
          {cards.map((card) => (
            <KpiCard key={card.label} label={card.label} value={card.value} />
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={visibleRows}
        rowKey={(r: any) => r.id}
        loading={loading}
        rowActions={rowActions}
        getRowProps={(r: any) => ({ 'data-testid': `abandoned-cart-row-${r.id}` })}
        emptyState={<EmptyState title="No abandoned carts found matching criteria." />}
      />
    </ListPageTemplate>
  );
};

export default MarketingAbandonedCartsPage;
