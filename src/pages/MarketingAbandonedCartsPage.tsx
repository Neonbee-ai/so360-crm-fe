import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { MarketingStorePicker } from '../components/MarketingStorePicker';
import { formatDateTime, formatMoney, mapAbandonedCart } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';
import { Button } from '@so360/design-system';

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
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Abandoned Carts</h1>
        <p className="text-slate-400">Managed from CRM, sourced from Storefront.</p>
      </div>
      <MarketingStorePicker storeId={storeId} onChange={applyStore} />

      <div className="flex items-center gap-3 mb-6 bg-slate-900/50 p-3 rounded-xl border border-slate-800 w-fit">
        <label className="text-slate-400 text-sm font-medium">Status Filter</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow appearance-none cursor-pointer pr-8"
        >
          <option value="">All Carts</option>
          <option value="pending">Pending</option>
          <option value="email_sent">Email Sent</option>
          <option value="recovered">Recovered</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}
      {error && <p className="text-rose-400 mb-3">{error}</p>}

      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {cards.map((card) => (
            <div key={card.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <p className="text-slate-400 text-sm font-medium">{card.label}</p>
              <p className="text-slate-100 text-3xl font-bold mt-2 tracking-tight">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer Email</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Cart Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Abandoned At</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 border-t border-slate-800/50">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-200 font-medium">{row.customerEmail || '-'}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {row.itemCount} <span className="text-slate-500 text-xs ml-1">items</span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{formatMoney(row.cartTotal, currencyCode, locale)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${row.status === 'recovered'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : row.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400'
                          : row.status === 'email_sent'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                    >
                      {(row.status || '-').replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDateTime(row.abandonedAt)}</td>
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
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">No abandoned carts found matching criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MarketingAbandonedCartsPage;
