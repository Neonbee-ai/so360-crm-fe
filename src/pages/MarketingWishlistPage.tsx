import React, { useEffect, useState } from 'react';
import { Heart, Package, ExternalLink } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, ListPageTemplate, DataTable, EmptyState, SearchInput } from '@so360/design-system';
import type { DataTableColumn, FilterValues } from '@so360/design-system';
import { Link } from 'react-router-dom';
import { useCRMFormatters } from '../utils/formatters';

const STORE_KEY = 'crm_marketing_store_id';

const CUSTOMER_OPTIONS = [
  { value: 'linked', label: 'Linked to CRM lead' },
  { value: 'unlinked', label: 'Not linked' },
];

const MarketingWishlistPage: React.FC = () => {
  const formatters = useCRMFormatters();
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ customer: '' });

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await crmService.getMarketingWishlist(storeId);
      setWishlist(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load wishlist items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const filtered = wishlist.filter(item => {
    const matchesSearch = !search || 
      item.items?.name?.toLowerCase().includes(search.toLowerCase()) || 
      item.storefront_customers?.email?.toLowerCase().includes(search.toLowerCase()) ||
      `${item.storefront_customers?.first_name} ${item.storefront_customers?.last_name}`.toLowerCase().includes(search.toLowerCase());
    
    const linked = !!item.storefront_customers?.crm_lead_id;
    const matchesCustomer = !filters.customer || (filters.customer === 'linked' ? linked : !linked);

    return matchesSearch && matchesCustomer;
  });

  const columns: DataTableColumn<any>[] = [
    { key: 'product', header: 'Product', sortable: true, sortValue: (i) => i.items?.name || '', render: (item) => (
      <div className="flex items-center gap-nb-3">
        <div className="w-nb-8 h-nb-8 rounded-nb bg-surface-sunken overflow-hidden shrink-0 flex items-center justify-center">
          {item.items?.image_urls?.[0] ? (
            <img src={item.items.image_urls[0]} alt={item.items.name} className="w-full h-full object-cover" />
          ) : (
            <Package size={16} className="text-fg-muted" />
          )}
        </div>
        <span className="text-sm font-semibold text-fg truncate">{item.items?.name || 'Unknown Item'}</span>
      </div>
    ) },
    { key: 'customer', header: 'Customer', render: (item) => {
      const customer = item.storefront_customers;
      const customerName = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
      return customer?.crm_lead_id ? (
        <Link to={`/crm/leads/${customer.crm_lead_id}`} className="text-xs font-semibold text-primary inline-flex items-center gap-nb-1">
          {customerName} <ExternalLink size={8} />
        </Link>
      ) : (
        <span className="text-xs text-fg-subtle">{customerName}</span>
      );
    } },
    { key: 'added_at', header: 'Added', sortable: true, sortValue: (i) => i.added_at || '', render: (item) => <span className="text-xs text-fg-muted">{formatters.formatDate(item.added_at)}</span> },
  ];

  return (
    <ListPageTemplate
      trail={[{ label: 'Marketing', to: '/crm/marketing/overview' }]}
      title="Customer Wishlists"
      description="Track high-intent items across storefront customers"
      count={filtered.length}
      search={<SearchInput value={search} onChange={setSearch} placeholder="Filter by product or customer name..." />}
      filterConfig={{
        fields: [{ key: 'customer', label: 'Customer', type: 'select', quick: true, options: CUSTOMER_OPTIONS }],
        values: filters,
        onChange: setFilters,
        onClear: () => setFilters({ customer: '' }),
      }}
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(i: any) => i.id}
        loading={loading}
        getRowProps={(i: any) => ({ 'data-testid': `wishlist-row-${i.id}` })}
        emptyState={
          <EmptyState
            icon={Heart}
            title="No wishlist items found"
            description="Insights will appear as customers add items to their wishlist"
          />
        }
      />
    </ListPageTemplate>
  );
};

export default MarketingWishlistPage;
