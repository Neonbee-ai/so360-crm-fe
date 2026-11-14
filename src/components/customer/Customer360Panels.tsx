import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, Briefcase, CalendarClock, FileText, Heart, ListChecks,
  Mail, MapPin, Phone, ShoppingBag, ShoppingCart, Timer, User,
} from 'lucide-react';
import { useShellBridge } from '@so360/shell-context';
import { crmService } from '../../services/crmService';

/**
 * Customer 360 — the UI half of the template.
 *
 * Every panel is rendered from `GET /customers/:id/360`, which composes the
 * data by id from the module that owns it. Each panel:
 *   - shows a count / recent rows,
 *   - links to that module's own detail screen (deep link from the API),
 *   - only renders when the user holds the panel's permission, so the 360 can
 *     never become a permission bypass.
 * A panel the API marks unavailable shows a neutral "not available" state
 * instead of breaking the page.
 */

type Panel = { available?: boolean; reason?: string; [k: string]: any };
type Payload = {
  profile: {
    id: string; name?: string; email?: string; phone?: string; status?: string;
    source?: string; created_at?: string;
  };
  panels: Record<string, Panel>;
};

const money = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(n || 0);

export function Customer360Panels({ customerId }: { customerId: string }) {
  const id = customerId;
  const shell = useShellBridge();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const can = useMemo(
    () => (perms?: string[]) => {
      if (!perms || perms.length === 0) return true;
      if (!shell) return false;
      return perms.some((p) => shell.hasPermission?.(p) ?? false);
    },
    [shell],
  );

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    crmService
      .getCustomer360<Payload>(id)
      .then((res: Payload) => { if (alive) { setData(res); setError(null); } })
      .catch((err: any) => { if (alive) setError(err?.body?.message || err?.message || 'Failed to load the 360'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const p = data?.panels ?? {};
  const storefront = p.storefront as any;

  const Panel_ = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );

  const Unavailable = ({ reason }: { reason?: string }) => (
    <p className="text-xs text-fg-subtle">{reason || 'Not available'}</p>
  );

  const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-fg-subtle">{label}</p>
      <p className="mt-1 text-xl font-bold text-fg">{value}</p>
    </div>
  );

  if (loading) return <div className="p-8 text-fg-muted">Loading 360…</div>;
  if (error) return <div className="p-8 text-danger">{error}</div>;
  if (!data) return null;

  const { profile } = data;

  return (
    <div className="flex flex-col gap-nb-3">
      {/* Identity */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">{profile.name || profile.email || 'Customer'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-fg-muted">
            {profile.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{profile.email}</span>}
            {profile.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{profile.phone}</span>}
            {profile.status && <span className="rounded-full border border-line px-2 py-0.5 text-xs uppercase">{profile.status}</span>}
            {profile.source && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{profile.source}</span>}
          </div>
        </div>
        <Link to={`/crm/customers/${profile.id}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
          Open customer record <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Headline metrics */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Deals" value={p.deals?.available === false ? '—' : p.deals?.count ?? 0} />
        <Metric label="Quotes" value={p.quotes?.available === false ? '—' : p.quotes?.count ?? 0} />
        <Metric label="Orders" value={storefront?.orders?.count ?? '—'} />
        <Metric label="Wishlist" value={storefront?.wishlist?.count ?? '—'} />
        <Metric label="Abandoned cart" value={storefront?.carts ? money(storefront.carts.abandoned_value) : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* CRM panels */}
        {p.deals?.available !== false && can(p.deals?.permissions) && (
          <Panel_ title="Deals" icon={Briefcase}>
            {(p.deals?.recent ?? []).length === 0 ? <Unavailable reason="No deals yet" /> : (
              <ul className="space-y-2">
                {p.deals.recent.map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <Link to={`/crm/pipeline?deal=${d.id}`} className="text-fg hover:underline">{d.title || 'Deal'}</Link>
                    <span className="text-fg-muted">{d.stage || ''} · {money(d.value)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to={p.deals?.deep_link} className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">All deals <ArrowUpRight className="h-3 w-3" /></Link>
          </Panel_>
        )}

        {p.quotes?.available !== false && can(p.quotes?.permissions) && (
          <Panel_ title="Quotes" icon={FileText}>
            {(p.quotes?.recent ?? []).length === 0 ? <Unavailable reason="No quotes yet" /> : (
              <ul className="space-y-2">
                {p.quotes.recent.map((q: any) => (
                  <li key={q.id} className="flex items-center justify-between text-sm">
                    <Link to={p.quotes.deep_link} className="text-fg hover:underline">{q.quote_number || q.id.slice(0, 8)}</Link>
                    <span className="text-fg-muted">{q.status} · {money(q.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel_>
        )}

        {/* Storefront panels */}
        {storefront && storefront.available !== false && (
          <>
            {can(storefront.orders?.permissions) && (
              <Panel_ title="Orders" icon={ShoppingBag}>
                {(storefront.orders?.recent ?? []).length === 0 ? <Unavailable reason="No orders yet" /> : (
                  <ul className="space-y-2">
                    {storefront.orders.recent.map((o: any) => (
                      <li key={o.id} className="flex items-center justify-between text-sm">
                        <Link to={storefront.orders.deep_link} className="text-fg hover:underline">{o.order_number || o.id.slice(0, 8)}</Link>
                        <span className="text-fg-muted">{o.status} · {money(o.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel_>
            )}

            {can(storefront.carts?.permissions) && (
              <Panel_ title="Cart" icon={ShoppingCart}>
                {storefront.carts?.available === false ? <Unavailable reason={storefront.carts.reason} /> : (
                  <div className="space-y-1 text-sm text-fg-muted">
                    <p>{storefront.carts?.open ?? 0} active · {storefront.carts?.abandoned ?? 0} abandoned</p>
                    <p className="text-fg-muted">Abandoned value {money(storefront.carts?.abandoned_value)}</p>
                    <Link to={storefront.carts?.deep_link} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Open orders <ArrowUpRight className="h-3 w-3" /></Link>
                  </div>
                )}
              </Panel_>
            )}

            {can(storefront.sessions?.permissions) && (
              <Panel_ title="Sessions — where they travelled" icon={Timer}>
                {(storefront.sessions?.sessions ?? []).length === 0 ? <Unavailable reason="No tracked sessions" /> : (
                  <ul className="space-y-1.5 text-sm">
                    {storefront.sessions.sessions.map((s: any) => (
                      <li key={s.session_id} className="flex items-center justify-between">
                        <span className="text-fg">{s.landing_path || '/'}</span>
                        <span className="text-fg-subtle">{s.pageviews} views · {String(s.started_at).slice(0, 16)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to={storefront.sessions?.deep_link} className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">Open analytics <ArrowUpRight className="h-3 w-3" /></Link>
              </Panel_>
            )}
          </>
        )}

        {(!storefront || storefront.available === false) && (
          <Panel_ title="Storefront" icon={User}>
            <Unavailable reason={storefront?.reason || 'No storefront account linked to this customer'} />
          </Panel_>
        )}
      </div>
    </div>
  );
}
