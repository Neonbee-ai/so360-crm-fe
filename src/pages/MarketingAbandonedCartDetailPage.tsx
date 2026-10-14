import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DetailPageTemplate, Button, Card, EmptyState, StatusBadge } from '@so360/design-system';
import { crmService } from '../services/crmService';
import { formatDateTime, formatMoney } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';
import { goBackFrom } from '../components/common/DetailBackLink';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingAbandonedCartDetailPage: React.FC = () => {
  const { settings } = useBusinessSettings();
  const currencyCode = settings?.base_currency;
  const locale = settings?.document_language || 'en-US';
  const { cartId } = useParams<{ cartId: string }>();
  const navigate = useNavigate();
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
    return <div className="text-warning">Select a store from Abandoned Carts page first.</div>;
  }

  const items = Array.isArray(cart?.items_summary) ? cart.items_summary : [];

  const markStatus = (status: 'recovered' | 'expired') => async () => {
    await crmService.updateAbandonedCartStatus(storeId, cart.id, status);
    await load();
  };

  return (
    <DetailPageTemplate
      onBack={() => goBackFrom(navigate, '/crm/marketing/abandoned-carts')}
      title="Abandoned Cart Detail"
      status={cart?.recovery_status ? <StatusBadge status={cart.recovery_status} size="sm" /> : undefined}
      sidePanel={cart ? (
        <div className="flex flex-col gap-nb-3">
          <Card title="Customer">
            <p className="text-xs text-fg-muted">Email</p>
            <p className="text-sm text-fg">{cart.customer_email || '-'}</p>
          </Card>
          <Card title="Cart value and dates">
            <dl className="flex flex-col gap-nb-3 text-sm">
              <div>
                <dt className="text-xs text-fg-muted">Cart total</dt>
                <dd className="text-fg">{formatMoney(cart.cart_total, currencyCode, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Abandoned at</dt>
                <dd className="text-fg">{formatDateTime(cart.abandoned_at)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      ) : undefined}
      primaryAction={cart ? (
        <Button
          variant="primary"
          onClick={async () => {
            await crmService.sendAbandonedCartRecovery(storeId, cart.id);
            await load();
          }}
        >
          Send Recovery
        </Button>
      ) : undefined}
      secondaryActions={cart ? [
        <Button key="recovered" variant="secondary" onClick={markStatus('recovered')}>Mark Recovered</Button>,
      ] : undefined}
      overflowActions={cart ? [{ label: 'Mark Expired', onSelect: markStatus('expired') }] : undefined}
    >
      {loading && <p className="text-fg-subtle">Loading...</p>}
      {error && <p className="text-danger">{error}</p>}

      {cart && (
        <Card title="Items" padding="none">
          {items.length === 0 ? (
            <EmptyState title="No item data found." />
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-fg-muted">
                  <tr>
                    <th className="px-nb-3 py-nb-2 font-medium">Item</th>
                    <th className="px-nb-3 py-nb-2 font-medium">Qty</th>
                    <th className="px-nb-3 py-nb-2 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item: any, idx: number) => (
                    <tr key={`${item.item_id || idx}`}>
                      <td className="px-nb-3 py-nb-2 text-fg">{item.name || item.item_name || '-'}</td>
                      <td className="px-nb-3 py-nb-2 text-fg-subtle">{item.qty || item.quantity || 0}</td>
                      <td className="px-nb-3 py-nb-2 text-fg-subtle">{formatMoney(item.price || item.unit_price || 0, currencyCode, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </DetailPageTemplate>
  );
};

export default MarketingAbandonedCartDetailPage;
