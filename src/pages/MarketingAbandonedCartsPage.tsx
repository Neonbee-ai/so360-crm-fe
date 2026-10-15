import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatDateTime, formatMoney, mapAbandonedCart } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';
import { Button, Card, KpiCard, ListPageTemplate } from '@so360/design-system';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingAbandonedCartsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useBusinessSettings();
  const currencyCode = settings?.base_currency;
  const locale = settings?.document_language || 'en-US';
  const [storeId, setStoreId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [stats, setStats] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyStore = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const load = async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, listRes] = await Promise.all([
        crmService.getAbandonedCartStats(storeId),
        crmService.getAbandonedCarts(storeId, { page: 1, limit: 50, ...(statusFilter ? { recovery_status: statusFilter } : {}) }),
      ]);
      setStats(statsRes);
      setRows(Array.isArray(listRes?.data) ? listRes.data.map(mapAbandonedCart) : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load abandoned carts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId, statusFilter]);

  const cards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Abandoned', value: stats.totalAbandoned || 0 },
      { label: 'Recovered', value: stats.totalRecovered || 0 },
      { label: 'Recovery Rate', value: `${stats.recoveryRate || 0}%` },
      { label: 'Recovered Revenue', value: formatMoney(stats.revenueRecovered || 0, currencyCode, locale) },
    ];
  }, [stats, currencyCode, locale]);

  return (
    <ListPageTemplate
      title="Abandoned Carts"
      description="Managed from CRM, sourced from Storefront."
      filters={
        <select
          aria-label="Status filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-nb-control-md rounded-nb border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-primary"
        >
          <option value="">All Carts</option>
          <option value="pending">Pending</option>
          <option value="email_sent">Email Sent</option>
          <option value="recovered">Recovered</option>
          <option value="expired">Expired</option>
        </select>
      }
      toolbarEnd={<MarketingStorePicker storeId={storeId} onChange={applyStore} />}
    >

      {loading && <p className="text-fg-subtle">Loading...</p>}
      {error && <p className="text-danger mb-3">{error}</p>}

      {cards.length > 0 && (
        <div className="grid grid-cols-2 wc-medium:grid-cols-4 gap-nb-3 mb-nb-3">
          {cards.map((card) => (
            <KpiCard key={card.label} label={card.label} value={card.value} />
          ))}
        </div>
      )}

      <Card title="Abandoned Carts" padding="none">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-raised text-fg-subtle font-medium">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer Email</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Cart Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Abandoned At</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-high transition-colors">
                  <td className="px-4 py-3 text-fg font-medium">{row.customerEmail || '-'}</td>
                  <td className="px-4 py-3 text-fg-subtle">
                    {row.itemCount} <span className="text-fg-muted text-xs ml-1">items</span>
                  </td>
                  <td className="px-4 py-3 text-fg">{formatMoney(row.cartTotal, currencyCode, locale)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${row.status === 'recovered'
                        ? 'bg-success/10 text-success'
                        : row.status === 'pending'
                          ? 'bg-warning/10 text-warning'
                          : row.status === 'email_sent'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-surface-raised text-fg-subtle'
                        }`}
                    >
                      {(row.status || '-').replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-subtle text-xs">{formatDateTime(row.abandonedAt)}</td>
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/crm/marketing/abandoned-carts/${row.id}`)}
                    >
                      View
                    </Button>
                    {row.status !== 'recovered' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          await crmService.sendAbandonedCartRecovery(storeId, row.id);
                          await load();
                        }}
                      >
                        Send Recovery
                      </Button>
                    )}
                    {row.status !== 'recovered' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          await crmService.updateAbandonedCartStatus(storeId, row.id, 'recovered');
                          await load();
                        }}
                      >
                        Mark Recovered
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-fg-muted text-sm">No abandoned carts found matching criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </ListPageTemplate>
  );
};

export default MarketingAbandonedCartsPage;
