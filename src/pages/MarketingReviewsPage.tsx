import React, { useEffect, useState } from 'react';
import { Search, Star, Package, User, Clock, ShieldCheck, ExternalLink, MessageSquare, Loader2, Filter } from 'lucide-react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { toast, ListPageTemplate } from '@so360/design-system';
import { Link } from 'react-router-dom';
import { useCRMFormatters } from '../utils/formatters';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingReviewsPage: React.FC = () => {
  const formatters = useCRMFormatters();
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');

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
    <ListPageTemplate
      title="Customer Reviews"
      description="Monitor and moderate storefront product feedback"
      filters={
        <>
          <div className="inline-flex rounded-nb border border-line bg-surface p-0.5" role="group" aria-label="Status filter">
            {(['all', 'pending', 'approved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`h-8 px-3 rounded-nb text-sm capitalize ${statusFilter === s ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative w-full wc-medium:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-nb-control-md w-full rounded-nb border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-primary"
              placeholder="Filter by product, title, or content..."
            />
          </div>
        </>
      }
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >

      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-fg-muted gap-3">
              <Loader2 className="animate-spin" />
              <span className="text-xs font-semibold">Loading reviews...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-line rounded-2xl bg-surface-sunken">
              <MessageSquare className="mx-auto mb-4 text-fg-subtle w-12 h-12 opacity-20" />
              <p className="text-sm font-bold text-fg-muted">No reviews found</p>
              <p className="text-xs text-fg-subtle mt-1 italic font-bold">Try adjusting your filters or selecting another store</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filtered.map((rev) => {
                const customer = rev.storefront_customers;
                const customerName = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
                const crmLeadId = customer?.crm_lead_id;

                return (
                  <div key={rev.id} className="bg-surface border border-line rounded-2xl p-6 group hover:border-line transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex text-warning">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} fill={i < rev.rating ? 'currentColor' : 'none'} className={i < rev.rating ? '' : 'text-fg-subtle'} />
                          ))}
                        </div>
                        <h3 className="text-sm font-semibold text-fg">{rev.title || 'Untitled Review'}</h3>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded border ${rev.is_approved ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                        {rev.is_approved ? 'Approved' : 'Pending Approval'}
                      </span>
                    </div>

                    <p className="text-sm text-fg-subtle italic mb-6 leading-relaxed bg-surface-sunken p-4 rounded-xl border border-line">
                      "{rev.content || 'No content provided'}"
                    </p>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-4 border-t border-line">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-fg-muted" />
                        <span className="text-xs font-semibold text-fg-muted">By</span>
                        {crmLeadId ? (
                          <Link to={`/crm/leads/${crmLeadId}`} className="text-xs font-semibold text-primary hover:text-primary flex items-center gap-1">
                            {customerName} <ExternalLink size={10} />
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-fg-subtle">{customerName}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Package className="w-3 h-3 text-fg-muted" />
                        <span className="text-xs font-semibold text-fg-muted">Product</span>
                        <span className="text-xs font-semibold text-fg-subtle">{rev.items?.name || 'Unknown Item'}</span>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        <Clock className="w-3 h-3 text-fg-subtle" />
                        <span className="text-xs font-semibold text-fg-subtle">{formatters.formatDate(rev.created_at)}</span>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href="/dailystore/reviews" 
                        target="_blank"
                        className="bg-surface-high hover:bg-surface-high text-fg text-xs font-semibold px-4 py-2 rounded-lg transition-all border border-line flex items-center gap-2 shadow-sm"
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
    </ListPageTemplate>
  );
};

export default MarketingReviewsPage;
