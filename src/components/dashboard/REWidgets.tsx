import React, { useEffect, useState } from 'react';
import { Building2, BarChart3, Clock, PieChart, Trophy } from 'lucide-react';
import { useCRMFormatters } from '../../utils/formatters';
import { useCrmFeatureFlag, RE_FLAGS } from '../../hooks/useCrmFeatureFlag';
import { reWidgetsService, REWidgetsData, isREWidgetsEmpty } from '../../services/reWidgetsService';

const CARD = 'bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5 shadow-sm min-w-0';
const TITLE = 'flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3';
const EMPTY = 'text-xs text-slate-500';
/** Rows shown per card; the dashboard is a glance, not a report. */
const MAX_ROWS = 5;

const Card: React.FC<{ title: string; icon: React.ReactNode; testId: string; className?: string; children: React.ReactNode }> = ({ title, icon, testId, className, children }) => (
    <div className={className ? `${CARD} ${className}` : CARD} data-testid={testId}>
        <p className={TITLE}>{icon}{title}</p>
        {children}
    </div>
);

const REWidgetsInner: React.FC = () => {
    const enabled = useCrmFeatureFlag(RE_FLAGS.RE_WIDGETS);
    const { formatCurrency } = useCRMFormatters();
    const [data, setData] = useState<REWidgetsData | null>(null);

    useEffect(() => {
        if (!enabled) { setData(null); return; }
        let cancelled = false;
        reWidgetsService.get()
            .then((d) => { if (!cancelled) setData(d); })
            .catch(() => { if (!cancelled) setData(null); });
        return () => { cancelled = true; };
    }, [enabled]);

    if (!enabled || !data || isREWidgetsEmpty(data)) return null;

    return (
        <section aria-label="Real estate overview" data-testid="re-widgets" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card title="Inventory by project" icon={<Building2 size={12} />} testId="re-widget-inventory">
                {data.inventory_by_project.length === 0 ? <p className={EMPTY}>No units yet</p> : (
                    <ul className="space-y-1.5">
                        {data.inventory_by_project.slice(0, MAX_ROWS).map((r) => (
                            <li key={r.project} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-slate-200 truncate">{r.project}</span>
                                <span className="text-xs font-bold whitespace-nowrap">
                                    <span className="text-emerald-400" title="Available">{r.available}A</span>{' '}
                                    <span className="text-amber-400" title="Held">{r.held}H</span>{' '}
                                    <span className="text-slate-400" title="Sold">{r.sold}S</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Pipeline by project" icon={<BarChart3 size={12} />} testId="re-widget-pipeline">
                {data.pipeline_by_project.length === 0 ? <p className={EMPTY}>No open deals</p> : (
                    <ul className="space-y-1.5">
                        {data.pipeline_by_project.slice(0, MAX_ROWS).map((r) => (
                            <li key={r.project} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-slate-200 truncate">{r.project}</span>
                                <span className="text-slate-100 font-bold whitespace-nowrap">{formatCurrency(r.value)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Holds expiring in 24h" icon={<Clock size={12} />} testId="re-widget-holds">
                {data.holds_expiring.length === 0 ? <p className={EMPTY}>No holds expiring</p> : (
                    <ul className="space-y-1.5">
                        {data.holds_expiring.slice(0, MAX_ROWS).map((h) => (
                            <li key={h.item_id ?? h.unit_number} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-slate-200 truncate" title={h.project ?? undefined}>{h.unit_number}</span>
                                <span className={`text-xs font-bold whitespace-nowrap ${h.hours_left <= 6 ? 'text-red-400' : 'text-amber-400'}`}>
                                    {h.hours_left < 1 ? '<1h' : `${h.hours_left}h`}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Source performance" icon={<PieChart size={12} />} testId="re-widget-sources">
                {data.source_performance.length === 0 ? <p className={EMPTY}>No leads yet</p> : (
                    <ul className="space-y-1.5">
                        {data.source_performance.slice(0, MAX_ROWS).map((s) => (
                            <li key={s.source} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-slate-200 truncate">{s.source}</span>
                                <span className="text-xs font-bold text-blue-300 whitespace-nowrap" title={`${s.won} won of ${s.leads} leads`}>
                                    {s.rate}%
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Top agents" icon={<Trophy size={12} />} testId="re-widget-agents" className="md:col-span-2 xl:col-span-4">
                {data.agent_leaderboard.length === 0 ? <p className={EMPTY}>No agent activity yet</p> : (
                    <ul className="space-y-1.5">
                        {data.agent_leaderboard.slice(0, MAX_ROWS).map((a, i) => (
                            <li key={a.person_id ?? a.user_id ?? `${a.name}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="text-[10px] font-black text-slate-500 w-4 shrink-0">{i + 1}</span>
                                    <span className="text-slate-200 truncate">{a.name}</span>
                                </span>
                                <span className="flex items-center gap-3 text-xs font-bold whitespace-nowrap">
                                    <span className="text-slate-400" title="Leads">{a.leads} leads</span>
                                    <span className="text-emerald-400" title="Deals won">{a.deals_won} won</span>
                                    <span className="text-blue-300" title="Lead → won conversion">{a.conversion_rate}%</span>
                                    <span className="text-slate-100 text-sm">{formatCurrency(a.won_value)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </section>
    );
};

/**
 * The widgets are an add-on to the CRM dashboard, so nothing they do may take
 * the dashboard down: a render error (e.g. a shell without the bridge) is
 * swallowed and the widgets simply do not show.
 */
class REWidgetsBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() { /* fail-silent: the widgets are optional */ }
    render() { return this.state.failed ? null : this.props.children; }
}

/**
 * Real-estate dashboard widgets (A10), behind submodule:crm:re_widgets.
 * Flag off → renders nothing and makes no request. A failed or empty
 * response also renders nothing.
 */
export const REWidgets: React.FC = () => (
    <REWidgetsBoundary>
        <REWidgetsInner />
    </REWidgetsBoundary>
);

export default REWidgets;
