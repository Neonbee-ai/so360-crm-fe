import React, { useEffect, useMemo, useState } from 'react';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatMoney, MarketingKpiCard } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { Link } from 'react-router-dom';
import { MessageSquare, Heart, Mail, Tag, ChevronRight } from 'lucide-react';
import { DashboardPageTemplate, KpiCard, Card, Badge } from '@so360/design-system';

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

  const quickLinks = [
    { to: '/crm/marketing/reviews', icon: MessageSquare, tone: 'text-warning', label: 'Customer Reviews', cta: 'Moderate Feedback' },
    { to: '/crm/marketing/wishlist', icon: Heart, tone: 'text-danger', label: 'Wishlist Feed', cta: 'Track Customer Intent' },
    { to: '/crm/marketing/newsletter', icon: Mail, tone: 'text-primary', label: 'Newsletter Audience', cta: 'Manage Subscribers' },
    { to: '/crm/marketing/coupons', icon: Tag, tone: 'text-success', label: 'Discount Coupons', cta: 'Configure Offers' },
  ];

  const rowCls = 'flex items-center justify-between gap-nb-3 py-nb-2';

  return (
    <DashboardPageTemplate
      title="CRM Marketing Overview"
      description="DailyStore marketing and customer intelligence in CRM."
      filters={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
      kpis={data ? kpis.map((kpi) => (
        <KpiCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.hint ? (
            <>
              {kpi.value}
              <span className="block text-xs font-normal text-fg-muted mt-1">{kpi.hint}</span>
            </>
          ) : kpi.value}
        />
      )) : undefined}
    >

      {!storeId && <p className="text-warning text-sm">Select a store to load insights.</p>}
      {loading && <p className="text-fg-subtle">Loading...</p>}
      {error && <p className="text-danger">{error}</p>}

      {data && (
        <div className="flex flex-col gap-nb-3">
          <Card title="Marketing tools">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-nb-3">
              {quickLinks.map(({ to, icon: Icon, tone, label, cta }) => (
                <Link key={to} to={to} className="rounded-nb p-nb-2 hover:bg-surface-raised transition-colors group">
                  <div className="flex items-center gap-nb-2 mb-1">
                    <Icon size={16} className={tone} />
                    <span className="text-xs font-semibold text-fg-subtle">{label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-fg">{cta}</span>
                    <ChevronRight size={14} className="text-fg-muted group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-nb-3">
            <Card title="Top Selling Products" className="lg:col-span-6">
              <div className="divide-y divide-line">
                {bestSelling.map((row: any) => (
                  <div key={row.itemId} className={rowCls}>
                    <span className="text-fg font-medium">{row.name}</span>
                    <span className="text-fg-subtle text-sm">{row.quantitySold} sold</span>
                  </div>
                ))}
                {bestSelling.length === 0 && <p className="text-fg-muted text-sm py-4 text-center">No sales data directly available.</p>}
              </div>
            </Card>

            <Card title="Top Buyers" className="lg:col-span-6">
              <div className="divide-y divide-line">
                {topBuyers.map((row: any) => (
                  <div key={row.customerId} className={rowCls}>
                    <span className="text-fg font-medium">{row.name || row.email || row.customerId || '-'}</span>
                    <span className="text-fg-subtle text-sm">{formatMoney(row.totalSpent, currencyCode, locale)}</span>
                  </div>
                ))}
                {topBuyers.length === 0 && <p className="text-fg-muted text-sm py-4 text-center">No buyer data available.</p>}
              </div>
            </Card>

            <Card title="Inactive Customers" className="lg:col-span-6">
              <div className="divide-y divide-line">
                {inactive.map((row: any) => (
                  <div key={row.customerId} className={rowCls}>
                    <span className="text-fg font-medium">{row.name || row.email || row.customerId}</span>
                    <span className="text-fg-subtle text-xs">{row.daysSinceLastOrder || 0} days</span>
                  </div>
                ))}
                {inactive.length === 0 && <p className="text-fg-muted text-sm py-4 text-center">No inactive customers identified.</p>}
              </div>
            </Card>

            <Card title="Conversion Funnel" className="lg:col-span-6">
              <div className="divide-y divide-line text-sm">
                <div className={rowCls}>
                  <span className="text-fg-subtle">Product Views</span>
                  <span className="text-fg font-medium">{data.funnel?.funnel?.product_views || 0}</span>
                </div>
                <div className={rowCls}>
                  <span className="text-fg-subtle">Add to Cart</span>
                  <span className="text-fg font-medium">{data.funnel?.funnel?.add_to_cart || 0}</span>
                </div>
                <div className={rowCls}>
                  <span className="text-fg-subtle">Checkout Started</span>
                  <span className="text-fg font-medium">{data.funnel?.funnel?.checkout_started || 0}</span>
                </div>
                <div className={rowCls}>
                  <span className="text-fg-subtle font-medium">Purchases</span>
                  <span className="text-primary font-semibold">{data.funnel?.funnel?.purchases || 0}</span>
                </div>
              </div>
            </Card>

            <Card title="Recent Storefront Searches" className="lg:col-span-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-nb-3">
                {data.searchLogs?.map((row: any) => {
                  const customer = row.storefront_customers;
                  const name = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Anonymous';
                  return (
                    <div key={row.id} className="flex items-center justify-between gap-nb-3 py-nb-2 border-b border-line">
                      <div className="min-w-0">
                        <p className="text-fg font-semibold text-sm truncate">"{row.search_query}"</p>
                        <p className="text-fg-muted text-xs mt-1">
                          {name} • {formatters.formatDate(row.created_at)}
                        </p>
                      </div>
                      <Badge tone="primary" size="sm">Search</Badge>
                    </div>
                  );
                })}
                {(!data.searchLogs || data.searchLogs.length === 0) && (
                  <p className="text-fg-muted text-sm py-4 text-center md:col-span-2">No recent search activity found.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </DashboardPageTemplate>
  );
};

export default MarketingOverviewPage;
