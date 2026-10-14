import React, { useEffect, useMemo, useState } from 'react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatMoney, MarketingKpiCard } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { Link } from 'react-router-dom';
import { MessageSquare, Heart, Mail, Tag, ChevronRight } from 'lucide-react';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingOverviewPage: React.FC = () => {
  const formatters = useCRMFormatters();
  const { settings } = useBusinessSettings();
  const currencyCode = settings?.base_currency;
  const locale = settings?.document_language || 'en-US';
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  useEffect(() => {
    if (!storeId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [abandonedStats, segments, bestSelling, topBuyers, inactive, funnel, emailPerf, searchLogs] =
          await Promise.all([
            crmService.getAbandonedCartStats(storeId),
            crmService.getMarketingSegments(storeId),
            crmService.getMarketingBestSellingProducts(storeId, { limit: 5 }),
            crmService.getMarketingTopBuyers(storeId, { limit: 5 }),
            crmService.getMarketingInactiveCustomers(storeId, { limit: 5 }),
            crmService.getMarketingConversionFunnel(storeId),
            crmService.getMarketingEmailPerformance(storeId),
            crmService.getAllStorefrontSearches({ take: 5 }),
          ]);
        if (!mounted) return;
        setData({ abandonedStats, segments, bestSelling, topBuyers, inactive, funnel, emailPerf, searchLogs });
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load marketing overview');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [storeId]);

  const kpis = useMemo<MarketingKpiCard[]>(() => {
    if (!data) return [];
    return [
      {
        label: 'Abandoned Carts',
        value: data.abandonedStats?.totalAbandoned || 0,
        hint: `Recovered: ${data.abandonedStats?.totalRecovered || 0}`,
      },
      {
        label: 'Recovery Rate',
        value: `${data.abandonedStats?.recoveryRate || 0}%`,
      },
      {
        label: 'Revenue Recovered',
        value: formatMoney(data.abandonedStats?.revenueRecovered || 0, currencyCode, locale),
      },
      {
        label: 'Email Open Rate',
        value: `${data.emailPerf?.openRate || 0}%`,
      },
    ];
  }, [data, currencyCode, locale]);

  const bestSelling = Array.isArray(data?.bestSelling?.data) ? data.bestSelling.data : [];
  const topBuyers = Array.isArray(data?.topBuyers?.data) ? data.topBuyers.data : [];
  const inactive = Array.isArray(data?.inactive?.data) ? data.inactive.data : [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-fg mb-2">CRM Marketing Overview</h1>
        <p className="text-fg-subtle">DailyStore marketing and customer intelligence in CRM.</p>
      </div>
      <MarketingStorePicker storeId={storeId} onChange={applyStore} />

      {!storeId && <p className="text-warning text-sm">Select a store to load insights.</p>}
      {loading && <p className="text-fg-subtle">Loading...</p>}
      {error && <p className="text-danger">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-surface-sunken border border-line rounded-xl p-5">
                <p className="text-fg-subtle text-sm font-medium">{kpi.label}</p>
                <p className="text-fg text-3xl font-bold mt-2 tracking-tight">{kpi.value}</p>
                {kpi.hint && <p className="text-fg-muted text-xs mt-2 font-medium">{kpi.hint}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Link to="/crm/marketing/reviews" className="bg-surface-sunken border border-line rounded-xl p-4 hover:border-blue-500/50 hover:bg-surface-high transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-warning">
                  <MessageSquare size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-fg-subtle">Customer Reviews</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-fg">Moderate Feedback</span>
                <ChevronRight size={14} className="text-fg-muted group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link to="/crm/marketing/wishlist" className="bg-surface-sunken border border-line rounded-xl p-4 hover:border-blue-500/50 hover:bg-surface-high transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-danger">
                  <Heart size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-fg-subtle">Wishlist Feed</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-fg">Track Customer Intent</span>
                <ChevronRight size={14} className="text-fg-muted group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link to="/crm/marketing/newsletter" className="bg-surface-sunken border border-line rounded-xl p-4 hover:border-blue-500/50 hover:bg-surface-high transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Mail size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-fg-subtle">Newsletter Audience</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-fg">Manage Subscribers</span>
                <ChevronRight size={14} className="text-fg-muted group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link to="/crm/marketing/coupons" className="bg-surface-sunken border border-line rounded-xl p-4 hover:border-blue-500/50 hover:bg-surface-high transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-success">
                  <Tag size={16} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-fg-subtle">Discount Coupons</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-fg">Configure Offers</span>
                <ChevronRight size={14} className="text-fg-muted group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface-sunken border border-line rounded-xl p-6">
              <h3 className="text-fg font-bold mb-4">Top Selling Products</h3>
              <div className="space-y-1">
                {bestSelling.map((row: any) => (
                  <div key={row.itemId} className="flex items-center justify-between border-b border-line pb-3 pt-2">
                    <span className="text-fg font-medium">{row.name}</span>
                    <span className="text-fg-subtle text-sm">{row.quantitySold} sold</span>
                  </div>
                ))}
                {bestSelling.length === 0 && <p className="text-fg-muted text-sm py-4 text-center">No sales data directly available.</p>}
              </div>
            </div>

            <div className="bg-surface-sunken border border-line rounded-xl p-6">
              <h3 className="text-fg font-bold mb-4">Top Buyers</h3>
              <div className="space-y-1">
                {topBuyers.map((row: any) => (
                  <div key={row.customerId} className="flex items-center justify-between border-b border-line pb-3 pt-2">
                    <span className="text-fg font-medium">{row.name || row.email || row.customerId || '-'}</span>
                    <span className="text-fg-subtle text-sm">{formatMoney(row.totalSpent, currencyCode, locale)}</span>
                  </div>
                ))}
                {topBuyers.length === 0 && <p className="text-fg-muted text-sm py-4 text-center">No buyer data available.</p>}
              </div>
            </div>

            <div className="bg-surface-sunken border border-line rounded-xl p-6">
              <h3 className="text-fg font-bold mb-4">Inactive Customers</h3>
              <div className="space-y-1">
                {inactive.map((row: any) => (
                  <div key={row.customerId} className="flex items-center justify-between border-b border-line pb-3 pt-2">
                    <span className="text-fg font-medium">{row.name || row.email || row.customerId}</span>
                    <span className="text-fg-subtle text-xs">{row.daysSinceLastOrder || 0} days</span>
                  </div>
                ))}
                {inactive.length === 0 && <p className="text-fg-muted text-sm py-4 text-center">No inactive customers identified.</p>}
              </div>
            </div>

            <div className="bg-surface-sunken border border-line rounded-xl p-6">
              <h3 className="text-fg font-bold mb-4">Conversion Funnel</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-line">
                  <span className="text-fg-subtle">Product Views</span>
                  <span className="text-fg font-medium">{data.funnel?.funnel?.product_views || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-line">
                  <span className="text-fg-subtle">Add to Cart</span>
                  <span className="text-fg font-medium">{data.funnel?.funnel?.add_to_cart || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-line">
                  <span className="text-fg-subtle">Checkout Started</span>
                  <span className="text-fg font-medium">{data.funnel?.funnel?.checkout_started || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-fg-subtle font-medium">Purchases</span>
                  <span className="text-blue-400 font-bold">{data.funnel?.funnel?.purchases || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-sunken border border-line rounded-xl p-6 lg:col-span-2">
              <h3 className="text-fg font-bold mb-4">Recent Storefront Searches</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.searchLogs?.map((row: any) => {
                  const customer = row.storefront_customers;
                  const name = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
                  return (
                    <div key={row.id} className="flex items-center justify-between p-3 bg-surface-sunken border border-line rounded-lg">
                      <div>
                        <p className="text-fg font-bold text-sm">"{row.search_query}"</p>
                        <p className="text-fg-muted text-[10px] uppercase font-black mt-1">
                          {name} • {formatters.formatDate(row.created_at)}
                        </p>
                      </div>
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20 font-bold">
                        Search
                      </span>
                    </div>
                  );
                })}
                {(!data.searchLogs || data.searchLogs.length === 0) && (
                  <p className="text-fg-muted text-sm py-4 text-center col-span-2">No recent search activity found.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketingOverviewPage;
