import { ListPageTemplate, DataTable, Badge, IconButton, type DataTableColumn, Button } from '@so360/design-system';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useSalesFilterConfig, type FilterOption } from './components/SalesFiltersBar';
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

const PAYMENT_TONE: Record<SalePaymentStatus, 'neutral' | 'warning' | 'info' | 'success' | 'danger'> = {
    none: 'neutral',
    pending: 'warning',
    partial: 'info',
    paid: 'success',
    overdue: 'danger',
};

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
    const onFilters = (next: SalesFilters) => {
        setFilters(next);
        setPage(1);
    };
    const { config: filterConfig, rangeError } = useSalesFilterConfig(filters, onFilters, developers);

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

    const pages = Math.max(1, Math.ceil(total / SALES_PAGE_SIZE));
    const money = (v: number | null) => maskedMoney(v, fmt.formatCurrency);

    const columns: DataTableColumn<SaleRow>[] = [
        { key: 'sale_date', header: 'Date', render: (r) => (r.sale_date ? fmt.formatDate(r.sale_date) : '—') },
        { key: 'project_name', header: 'Project', render: (r) => r.project_name || '—' },
        {
            key: 'unit_number',
            header: 'Unit',
            render: (r) => (
                <Link to={`../deal/${r.deal_id}`} className="text-primary hover:underline">
                    {r.unit_number || 'View deal'}
                </Link>
            ),
        },
        { key: 'client_name', header: 'Client', render: (r) => r.client_name || '—' },
        { key: 'developer_name', header: 'Developer', render: (r) => r.developer_name || '—' },
        { key: 'agent_name', header: 'Agent', render: (r) => r.agent_name || '—' },
        { key: 'sale_price', header: 'Price', align: 'right', render: (r) => money(r.sale_price) },
        {
            key: 'payment_status',
            header: 'Payments',
            render: (r) => (
                <span data-testid={`sale-status-${r.deal_id}`}>
                    <Badge size="sm" tone={PAYMENT_TONE[r.payment_status]}>{PAYMENT_STATUS_LABELS[r.payment_status]}</Badge>
                </span>
            ),
        },
        {
            key: 'agent_commission',
            header: 'Agent commission',
            align: 'right',
            render: (r) => <span data-testid={`sale-agent-commission-${r.deal_id}`}>{money(r.agent_commission)}</span>,
        },
        {
            key: 'company_commission',
            header: 'Company commission',
            align: 'right',
            render: (r) => <span data-testid={`sale-company-commission-${r.deal_id}`}>{money(r.company_commission)}</span>,
        },
    ];

    return (
        <ListPageTemplate
            trail={[]}
            title="Sales"
            description="Every unit sale with its payment progress and commission."
            headerSecondaryActions={canExport ? [
                <ExportMenu key="export" label="Export sales" onExport={(format) => exportService.sales(filters, format)} />,
            ] : undefined}
            filterConfig={filterConfig}
            pagination={rangeInvalid || loading || error || rows.length === 0 ? undefined : (
                <>
                    <span className="text-xs text-fg-muted" data-testid="sales-paging">
                        Page {page} of {pages} · {total} {total === 1 ? 'sale' : 'sales'}
                    </span>
                    <div className="flex items-center gap-nb-2">
                        <IconButton label="Previous page" icon={<ChevronLeft size={14} />} variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
                        <IconButton label="Next page" icon={<ChevronRight size={14} />} variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} />
                    </div>
                </>
            )}
        >
            {rangeInvalid ? (
                <div role="alert" className="text-sm text-danger">{rangeError}</div>
            ) : loading ? (
                <div role="status" className="p-8 text-sm text-fg-subtle">Loading sales…</div>
            ) : error ? (
                <div role="alert" className="p-6 bg-danger/10 border border-danger/30 rounded-nb-lg flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-danger">{error}</span>
                    <Button variant="secondary" size="sm" type="button" onClick={() => setReloadKey((k) => k + 1)} >
                        <RefreshCw size={12} /> Retry
                    </Button>
                </div>
            ) : rows.length === 0 ? (
                <div data-testid="sales-empty" className="p-10 text-center bg-surface border border-line rounded-nb-lg text-sm text-fg-subtle">
                    No sales match these filters.
                </div>
            ) : (
                <DataTable
                    name="sales"
                    data-testid="sales-table"
                    columns={columns}
                    rows={rows}
                    rowKey={(r) => r.deal_id}
                    getRowProps={(r) => ({ 'data-testid': `sale-${r.deal_id}` })}
                />
            )}
        </ListPageTemplate>
    );
};

export default SalesPage;
