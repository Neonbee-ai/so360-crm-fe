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
import { Button, DataTable, Select } from '@so360/design-system';
import type { DataTableColumn } from '@so360/design-system';

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

    const num = (render: (r: CampaignRoiRow) => React.ReactNode, key: string, header: string): DataTableColumn<CampaignRoiRow> =>
        ({ key, header, align: 'right', render: (r) => <span className="text-fg-subtle">{render(r)}</span> });
    const columns: DataTableColumn<CampaignRoiRow>[] = [
        { key: 'campaign', header: 'Campaign', render: ({ campaign: c }) => (
            <div className="text-fg">
                <div>{c.name}</div>
                {c.utm_campaign && <div className="text-xs text-fg-muted">utm: {c.utm_campaign}</div>}
            </div>
        ) },
        { key: 'channel', header: 'Channel', render: ({ campaign: c }) => <span className="text-fg-subtle">{c.channel ?? '—'}</span> },
        { key: 'status', header: 'Status', render: ({ campaign: c }) => <span className="text-fg-subtle">{CAMPAIGN_STATUS_LABELS[c.status]}</span> },
        num((r) => r.roi.leads, 'leads', 'Leads'),
        num((r) => r.roi.qualified, 'qualified', 'Qualified'),
        num((r) => r.roi.deals_won, 'won', 'Won'),
        num((r) => formatRatio(r.roi.conversion_rate), 'conversion', 'Conversion'),
        num((r) => money(r.roi.revenue), 'revenue', 'Revenue'),
        num((r) => money(r.roi.spend), 'spend', 'Spend'),
        num((r) => money(r.roi.cpl), 'cpl', 'CPL'),
        { key: 'roi', header: 'ROI', align: 'right', render: ({ roi: r }) => (
            <span className={r.roi !== null && r.roi < 0 ? 'text-danger' : 'text-fg-subtle'}>{formatRatio(r.roi)}</span>
        ) },
    ];

    let body: React.ReactNode = null;
    if (loading) {
        body = <div role="status" className="p-nb-6 text-sm text-fg-subtle">Loading campaign ROI…</div>;
    } else if (forbidden) {
        body = (
            <div data-testid="campaign-roi-forbidden" className="p-10 text-center bg-surface border border-line rounded-nb-lg text-sm text-fg-subtle">
                You don't have access to campaign ROI. Ask your manager if you need it.
            </div>
        );
    } else if (error) {
        body = (
            <div role="alert" className="p-nb-4 bg-surface border border-danger rounded-nb-lg flex items-center justify-between gap-nb-3">
                <span className="text-sm font-semibold text-danger">{error}</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                    <RefreshCw size={12} /> Retry
                </Button>
            </div>
        );
    } else if (rows && rows.length === 0) {
        body = (
            <div data-testid="campaign-roi-empty" className="p-10 text-center bg-surface border border-line rounded-nb-lg text-sm text-fg-subtle">
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
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-nb-3">
                    {cards.map((c) => (
                        <div key={c.key} className="bg-surface border border-line rounded-nb-lg p-nb-4">
                            <p className="text-xs font-semibold uppercase text-fg-muted">{c.label}</p>
                            <p className="mt-1 text-lg font-semibold text-fg" data-testid={`roi-total-${c.key}`}>{c.value}</p>
                        </div>
                    ))}
                </div>
                <DataTable
                    columns={columns}
                    rows={rows}
                    rowKey={(r: CampaignRoiRow) => r.campaign.id}
                    getRowProps={() => ({ 'data-testid': 'campaign-roi-row' })}
                />
            </>
        );
    }

    return (
        <div className="p-nb-6 space-y-nb-6">
            <div className="flex flex-wrap items-end justify-between gap-nb-3">
                <div>
                    <h1 className="text-2xl font-semibold text-fg">Campaign ROI</h1>
                    <p className="text-sm text-fg-subtle">Leads, won deals and return on spend for each campaign.</p>
                </div>
                <Select
                    name="campaign_status"
                    label="Status"
                    aria-label="Campaign status"
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value as CampaignStatus | '')}
                    options={[
                        { value: '', label: 'All statuses' },
                        ...CAMPAIGN_STATUSES.map((st) => ({ value: st, label: CAMPAIGN_STATUS_LABELS[st] })),
                    ]}
                />
            </div>
            {body}
        </div>
    );
};

export default CampaignRoiReportPage;
