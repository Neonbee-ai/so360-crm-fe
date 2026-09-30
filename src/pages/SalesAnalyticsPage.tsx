import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import SalesFiltersBar, { type FilterOption } from './components/SalesFiltersBar';
import ExportMenu, { useCanExport } from '../components/ExportMenu';
import { validateDateRange, type SalesFilters } from '../services/salesReportService';
import {
    REPORT_PERIODS,
    salesAnalyticsService,
    type AnalyticsSection,
    type ReportPeriod,
    type SalesAnalytics,
} from '../services/salesAnalyticsService';
import { useCRMFormatters } from '../utils/formatters';
import { describeApiError } from '../utils/apiErrorMessage';

const TH = 'px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap';
const TD = 'px-4 py-3 text-xs font-bold text-slate-300 whitespace-nowrap';

const PERIOD_LABELS: Record<ReportPeriod, string> = { month: 'Monthly', quarter: 'Quarterly', year: 'Yearly' };

type Cell = { value: React.ReactNode; numeric?: boolean };
interface SectionView {
    section: AnalyticsSection;
    title: string;
    header: Array<{ label: string; numeric?: boolean }>;
    rows: Array<{ key: string; cells: Cell[] }>;
}

export const isEmptyAnalytics = (a: SalesAnalytics): boolean =>
    a.totals.bookings === 0 && a.totals.leads === 0 && a.totals.lost_deals === 0
    && a.reservations.total === 0 && a.by_source.length === 0 && a.agent_performance.length === 0;

/** Pure view model: one table per exportable section. */
export function buildSections(a: SalesAnalytics, money: (n: number) => string): SectionView[] {
    const sales = (section: AnalyticsSection, title: string, keyHeader: string, rows: SalesAnalytics['by_agent']): SectionView => ({
        section,
        title,
        header: [{ label: keyHeader }, { label: 'Bookings', numeric: true }, { label: 'Sale value', numeric: true }],
        rows: rows.map((b, i) => ({
            key: b.key || `${section}-${i}`,
            cells: [{ value: b.label }, { value: b.deals, numeric: true }, { value: money(b.sale_value), numeric: true }],
        })),
    });
    return [
        sales('by_agent', 'Sales by agent', 'Agent', a.by_agent),
        sales('by_project', 'Sales by project', 'Project', a.by_project),
        sales('by_developer', 'Sales by developer', 'Developer', a.by_developer),
        sales('by_period', `Sales by ${a.period}`, 'Period', a.by_period),
        {
            section: 'by_source',
            title: 'Leads & sales by source and campaign',
            header: [
                { label: 'Source' }, { label: 'Campaign' }, { label: 'Leads', numeric: true },
                { label: 'Converted', numeric: true }, { label: 'Won deals', numeric: true }, { label: 'Won value', numeric: true },
            ],
            rows: a.by_source.map((s, i) => ({
                key: `${s.source}-${s.campaign}-${i}`,
                cells: [
                    { value: s.source }, { value: s.campaign }, { value: s.leads, numeric: true },
                    { value: s.converted, numeric: true }, { value: s.won_deals, numeric: true }, { value: money(s.won_value), numeric: true },
                ],
            })),
        },
        {
            section: 'lost_reasons',
            title: 'Lost deals by reason',
            header: [{ label: 'Reason' }, { label: 'Deals lost', numeric: true }, { label: 'Lost value', numeric: true }],
            rows: a.lost_reasons.map((l, i) => ({
                key: l.key || `lost-${i}`,
                cells: [{ value: l.label }, { value: l.count, numeric: true }, { value: money(l.lost_value), numeric: true }],
            })),
        },
        {
            section: 'reservations',
            title: 'Reservations',
            header: [{ label: 'Status' }, { label: 'Reservations', numeric: true }],
            rows: ([
                ['active', 'Active', a.reservations.active],
                ['committed', 'Committed (booked)', a.reservations.committed],
                ['released', 'Released', a.reservations.released],
                ['total', 'Total', a.reservations.total],
            ] as const).map(([key, label, n]) => ({ key, cells: [{ value: label }, { value: n, numeric: true }] })),
        },
        {
            section: 'agent_performance',
            title: 'Agent performance',
            header: [
                { label: 'Agent' }, { label: 'Leads', numeric: true }, { label: 'Calls', numeric: true },
                { label: 'Converted', numeric: true }, { label: 'Deals won', numeric: true },
                { label: 'Won value', numeric: true }, { label: 'Conversion %', numeric: true },
            ],
            rows: a.agent_performance.map((p, i) => ({
                key: p.key || `agent-${i}`,
                cells: [
                    { value: p.name }, { value: p.leads, numeric: true }, { value: p.calls, numeric: true },
                    { value: p.converted, numeric: true }, { value: p.deals_won, numeric: true },
                    { value: money(p.won_value), numeric: true }, { value: `${p.conversion_rate}%`, numeric: true },
                ],
            })),
        },
    ];
}

/**
 * RE §30 sales reports (`submodule:crm:re_reports`): bookings by agent,
 * project, developer and period, leads by source/campaign, lost reasons,
 * reservations and agent performance. Every section exports to CSV / Excel /
 * PDF for users holding `deals.export`; the server applies the same record
 * scope as the screen.
 */
const SalesAnalyticsPage: React.FC = () => {
    const fmt = useCRMFormatters();
    const canExport = useCanExport('deals.export');
    const [filters, setFilters] = useState<SalesFilters>({});
    const [period, setPeriod] = useState<ReportPeriod>('month');
    const [data, setData] = useState<SalesAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [developers, setDevelopers] = useState<FilterOption[]>([]);

    const rangeInvalid = validateDateRange(filters) !== null;

    useEffect(() => {
        if (rangeInvalid) {
            setLoading(false);
            return;
        }
        let alive = true;
        setLoading(true);
        setError(null);
        setForbidden(false);
        salesAnalyticsService.get(filters, period)
            .then((r) => {
                if (!alive) return;
                setData(r);
                // No developer list API: remember every developer seen.
                setDevelopers((prev) => {
                    const seen = new Map(prev.map((d) => [d.id, d]));
                    for (const d of r.by_developer) if (d.key && !seen.has(d.key)) seen.set(d.key, { id: d.key, name: d.label });
                    return seen.size === prev.length ? prev : Array.from(seen.values());
                });
            })
            .catch((e) => {
                if (!alive) return;
                if ((e as { status?: number })?.status === 403) setForbidden(true);
                else setError(describeApiError(e, 'Could not load the sales reports.'));
            })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [filters, period, reloadKey, rangeInvalid]);

    const money = (n: number) => fmt.formatCurrency(n);
    const sections = useMemo(() => (data ? buildSections(data, money) : []), [data, fmt]); // eslint-disable-line react-hooks/exhaustive-deps

    let body: React.ReactNode = null;
    if (rangeInvalid) {
        body = null;
    } else if (loading) {
        body = <div role="status" className="p-8 text-sm text-slate-400">Loading sales reports…</div>;
    } else if (forbidden) {
        body = (
            <div data-testid="sales-analytics-forbidden" className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-400">
                You don't have access to sales reports. Ask your manager if you need them.
            </div>
        );
    } else if (error) {
        body = (
            <div role="alert" className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-rose-300">{error}</span>
                <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-200 bg-slate-800 hover:bg-slate-700">
                    <RefreshCw size={12} /> Retry
                </button>
            </div>
        );
    } else if (data && isEmptyAnalytics(data)) {
        body = (
            <div data-testid="sales-analytics-empty" className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-400">
                No sales activity for these filters.
            </div>
        );
    } else if (data) {
        const t = data.totals;
        const cards: Array<{ key: string; label: string; value: string }> = [
            { key: 'bookings', label: 'Bookings', value: String(t.bookings) },
            { key: 'booking_value', label: 'Booking value', value: money(t.booking_value) },
            { key: 'avg_deal_value', label: 'Avg deal value', value: money(t.avg_deal_value) },
            { key: 'leads', label: 'Leads', value: String(t.leads) },
            { key: 'converted_leads', label: 'Converted leads', value: String(t.converted_leads) },
            { key: 'lost_deals', label: 'Lost deals', value: String(t.lost_deals) },
            { key: 'lost_value', label: 'Lost value', value: money(t.lost_value) },
        ];
        body = (
            <>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                    {cards.map((c) => (
                        <div key={c.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{c.label}</p>
                            <p className="mt-1 text-lg font-black text-slate-50" data-testid={`sa-total-${c.key}`}>{c.value}</p>
                        </div>
                    ))}
                </div>
                {sections.map((s) => (
                    <section key={s.section} data-testid={`sa-section-${s.section}`} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">{s.title}</h2>
                            {canExport ? (
                                <ExportMenu
                                    label={`Export ${s.title}`}
                                    onExport={(format) => salesAnalyticsService.exportSection(filters, period, s.section, format)}
                                />
                            ) : null}
                        </div>
                        {s.rows.length === 0 ? (
                            <p className="px-4 py-6 text-xs text-slate-500">Nothing to show.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table aria-label={s.title} className="w-full">
                                    <thead>
                                        <tr>
                                            {s.header.map((h) => (
                                                <th key={h.label} className={`${TH}${h.numeric ? ' text-right' : ''}`}>{h.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {s.rows.map((r) => (
                                            <tr key={r.key}>
                                                {r.cells.map((c, i) => (
                                                    <td key={i} className={`${TD}${c.numeric ? ' text-right' : ''}`}>{c.value}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                ))}
            </>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-slate-50">Sales reports</h1>
                    <p className="text-sm text-slate-400">Bookings, lead sources, lost reasons, reservations and agent performance.</p>
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Period
                    <select
                        aria-label="Report period"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
                        className="bg-slate-950 border border-slate-800 text-slate-50 rounded-xl px-3 py-2 outline-none focus:border-blue-500 font-bold text-xs"
                    >
                        {REPORT_PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
                    </select>
                </label>
            </div>
            <SalesFiltersBar value={filters} onChange={setFilters} developers={developers} />
            {body}
        </div>
    );
};

export default SalesAnalyticsPage;
