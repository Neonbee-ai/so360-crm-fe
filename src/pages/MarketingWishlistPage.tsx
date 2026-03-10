import React, { useEffect, useState } from 'react';
import { Search, Heart, Package, User, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { ToastContainer, useToast } from '../components/common/Toast';
import { Link } from 'react-router-dom';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingWishlistPage: React.FC = () => {
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toasts, showError, dismissToast } = useToast();

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
      showError(e.message || 'Failed to load wishlist items');
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
    <div className="p-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight uppercase">Customer Wishlists</h1>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Track high-intent items across storefront customers</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Store Context</label>
              <MarketingStorePicker storeId={storeId} onChange={applyStore} />
            </div>
            <div className="md:col-span-8">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Search Wishlists</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold"
                  placeholder="Filter by product or customer name..."
                />
              </div>
            </div>
          </div>
        </section>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 bg-slate-900/50">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Wishlist Activity Feed ({filtered.length})</h3>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                <Loader2 className="animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest">Tracking intent...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                <Heart className="mx-auto mb-4 text-slate-700 w-12 h-12 opacity-20" />
                <p className="text-sm font-bold uppercase text-slate-500 tracking-widest">No wishlist items found</p>
                <p className="text-[10px] text-slate-600 uppercase mt-1 italic font-bold">Insights will appear as customers add items to their wishlist</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                {filtered.map((item) => {
                  const customer = item.storefront_customers;
                  const customerName = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
                  const crmLeadId = customer?.crm_lead_id;

                  return (
                    <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-slate-700 transition-all">
                      <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0">
                        {item.items?.image_urls?.[0] ? (
                          <img src={item.items.image_urls[0]} alt={item.items.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={24} className="m-auto text-slate-700" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-black text-white truncate uppercase tracking-tight">{item.items?.name || 'Unknown Item'}</p>
                          <Heart size={12} className="text-rose-500 fill-rose-500/20" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-slate-600" />
                            {crmLeadId ? (
                              <Link to={`/crm/leads/${crmLeadId}`} className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 truncate">
                                {customerName} <ExternalLink size={8} />
                              </Link>
                            ) : (
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{customerName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-slate-600" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Added {new Date(item.added_at).toLocaleDateString()}</span>
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
    </div>
  );
};

export default MarketingWishlistPage;
