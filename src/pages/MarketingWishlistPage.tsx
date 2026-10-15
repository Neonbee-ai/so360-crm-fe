import React, { useEffect, useState } from 'react';
import { Search, Heart, Package, User, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, ListPageTemplate, Card, EmptyState } from '@so360/design-system';
import { Link } from 'react-router-dom';
import { useCRMFormatters } from '../utils/formatters';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingWishlistPage: React.FC = () => {
  const formatters = useCRMFormatters();
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

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
    
    return matchesSearch;
  });

  return (
    <ListPageTemplate
      title="Customer Wishlists"
      description="Track high-intent items across storefront customers"
      filters={
        <div className="relative w-full wc-medium:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-nb-control-md w-full rounded-nb border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-primary"
            placeholder="Filter by product or customer name..."
          />
        </div>
      }
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-nb-3">
        <div className="lg:col-span-12">
          <Card title={`Wishlist Activity Feed (${filtered.length})`} padding="none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-nb-6 text-fg-muted gap-3">
                <Loader2 className="animate-spin" />
                <span className="text-xs font-semibold">Tracking intent...</span>
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No wishlist items found"
                description="Insights will appear as customers add items to their wishlist"
              />
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((item) => {
                  const customer = item.storefront_customers;
                  const customerName = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
                  const crmLeadId = customer?.crm_lead_id;

                  return (
                    <li key={item.id} className="px-nb-4 py-nb-3 flex items-center gap-nb-3">
                      <div className="w-12 h-12 rounded-nb bg-surface-sunken overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {item.items?.image_urls?.[0] ? (
                          <img src={item.items.image_urls[0]} alt={item.items.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={20} className="text-fg-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-semibold text-fg truncate">{item.items?.name || 'Unknown Item'}</p>
                          <Heart size={12} className="text-danger fill-danger/20" />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-fg-muted" />
                            {crmLeadId ? (
                              <Link to={`/crm/leads/${crmLeadId}`} className="text-xs font-semibold text-primary hover:text-primary flex items-center gap-1 truncate">
                                {customerName} <ExternalLink size={8} />
                              </Link>
                            ) : (
                              <span className="text-xs font-semibold text-fg-subtle truncate">{customerName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-fg-muted" />
                            <span className="text-xs text-fg-muted">Added {formatters.formatDate(item.added_at)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </ListPageTemplate>
  );
};

export default MarketingWishlistPage;
