import React, { useEffect, useState } from 'react';
import { Search, Star, Package, User, Clock, ShieldCheck, ExternalLink, MessageSquare, Loader2, Filter } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { ToastContainer, useToast } from '../components/common/Toast';
import { Link } from 'react-router-dom';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingReviewsPage: React.FC = () => {
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const { toasts, showError, dismissToast } = useToast();

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
      showError(e.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId]);

  const filtered = reviews.filter(r => {
    const matchesSearch = !search || 
      r.title?.toLowerCase().includes(search.toLowerCase()) || 
      r.content?.toLowerCase().includes(search.toLowerCase()) ||
      r.items?.name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'approved' && r.is_approved) ||
      (statusFilter === 'pending' && !r.is_approved);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight uppercase">Customer Reviews</h1>
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Monitor and moderate storefront product feedback</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Store Context</label>
              <MarketingStorePicker storeId={storeId} onChange={applyStore} />
            </div>
            <div className="md:col-span-5">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Search Feed</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold"
                  placeholder="Filter by product, title, or content..."
                />
              </div>
            </div>
            <div className="md:col-span-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Status Filter</label>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['all', 'pending', 'approved'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <Loader2 className="animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Loading reviews...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
              <MessageSquare className="mx-auto mb-4 text-slate-700 w-12 h-12 opacity-20" />
              <p className="text-sm font-bold uppercase text-slate-500 tracking-widest">No reviews found</p>
              <p className="text-[10px] text-slate-600 uppercase mt-1 italic font-bold">Try adjusting your filters or selecting another store</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filtered.map((rev) => {
                const customer = rev.storefront_customers;
                const customerName = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
                const crmLeadId = customer?.crm_lead_id;

                return (
                  <div key={rev.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 group hover:border-slate-700 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex text-yellow-500">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} fill={i < rev.rating ? 'currentColor' : 'none'} className={i < rev.rating ? '' : 'text-slate-700'} />
                          ))}
                        </div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">{rev.title || 'Untitled Review'}</h3>
                      </div>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded border ${rev.is_approved ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {rev.is_approved ? 'Approved' : 'Pending Approval'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 italic mb-6 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                      "{rev.content || 'No content provided'}"
                    </p>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-4 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">By</span>
                        {crmLeadId ? (
                          <Link to={`/crm/leads/${crmLeadId}`} className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1">
                            {customerName} <ExternalLink size={10} />
                          </Link>
                        ) : (
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{customerName}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Package className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Product</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{rev.items?.name || 'Unknown Item'}</span>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        <Clock className="w-3 h-3 text-slate-600" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{new Date(rev.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href="/dailystore/reviews" 
                        target="_blank"
                        className="bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all border border-slate-700 flex items-center gap-2"
                      >
                        <ShieldCheck size={12} /> Moderate in DailyStore
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketingReviewsPage;
