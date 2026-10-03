import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
    CAMPAIGN_STATUSES,
    CAMPAIGN_STATUS_LABELS,
    crmCampaignService,
    sumRoi,
    type CampaignRoiRow,
    type CampaignStatus,
} from '../services/crmCampaignService';
import { useCRMFormatters } from '../utils/formatters';
import { describeApiError } from '../utils/apiErrorMessage';

const TH = 'px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap';
const TD = 'px-4 py-3 text-xs font-bold text-slate-300 whitespace-nowrap';

/** Ratio → "12.5%"; null (nothing spent / no leads) → "—". */
export const formatRatio = (v: number | null): string =>
    v === null ? '—' : `${(v * 100).toFixed(1)}%`;

/**
 * Campaign ROI report (RE Phase D §25, `submodule:crm:campaign_roi`).
 * Leads, qualified, won deals, revenue, spend, cost per lead and ROI per
 * CRM campaign. Pattern follows CommissionReportPage.
 */
const CampaignRoiReportPage: React.FC = () => {
    const fmt = useCRMFormatters();
    const [status, setStatus] = useState<CampaignStatus | ''>('');
    const [rows, setRows] = useState<CampaignRoiRow[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);
        setForbidden(false);
        crmCampaignService.roiReport(status)
            .then((r) => { if (alive) setRows(r); })
            .catch((e) => {
                if (!alive) return;
                if ((e as { status?: number })?.status === 403) setForbidden(true);
                else setError(describeApiError(e, 'Could not load the campaign ROI report.'));
            })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [status, reloadKey]);

    const money = (n: number | null) => (n === null ? '—' : fmt.formatCurrency(n));

    let body: React.ReactNode = null;
    if (loading) {
        body = <div role="status" className="p-8 text-sm text-slate-400">Loading campaign ROI…</div>;
    } else if (forbidden) {
        body = (
            <div data-testid="campaign-roi-forbidden" className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-400">
                You don't have access to campaign ROI. Ask your manager if you need it.
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
    } else if (rows && rows.length === 0) {
        body = (
            <div data-testid="campaign-roi-empty" className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-400">
                No campaigns yet. Create a campaign and tag leads with its UTM campaign to see ROI here.
            </div>
        );
    } else if (rows) {
        const t = sumRoi(rows);
        const cards: Array<{ key: string; label: string; value: string }> = [
            { key: 'leads', label: 'Leads', value: String(t.leads) },
            { key: 'qualified', label: 'Qualified', value: String(t.qualified) },
            { key: 'deals_won', label: 'Deals won', value: String(t.deals_won) },
            { key: 'revenue', label: 'Revenue', value: money(t.revenue) },
            { key: 'spend', label: 'Spend', value: money(t.spend) },
            { key: 'cpl', label: 'Cost per lead', value: money(t.cpl) },
            { key: 'roi', label: 'ROI', value: formatRatio(t.roi) },
        ];
        body = (
            <>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                    {cards.map((c) => (
                        <div key={c.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{c.label}</p>
                            <p className="mt-1 text-lg font-black text-slate-50" data-testid={`roi-total-${c.key}`}>{c.value}</p>
                        </div>
                    ))}
                </div>
                <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table aria-label="Campaign ROI" className="w-full">
                            <thead>
                                <tr>
                                    <th className={TH}>Campaign</th>
                                    <th className={TH}>Channel</th>
                                    <th className={TH}>Status</th>
                                    <th className={`${TH} text-right`}>Leads</th>
                                    <th className={`${TH} text-right`}>Qualified</th>
                                    <th className={`${TH} text-right`}>Won</th>
                                    <th className={`${TH} text-right`}>Conversion</th>
                                    <th className={`${TH} text-right`}>Revenue</th>
                                    <th className={`${TH} text-right`}>Spend</th>
                                    <th className={`${TH} text-right`}>CPL</th>
                                    <th className={`${TH} text-right`}>ROI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {rows.map(({ campaign: c, roi: r }) => (
                                    <tr key={c.id} data-testid="campaign-roi-row">
                                        <td className={TD}>
                                            <div>{c.name}</div>
                                            {c.utm_campaign && <div className="text-[10px] font-medium text-slate-500">utm: {c.utm_campaign}</div>}
                                        </td>
                                        <td className={TD}>{c.channel ?? '—'}</td>
                                        <td className={TD}>{CAMPAIGN_STATUS_LABELS[c.status]}</td>
                                        <td className={`${TD} text-right`}>{r.leads}</td>
                                        <td className={`${TD} text-right`}>{r.qualified}</td>
                                        <td className={`${TD} text-right`}>{r.deals_won}</td>
                                        <td className={`${TD} text-right`}>{formatRatio(r.conversion_rate)}</td>
                                        <td className={`${TD} text-right`}>{money(r.revenue)}</td>
                                        <td className={`${TD} text-right`}>{money(r.spend)}</td>
                                        <td className={`${TD} text-right`}>{money(r.cpl)}</td>
                                        <td className={`${TD} text-right ${r.roi !== null && r.roi < 0 ? 'text-rose-400' : ''}`}>{formatRatio(r.roi)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-50">Campaign ROI</h1>
                    <p className="text-sm text-slate-400">Leads, won deals and return on spend for each campaign.</p>
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Status
                    <select
                        aria-label="Campaign status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as CampaignStatus | '')}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 normal-case tracking-normal"
                    >
                        <option value="">All statuses</option>
                        {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>)}
                    </select>
                </label>
            </div>
            {body}
        </div>
    );
};

export default CampaignRoiReportPage;
