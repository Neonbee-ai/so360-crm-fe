import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState } from '@so360/design-system';
import { useShellBridge } from '@so360/shell-context';
import { crmService } from '../../services/crmService';

/**
 * Partner 360 panels — the partner record's cross-module view.
 *
 * Same contract as Customer360Panels: the API composes by id from the module
 * that owns each slice; every panel carries its deep link and the permission
 * the UI must check; a panel the API marks unavailable renders a neutral
 * state. No identity header — the record page already shows who this is.
 */
type Panel = { available?: boolean; reason?: string; [k: string]: any };
type Payload = { panels: Record<string, Panel> };

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

export function Partner360Panels({ partnerId }: { partnerId: string }) {
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
    const fetcher = (crmService as unknown as { getPartner360?: (id: string) => Promise<Payload> })
      .getPartner360;
    if (!partnerId || typeof fetcher !== 'function') {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetcher(partnerId)
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [partnerId]);

  if (loading || !data) return null;

  const p = data.panels ?? {};
  const rows = (list: any[] | undefined) => list ?? [];

  return (
    <div className="flex flex-col gap-nb-3">
      <Card title="Commerce summary">
        <div className="grid grid-cols-2 gap-nb-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-fg-subtle">Deals</p>
            <p className="text-lg font-semibold text-fg">{p.deals?.count ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Deal value</p>
            <p className="text-lg font-semibold text-fg">{money(p.deals?.value)}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Commission earned</p>
            <p className="text-lg font-semibold text-fg">{money(p.commissions?.earned)}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Commission pending</p>
            <p className="text-lg font-semibold text-fg">{money(p.commissions?.pending)}</p>
          </div>
        </div>
      </Card>

      {can(p.deals?.permissions) && p.deals?.available !== false && (
        <Card title="Deals">
          {rows(p.deals?.recent).length === 0 ? (
            <EmptyState title="No deals yet" description="Deals introduced by this partner will appear here." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(p.deals?.recent).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{d.title || 'Deal'}</span>
                  <span className="text-fg-muted">{d.stage} · {money(d.value)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => navigate(p.deals.deep_link)}>All deals</Button>
        </Card>
      )}

      {can(p.commissions?.permissions) && p.commissions?.available !== false && (
        <Card title="Commissions">
          {rows(p.commissions?.recent).length === 0 ? (
            <EmptyState title="No commissions yet" description="Commission entries appear once deals close." />
          ) : (
            <ul className="flex flex-col gap-nb-2">
              {rows(p.commissions?.recent).map((c: any) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-fg">{c.status || 'pending'}</span>
                  <span className="text-fg-muted">{money(c.commission_amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
