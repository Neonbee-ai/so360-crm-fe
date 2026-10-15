import React, { useEffect, useState } from 'react';
import { Star, ExternalLink, MessageSquare } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, ListPageTemplate, Badge, DataTable, EmptyState, SearchInput } from '@so360/design-system';
import type { DataTableColumn, FilterValues } from '@so360/design-system';
import { Link } from 'react-router-dom';
import { useCRMFormatters } from '../utils/formatters';

const STORE_KEY = 'crm_marketing_store_id';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
];
const RATING_OPTIONS = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n > 1 ? 's' : ''}` }));

const MarketingReviewsPage: React.FC = () => {
  const formatters = useCRMFormatters();
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ status: '', rating: '' });

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // We'll reuse the abandoned cart/marketing logic style to fetch reviews via proxy or direct DB
      // For now, assume crmService.getStorefrontReviews needs a global version or we use it with a specific lead context
      // Actually, let's add a global one to crmService
      const data = await crmService.getMarketingReviews(storeId);
      setReviews(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const statusFilter = (filters.status as string) || 'all';
  const filtered = reviews.filter(r => {
    const matchesSearch = !search || 
      r.title?.toLowerCase().includes(search.toLowerCase()) || 
      r.content?.toLowerCase().includes(search.toLowerCase()) ||
      r.items?.name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'approved' && r.is_approved) ||
      (statusFilter === 'pending' && !r.is_approved);

    const matchesRating = !filters.rating || Number(r.rating) === Number(filters.rating);

    return matchesSearch && matchesStatus && matchesRating;
  });

  const columns: DataTableColumn<any>[] = [
    { key: 'title', header: 'Review', sortable: true, sortValue: (r) => r.title || '', render: (r) => (
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{r.title || 'Untitled Review'}</p>
        <p className="text-xs text-fg-subtle italic">"{r.content || 'No content provided'}"</p>
      </div>
    ) },
    { key: 'rating', header: 'Rating', align: 'right', sortable: true, sortValue: (r) => Number(r.rating || 0), render: (r) => (
      <span className="inline-flex text-warning" aria-label={`${r.rating || 0} stars`}>
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={14} fill={i < r.rating ? 'currentColor' : 'none'} className={i < r.rating ? '' : 'text-fg-subtle'} />
        ))}
      </span>
    ) },
    { key: 'customer', header: 'Customer', render: (r) => {
      const customer = r.storefront_customers;
      const customerName = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
      return customer?.crm_lead_id ? (
        <Link to={`/crm/leads/${customer.crm_lead_id}`} className="text-xs font-semibold text-primary inline-flex items-center gap-nb-1">
          {customerName} <ExternalLink size={10} />
        </Link>
      ) : (
        <span className="text-xs text-fg-subtle">{customerName}</span>
      );
    } },
    { key: 'product', header: 'Product', render: (r) => <span className="text-xs text-fg-subtle">{r.items?.name || 'Unknown Item'}</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <Badge tone={r.is_approved ? 'success' : 'warning'} size="sm">
        {r.is_approved ? 'Approved' : 'Pending Approval'}
      </Badge>
    ) },
    { key: 'created_at', header: 'Date', sortable: true, sortValue: (r) => r.created_at || '', render: (r) => <span className="text-xs text-fg-subtle">{formatters.formatDate(r.created_at)}</span> },
  ];

  return (
    <ListPageTemplate
      title="Customer Reviews"
      description="Monitor and moderate storefront product feedback"
      count={filtered.length}
      search={<SearchInput value={search} onChange={setSearch} placeholder="Filter by product, title, or content..." />}
      filterConfig={{
        fields: [
          { key: 'status', label: 'Status', type: 'select', quick: true, options: STATUS_OPTIONS },
          { key: 'rating', label: 'Rating', type: 'select', options: RATING_OPTIONS },
        ],
        values: filters,
        onChange: setFilters,
        onClear: () => setFilters({ status: '', rating: '' }),
      }}
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r: any) => r.id}
        loading={loading}
        rowActions={() => [
          { label: 'Moderate in DailyStore', onSelect: () => window.open('/dailystore/reviews', '_blank') },
        ]}
        getRowProps={(r: any) => ({ 'data-testid': `review-row-${r.id}` })}
        emptyState={
          <EmptyState
            icon={MessageSquare}
            title="No reviews found"
            description="Try adjusting your filters or selecting another store"
          />
        }
      />
    </ListPageTemplate>
  );
};

export default MarketingReviewsPage;
