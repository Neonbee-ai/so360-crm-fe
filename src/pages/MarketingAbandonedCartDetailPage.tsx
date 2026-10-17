import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DetailPageTemplate, Button, Card, DataTable, EmptyState, StatusBadge } from '@so360/design-system';
import { crmService } from '../services/crmService';
import { formatDateTime, formatMoney } from './marketing/marketingMappers';
import { useBusinessSettings } from '@so360/shell-context';

const STORE_KEY = 'crm_marketing_store_id';

const MarketingAbandonedCartDetailPage: React.FC = () => {
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
    return <div className="text-warning">Select a store from Abandoned Carts page first.</div>;
  }

  const items = Array.isArray(cart?.items_summary) ? cart.items_summary : [];

  const markStatus = (status: 'recovered' | 'expired') => async () => {
    await crmService.updateAbandonedCartStatus(storeId, cart.id, status);
    await load();
  };

  return (
    <DetailPageTemplate
      trail={[{ label: 'Marketing', to: '/crm/marketing/overview' }, { label: 'Abandoned carts', to: '/crm/marketing/abandoned-carts' }]}
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
            <DataTable
              name="abandoned-cart-items"
              columns={[
                { key: 'item', header: 'Item', render: (item: any) => <span className="text-fg">{item.name || item.item_name || '-'}</span> },
                { key: 'qty', header: 'Qty', render: (item: any) => <span className="text-fg-subtle">{item.qty || item.quantity || 0}</span> },
                { key: 'price', header: 'Price', render: (item: any) => <span className="text-fg-subtle">{formatMoney(item.price || item.unit_price || 0, currencyCode, locale)}</span> },
              ]}
              rows={items.map((item: any, idx: number) => ({ ...item, __idx: idx }))}
              rowKey={(item: any) => `${item.item_id || item.__idx}`}
            />
          )}
        </Card>
      )}
    </DetailPageTemplate>
  );
};

export default MarketingAbandonedCartDetailPage;
