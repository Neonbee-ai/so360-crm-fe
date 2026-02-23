import React, { useEffect, useMemo, useState } from 'react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatMoney, MarketingKpiCard } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingOverviewPage: React.FC = () => {
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
        const [abandonedStats, segments, bestSelling, topBuyers, inactive, funnel, emailPerf] =
          await Promise.all([
            crmService.getAbandonedCartStats(storeId),
            crmService.getMarketingSegments(storeId),
            crmService.getMarketingBestSellingProducts(storeId, { limit: 5 }),
            crmService.getMarketingTopBuyers(storeId, { limit: 5 }),
            crmService.getMarketingInactiveCustomers(storeId, { limit: 5 }),
            crmService.getMarketingConversionFunnel(storeId),
            crmService.getMarketingEmailPerformance(storeId),
          ]);
        if (!mounted) return;
        setData({ abandonedStats, segments, bestSelling, topBuyers, inactive, funnel, emailPerf });
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
        <h1 className="text-3xl font-bold text-slate-100 mb-2">CRM Marketing Overview</h1>
        <p className="text-slate-400">DailyStore marketing and customer intelligence in CRM.</p>
      </div>
      <MarketingStorePicker storeId={storeId} onChange={applyStore} />

      {!storeId && <p className="text-amber-400 text-sm">Select a store to load insights.</p>}
      {loading && <p className="text-slate-400">Loading...</p>}
      {error && <p className="text-rose-400">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <p className="text-slate-400 text-sm font-medium">{kpi.label}</p>
                <p className="text-slate-100 text-3xl font-bold mt-2 tracking-tight">{kpi.value}</p>
                {kpi.hint && <p className="text-slate-500 text-xs mt-2 font-medium">{kpi.hint}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-slate-100 font-bold mb-4">Top Selling Products</h3>
              <div className="space-y-1">
                {bestSelling.map((row: any) => (
                  <div key={row.itemId} className="flex items-center justify-between border-b border-slate-800/50 pb-3 pt-2">
                    <span className="text-slate-200 font-medium">{row.name}</span>
                    <span className="text-slate-400 text-sm">{row.quantitySold} sold</span>
                  </div>
                ))}
                {bestSelling.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">No sales data directly available.</p>}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-slate-100 font-bold mb-4">Top Buyers</h3>
              <div className="space-y-1">
                {topBuyers.map((row: any) => (
                  <div key={row.customerId} className="flex items-center justify-between border-b border-slate-800/50 pb-3 pt-2">
                    <span className="text-slate-200 font-medium">{row.name || row.email || row.customerId || '-'}</span>
                    <span className="text-slate-300 text-sm">{formatMoney(row.totalSpent, currencyCode, locale)}</span>
                  </div>
                ))}
                {topBuyers.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">No buyer data available.</p>}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-slate-100 font-bold mb-4">Inactive Customers</h3>
              <div className="space-y-1">
                {inactive.map((row: any) => (
                  <div key={row.customerId} className="flex items-center justify-between border-b border-slate-800/50 pb-3 pt-2">
                    <span className="text-slate-200 font-medium">{row.name || row.email || row.customerId}</span>
                    <span className="text-slate-400 text-xs">{row.daysSinceLastOrder || 0} days</span>
                  </div>
                ))}
                {inactive.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">No inactive customers identified.</p>}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
              <h3 className="text-slate-100 font-bold mb-4">Conversion Funnel</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Product Views</span>
                  <span className="text-slate-200 font-medium">{data.funnel?.funnel?.product_views || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Add to Cart</span>
                  <span className="text-slate-200 font-medium">{data.funnel?.funnel?.add_to_cart || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                  <span className="text-slate-400">Checkout Started</span>
                  <span className="text-slate-200 font-medium">{data.funnel?.funnel?.checkout_started || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-300 font-medium">Purchases</span>
                  <span className="text-blue-400 font-bold">{data.funnel?.funnel?.purchases || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketingOverviewPage;
