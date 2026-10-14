import React, { useEffect, useState } from 'react';
import { Search, Heart, Package, User, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, ListPageTemplate } from '@so360/design-system';
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

      <div className="grid grid-cols-1 gap-8">
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-line bg-surface-sunken">
            <h3 className="text-xs font-semibold text-fg-muted">Wishlist Activity Feed ({filtered.length})</h3>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-fg-muted gap-3">
                <Loader2 className="animate-spin" />
                <span className="text-xs font-semibold">Tracking intent...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-line rounded-2xl bg-surface-sunken">
                <Heart className="mx-auto mb-4 text-fg w-12 h-12 opacity-20" />
                <p className="text-sm font-bold text-fg-muted">No wishlist items found</p>
                <p className="text-xs text-fg-muted mt-1 italic font-bold">Insights will appear as customers add items to their wishlist</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                {filtered.map((item) => {
                  const customer = item.storefront_customers;
                  const customerName = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
                  const crmLeadId = customer?.crm_lead_id;

                  return (
                    <div key={item.id} className="bg-bg border border-line rounded-xl p-4 flex items-center gap-4 hover:border-line transition-all">
                      <div className="w-16 h-16 rounded-xl bg-surface border border-line overflow-hidden flex-shrink-0">
                        {item.items?.image_urls?.[0] ? (
                          <img src={item.items.image_urls[0]} alt={item.items.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={24} className="m-auto text-fg" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-semibold text-fg truncate">{item.items?.name || 'Unknown Item'}</p>
                          <Heart size={12} className="text-danger fill-danger/20" />
                        </div>
                        <div className="space-y-1">
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
                            <span className="text-xs font-bold text-fg-muted">Added {formatters.formatDate(item.added_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ListPageTemplate>
  );
};

export default MarketingWishlistPage;
