import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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

export const TOTAL_CARDS: Array<{ key: keyof CommissionTotals; label: string }> = [
    { key: 'gross', label: 'Gross commission' },
    { key: 'agent', label: 'Agent share' },
    { key: 'company', label: 'Company share' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'payable', label: 'Payable' },
    { key: 'paid', label: 'Paid' },
];

const TH = 'px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap';
const TD = 'px-4 py-3 text-xs font-bold text-slate-300 whitespace-nowrap';

export const isEmptyReport = (r: CommissionReport): boolean =>
    r.by_project.length === 0 && r.by_agent.length === 0 && r.by_month.length === 0
    && TOTAL_CARDS.every((c) => r.totals[c.key] === 0);

const BucketTable: React.FC<{ title: string; nameHeader: string; rows: CommissionBucket[]; money: (n: number) => string }> = ({ title, nameHeader, rows, money }) => (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <h2 className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800">{title}</h2>
        {rows.length === 0 ? (
            <p className="px-4 py-6 text-xs text-slate-500">Nothing to show.</p>
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
                    <tbody className="divide-y divide-slate-800">
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
    </section>
);

/**
 * Commission report (RE Phase C §28, `submodule:crm:commissions`). The API
 * answers 403 for roles without commission visibility — shown as a plain
 * no-access message, never as a retryable error.
 */
const CommissionReportPage: React.FC = () => {
    const fmt = useCRMFormatters();
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
        body = <div role="status" className="p-8 text-sm text-slate-400">Loading commission report…</div>;
    } else if (forbidden) {
        body = (
            <div data-testid="commission-report-forbidden" className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-400">
                You don't have access to commission figures. Ask your manager if you need them.
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
    } else if (report && isEmptyReport(report)) {
        body = (
            <div data-testid="commission-report-empty" className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-400">
                No commission recorded for these filters.
            </div>
        );
    } else if (report) {
        body = (
            <>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                    {TOTAL_CARDS.map((c) => (
                        <div key={c.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{c.label}</p>
                            <p className="mt-1 text-lg font-black text-slate-50" data-testid={`cr-total-${c.key}`}>{money(report.totals[c.key])}</p>
                        </div>
                    ))}
                </div>
                <BucketTable title="By project" nameHeader="Project" rows={report.by_project} money={money} />
                <BucketTable title="By agent" nameHeader="Agent" rows={report.by_agent} money={money} />
                <BucketTable title="By month" nameHeader="Month" rows={report.by_month} money={money} />
            </>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-black text-slate-50">Commission report</h1>
                <p className="text-sm text-slate-400">Commission earned across projects, agents and months.</p>
            </div>
            {/* The report carries no developer list, so the developer filter is not offered here. */}
            <SalesFiltersBar value={filters} onChange={setFilters} developers={[]} />
            {body}
        </div>
    );
};

export default CommissionReportPage;
