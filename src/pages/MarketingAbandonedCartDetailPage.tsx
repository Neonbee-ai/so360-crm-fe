import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { crmService } from '../services/crmService';
import { formatDateTime, formatMoney } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingAbandonedCartDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useBusinessSettings();
  const currencyCode = settings?.base_currency;
  const locale = settings?.document_language || 'en-US';
  const { cartId } = useParams<{ cartId: string }>();
  const [storeId] = useState<string>(localStorage.getItem(STORE_KEY) || '');
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!storeId || !cartId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await crmService.getAbandonedCart(storeId, cartId);
      setCart(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to load abandoned cart detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [storeId, cartId]);

  if (!storeId) {
    return <div className="p-8 text-amber-400">Select a store from Abandoned Carts page first.</div>;
  }

  const items = Array.isArray(cart?.items_summary) ? cart.items_summary : [];

  return (
    <div className="p-8">
      <button
        onClick={() => navigate('/crm/marketing/abandoned-carts')}
        className="text-slate-400 hover:text-slate-100 mb-4 text-sm"
      >
        ← Back to Abandoned Carts
      </button>

      {loading && <p className="text-slate-400">Loading...</p>}
      {error && <p className="text-rose-400">{error}</p>}

      {cart && (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
            <h1 className="text-2xl font-semibold text-white">Abandoned Cart Detail</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-sm">
              <p className="text-slate-300"><span className="text-slate-500">Customer:</span> {cart.customer_email || '-'}</p>
              <p className="text-slate-300"><span className="text-slate-500">Status:</span> {cart.recovery_status || '-'}</p>
              <p className="text-slate-300"><span className="text-slate-500">Cart Total:</span> {formatMoney(cart.cart_total, currencyCode, locale)}</p>
              <p className="text-slate-300"><span className="text-slate-500">Abandoned At:</span> {formatDateTime(cart.abandoned_at)}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
                onClick={async () => {
                  await crmService.sendAbandonedCartRecovery(storeId, cart.id);
                  await load();
                }}
              >
                Send Recovery
              </button>
              <button
                className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white"
                onClick={async () => {
                  await crmService.updateAbandonedCartStatus(storeId, cart.id, 'recovered');
                  await load();
                }}
              >
                Mark Recovered
              </button>
              <button
                className="text-xs px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white"
                onClick={async () => {
                  await crmService.updateAbandonedCartStatus(storeId, cart.id, 'expired');
                  await load();
                }}
              >
                Mark Expired
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-left px-3 py-2">Qty</th>
                  <th className="text-left px-3 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={`${item.item_id || idx}`} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{item.name || item.item_name || '-'}</td>
                    <td className="px-3 py-2 text-slate-300">{item.qty || item.quantity || 0}</td>
                    <td className="px-3 py-2 text-slate-300">{formatMoney(item.price || item.unit_price || 0, currencyCode, locale)}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">No item data found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketingAbandonedCartDetailPage;
