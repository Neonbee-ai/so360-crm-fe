import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { DashboardPageTemplate, Card } from '@so360/design-system';
import SalesFiltersBar from './components/SalesFiltersBar';
import {
    salesReportService,
    validateDateRange,
    type CommissionBucket,
    type CommissionReport,
    type CommissionTotals,
    type SalesFilters,
} from '../services/salesReportService';
import { useCRMFormatters } from '../utils/formatters';
import { describeApiError } from '../utils/apiErrorMessage';
import ExportMenu, { useCanExport } from '../components/ExportMenu';
import { exportService } from '../services/exportService';

export const TOTAL_CARDS: Array<{ key: keyof CommissionTotals; label: string }> = [
    { key: 'gross', label: 'Gross commission' },
    { key: 'agent', label: 'Agent share' },
    { key: 'company', label: 'Company share' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'payable', label: 'Payable' },
    { key: 'paid', label: 'Paid' },
];

const TH = 'px-4 py-3 text-left text-xs font-semibold text-fg-muted whitespace-nowrap';
const TD = 'px-4 py-3 text-xs font-bold text-fg-subtle whitespace-nowrap';

export const isEmptyReport = (r: CommissionReport): boolean =>
    r.by_project.length === 0 && r.by_agent.length === 0 && r.by_month.length === 0
    && TOTAL_CARDS.every((c) => r.totals[c.key] === 0);

const BucketTable: React.FC<{ title: string; nameHeader: string; rows: CommissionBucket[]; money: (n: number) => string }> = ({ title, nameHeader, rows, money }) => (
    <Card title={title} padding="none">
        {rows.length === 0 ? (
            <p className="px-4 py-6 text-xs text-fg-muted">Nothing to show.</p>
        ) : (
            <div className="overflow-x-auto">
                <table aria-label={title} className="w-full">
                    <thead>
                        <tr>
                            <th className={TH}>{nameHeader}</th>
                            <th className={`${TH} text-right`}>Deals</th>
                            <th className={`${TH} text-right`}>Gross</th>
                            <th className={`${TH} text-right`}>Agent</th>
                            <th className={`${TH} text-right`}>Company</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map((b, i) => (
                            <tr key={b.key || `row-${i}`}>
                                <td className={TD}>{b.label}</td>
                                <td className={`${TD} text-right`}>{b.count ?? '—'}</td>
                                <td className={`${TD} text-right`}>{money(b.gross)}</td>
                                <td className={`${TD} text-right`}>{money(b.agent)}</td>
                                <td className={`${TD} text-right`}>{money(b.company)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </Card>
);

/**
 * Commission report (RE Phase C §28, `submodule:crm:commissions`). The API
 * answers 403 for roles without commission visibility — shown as a plain
 * no-access message, never as a retryable error.
 */
const CommissionReportPage: React.FC = () => {
    const fmt = useCRMFormatters();
    const canExport = useCanExport('deals.export');
    const [filters, setFilters] = useState<SalesFilters>({});
    const [report, setReport] = useState<CommissionReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

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
        salesReportService.commissionReport(filters)
            .then((r) => { if (alive) setReport(r); })
            .catch((e) => {
                if (!alive) return;
                if ((e as { status?: number })?.status === 403) setForbidden(true);
                else setError(describeApiError(e, 'Could not load the commission report.'));
            })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [filters, reloadKey, rangeInvalid]);

    const money = (n: number) => fmt.formatCurrency(n);

    let body: React.ReactNode = null;
    if (rangeInvalid) {
        body = null;
    } else if (loading) {
        body = <div role="status" className="p-8 text-sm text-fg-subtle">Loading commission report…</div>;
    } else if (forbidden) {
        body = (
            <div data-testid="commission-report-forbidden" className="p-10 text-center bg-surface border border-line rounded-nb-lg text-sm text-fg-subtle">
                You don't have access to commission figures. Ask your manager if you need them.
            </div>
        );
    } else if (error) {
        body = (
            <div role="alert" className="p-6 bg-danger/10 border border-danger/30 rounded-nb-lg flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-danger">{error}</span>
                <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="flex items-center gap-1 px-3 py-2 rounded-nb text-xs font-semibold text-fg bg-surface-raised hover:bg-line">
                    <RefreshCw size={12} /> Retry
                </button>
            </div>
        );
    } else if (report && isEmptyReport(report)) {
        body = (
            <div data-testid="commission-report-empty" className="p-10 text-center bg-surface border border-line rounded-nb-lg text-sm text-fg-subtle">
                No commission recorded for these filters.
            </div>
        );
    } else if (report) {
        body = (
            <>
                <div className="grid grid-cols-2 wc-medium:grid-cols-4 lg:grid-cols-7 gap-nb-3">
                    {TOTAL_CARDS.map((c) => (
                        <Card key={c.key}>
                            <p className="text-xs text-fg-muted">{c.label}</p>
                            <p className="mt-1 text-lg font-semibold text-fg" data-testid={`cr-total-${c.key}`}>{money(report.totals[c.key])}</p>
                        </Card>
                    ))}
                </div>
                <BucketTable title="By project" nameHeader="Project" rows={report.by_project} money={money} />
                <BucketTable title="By agent" nameHeader="Agent" rows={report.by_agent} money={money} />
                <BucketTable title="By month" nameHeader="Month" rows={report.by_month} money={money} />
            </>
        );
    }

    return (
        <DashboardPageTemplate
            title="Commission report"
            description="Commission earned across projects, agents and months."
            /* The report carries no developer list, so the developer filter is not offered here. */
            filters={<SalesFiltersBar value={filters} onChange={setFilters} developers={[]} />}
            secondaryActions={canExport && !forbidden ? (
                <ExportMenu label="Export commission report" onExport={(format) => exportService.commission(filters, format)} />
            ) : undefined}
        >
            <div className="flex flex-col gap-nb-4">{body}</div>
        </DashboardPageTemplate>
    );
};

export default CommissionReportPage;
