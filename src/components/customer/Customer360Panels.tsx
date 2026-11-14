import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { crmService } from '../../services/crmService';

/**
 * Customer 360 panels — rendered inside the customer Overview tab (and on
 * /crm/customers/:id/360).
 *
 * Deliberately carries **no identity header**: the record page already shows
 * name, email, phone, status and source. Duplicating it put a second header in
 * the middle of the page.
 *
 * Built from Comb v1.1 components (Card / Button / EmptyState) only — no
 * hand-written panel chrome.
 *
 * Data comes from GET /customers/:id/360, which composes it by id from the
 * module that owns each slice. A panel renders only when the user holds the
 * permission the API declares for it.
 */
type Panel = { available?: boolean; reason?: string; [k: string]: any };
type Payload = { panels: Record<string, Panel> };

const currency = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

export function Customer360Panels({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  const shell = useShellBridge();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const can = useMemo(
    () => (perms?: string[]) => {
      if (!perms?.length) return true;
      if (!shell) return false;
      return perms.some((p) => shell.hasPermission?.(p) ?? false);
    },
    [shell],
  );

  useEffect(() => {
    const fetcher = (crmService as unknown as { getCustomer360?: (id: string) => Promise<Payload> })
      .getCustomer360;
    if (!customerId || typeof fetcher !== 'function') {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetcher(customerId)
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [customerId]);

  if (loading || !data) return null;

  const p = data.panels ?? {};
  const sf = p.storefront as any;
  const rows = (list: any[] | undefined) => list ?? [];

  const metrics = [
    { label: 'Deals', value: p.deals?.available === false ? '—' : (p.deals?.count ?? 0) },
    { label: 'Quotes', value: p.quotes?.available === false ? '—' : (p.quotes?.count ?? 0) },
    { label: 'Orders', value: sf?.orders?.count ?? '—' },
    { label: 'Wishlist', value: sf?.wishlist?.count ?? '—' },
    { label: 'Abandoned cart', value: sf?.carts ? currency(sf.carts.abandoned_value) : '—' },
  ];

  return (
    <div className="flex flex-col gap-nb-3">
      <Card title="Commerce activity">
        <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-5">
          {metrics.map((m) => (
            <div key={m.label}>
              <p className="text-xs text-fg-subtle">{m.label}</p>
              <p className="text-lg font-semibold text-fg">{m.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {can(p.deals?.permissions) && p.deals?.available !== false && (
        <Card title="Deals">
          {rows(p.deals?.recent).length === 0 ? (
            <EmptyState title="No deals yet" description="Deals raised for this customer will appear here." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(p.deals?.recent).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{d.title || 'Deal'}</span>
                  <span className="text-fg-muted">{d.stage} · {currency(d.value)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => navigate(p.deals.deep_link)}>All deals</Button>
        </Card>
      )}

      {can(p.quotes?.permissions) && p.quotes?.available !== false && (
        <Card title="Quotes">
          {rows(p.quotes?.recent).length === 0 ? (
            <EmptyState title="No quotes yet" description="Quotes sent to this customer will appear here." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(p.quotes?.recent).map((q: any) => (
                <li key={q.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{q.quote_number || 'Quote'}</span>
                  <span className="text-fg-muted">{q.status} · {currency(q.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => navigate(p.quotes.deep_link)}>All quotes</Button>
        </Card>
      )}

      {sf?.available !== false && can(sf?.orders?.permissions) && (
        <Card title="Storefront orders">
          {rows(sf?.orders?.recent).length === 0 ? (
            <EmptyState title="No orders yet" description="Storefront orders for this customer will appear here." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(sf?.orders?.recent).map((o: any) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{o.order_number || 'Order'}</span>
                  <span className="text-fg-muted">{o.status} · {currency(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => navigate(sf.orders.deep_link)}>All orders</Button>
        </Card>
      )}

      {sf?.available !== false && can(sf?.carts?.permissions) && (
        <Card title="Cart">
          <p className="text-sm text-fg">
            {sf.carts?.open ?? 0} active · {sf.carts?.abandoned ?? 0} abandoned
          </p>
          <p className="text-sm text-fg-muted">
            Abandoned value {currency(sf.carts?.abandoned_value)}
          </p>
          <Button variant="ghost" onClick={() => navigate(sf.carts.deep_link)}>Open carts</Button>
        </Card>
      )}

      {sf?.available !== false && can(sf?.sessions?.permissions) && (
        <Card title="Where they travelled">
          {rows(sf?.sessions?.sessions).length === 0 ? (
            <EmptyState title="No tracked sessions" description="Browsing sessions appear once the visitor is identified." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(sf?.sessions?.sessions).map((s: any) => (
                <li key={s.session_id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{s.landing_path || '/'}</span>
                  <span className="text-fg-muted">{s.pageviews} views</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => navigate(sf.sessions.deep_link)}>Open analytics</Button>
        </Card>
      )}

      {sf?.available === false && (
        <Card title="Storefront">
          <EmptyState title="No storefront account" description={sf?.reason || 'This customer has no storefront link.'} />
        </Card>
      )}
    </div>
  );
}
