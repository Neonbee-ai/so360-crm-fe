import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import SalesFiltersBar, { type FilterOption } from './components/SalesFiltersBar';
import {
    salesReportService,
    validateDateRange,
    PAYMENT_STATUS_LABELS,
    type SaleRow,
    type SalePaymentStatus,
    type SalesFilters,
} from '../services/salesReportService';
import { maskedMoney } from '../services/commissionsService';
import { useCRMFormatters } from '../utils/formatters';
import { describeApiError } from '../utils/apiErrorMessage';
import ExportMenu, { useCanExport } from '../components/ExportMenu';
import { exportService } from '../services/exportService';

export const SALES_PAGE_SIZE = 25;

const PAYMENT_CHIP: Record<SalePaymentStatus, string> = {
    none: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    partial: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    overdue: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

const TH = 'px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap';
const TD = 'px-4 py-3 text-xs font-bold text-slate-300 whitespace-nowrap';

/**
 * Sales register (RE Phase C §27, `submodule:crm:commissions`). One row per
 * booked unit sale. Commission columns arrive as null for roles without
 * commission visibility and render "—".
 */
const SalesPage: React.FC = () => {
    const fmt = useCRMFormatters();
    const canExport = useCanExport('deals.export');
    const [filters, setFilters] = useState<SalesFilters>({});
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<SaleRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    // Developers have no list API: remember every one seen so a developer
    // filter does not shrink its own option list to one entry.
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
        salesReportService.listSales(filters, page, SALES_PAGE_SIZE)
            .then((res) => {
                if (!alive) return;
                setRows(res.rows);
                setTotal(res.total);
                setDevelopers((prev) => {
                    const seen = new Map(prev.map((d) => [d.id, d]));
                    let changed = false;
                    res.rows.forEach((r) => {
                        if (r.developer_id && !seen.has(r.developer_id)) {
                            seen.set(r.developer_id, { id: r.developer_id, name: r.developer_name || r.developer_id });
                            changed = true;
                        }
                    });
                    return changed ? Array.from(seen.values()) : prev;
                });
            })
            .catch((e) => { if (alive) setError(describeApiError(e, 'Could not load sales.')); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [filters, page, reloadKey, rangeInvalid]);

    const onFilters = (next: SalesFilters) => {
        setFilters(next);
        setPage(1);
    };

    const pages = Math.max(1, Math.ceil(total / SALES_PAGE_SIZE));
    const money = (v: number | null) => maskedMoney(v, fmt.formatCurrency);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-slate-50">Sales</h1>
                    <p className="text-sm text-slate-400">Every unit sale with its payment progress and commission.</p>
                </div>
                {canExport ? (
                    <ExportMenu label="Export sales" onExport={(format) => exportService.sales(filters, format)} />
                ) : null}
            </div>

            <SalesFiltersBar value={filters} onChange={onFilters} developers={developers} />

            {rangeInvalid ? null : loading ? (
                <div role="status" className="p-8 text-sm text-slate-400">Loading sales…</div>
            ) : error ? (
                <div role="alert" className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-rose-300">{error}</span>
                    <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-200 bg-slate-800 hover:bg-slate-700">
                        <RefreshCw size={12} /> Retry
                    </button>
                </div>
            ) : rows.length === 0 ? (
                <div data-testid="sales-empty" className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-400">
                    No sales match these filters.
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table aria-label="Sales" className="w-full">
                            <thead className="border-b border-slate-800">
                                <tr>
                                    <th className={TH}>Date</th>
                                    <th className={TH}>Project</th>
                                    <th className={TH}>Unit</th>
                                    <th className={TH}>Client</th>
                                    <th className={TH}>Developer</th>
                                    <th className={TH}>Agent</th>
                                    <th className={`${TH} text-right`}>Price</th>
                                    <th className={TH}>Payments</th>
                                    <th className={`${TH} text-right`}>Agent commission</th>
                                    <th className={`${TH} text-right`}>Company commission</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {rows.map((r) => (
                                    <tr key={r.deal_id} data-testid={`sale-${r.deal_id}`} className="hover:bg-slate-800/40">
                                        <td className={TD}>{r.sale_date ? fmt.formatDate(r.sale_date) : '—'}</td>
                                        <td className={TD}>{r.project_name || '—'}</td>
                                        <td className={TD}>
                                            <Link to={`../deal/${r.deal_id}`} className="text-blue-400 hover:underline">
                                                {r.unit_number || 'View deal'}
                                            </Link>
                                        </td>
                                        <td className={TD}>{r.client_name || '—'}</td>
                                        <td className={TD}>{r.developer_name || '—'}</td>
                                        <td className={TD}>{r.agent_name || '—'}</td>
                                        <td className={`${TD} text-right`}>{money(r.sale_price)}</td>
                                        <td className={TD}>
                                            <span data-testid={`sale-status-${r.deal_id}`} className={`px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${PAYMENT_CHIP[r.payment_status]}`}>
                                                {PAYMENT_STATUS_LABELS[r.payment_status]}
                                            </span>
                                        </td>
                                        <td className={`${TD} text-right`} data-testid={`sale-agent-commission-${r.deal_id}`}>{money(r.agent_commission)}</td>
                                        <td className={`${TD} text-right`} data-testid={`sale-company-commission-${r.deal_id}`}>{money(r.company_commission)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-800">
                        <span className="text-xs font-bold text-slate-400" data-testid="sales-paging">
                            Page {page} of {pages} · {total} {total === 1 ? 'sale' : 'sales'}
                        </span>
                        <div className="flex items-center gap-2">
                            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded-xl bg-slate-800 text-slate-300 disabled:opacity-40">
                                <ChevronLeft size={14} />
                            </button>
                            <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-xl bg-slate-800 text-slate-300 disabled:opacity-40">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesPage;
