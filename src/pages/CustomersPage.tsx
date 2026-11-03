import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { Globe, Smartphone, ShoppingCart, UserPlus, Mail, Phone, Calendar, Store, Building2, CreditCard, Shield, CheckCircle2, GitMerge } from 'lucide-react';
import { useShellBridge, useSandboxLimit } from '@so360/shell-context';
import { useCRMFormatters } from '../utils/formatters';
import { crmService } from '../services/crmService';
import { ListPageTemplate, Pagination, DataTable, SearchInput, type DataTableColumn, type FilterValues, type ListFilterConfig, Badge, type BadgeTone } from '@so360/design-system';

type SortField = 'contact_name' | 'email' | 'channel' | 'created_at';
type SortDirection = 'asc' | 'desc' | null;

const CHANNEL_CONFIG: Record<string, { label: string; tone: BadgeTone; icon: any }> = {
    storefront_web: { label: 'Web', tone: 'primary' as BadgeTone, icon: Globe },
    storefront_mobile: { label: 'Mobile', tone: 'primary' as BadgeTone, icon: Smartphone },
    pos: { label: 'POS', tone: 'warning' as BadgeTone, icon: ShoppingCart },
    manual: { label: 'Manual', tone: 'neutral' as BadgeTone, icon: UserPlus },
};

const ACQUISITION_SOURCE_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
    storefront_registration: { label: 'Registration', tone: 'primary' as BadgeTone },
    guest_checkout: { label: 'Guest Checkout', tone: 'info' as BadgeTone },
    pos_inline: { label: 'POS', tone: 'warning' as BadgeTone },
    manual_entry: { label: 'Manual', tone: 'neutral' as BadgeTone },
    lead_promotion: { label: 'Promoted', tone: 'success' as BadgeTone },
};

const CustomersPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const formatters = useCRMFormatters();
    const shell = useShellBridge();
    const { isSandboxMode, sandboxEntryLimit, isLimited } = useSandboxLimit();

    const [customers, setCustomers] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({});
    const [partners, setPartners] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search / channel / category already round-trip through the URL (see the
    // location.search effect below), so history restores them on its own —
    // persisting them here would fight that. Sort and paging have no URL
    // representation, so they are the ones that need remembering.
    const [searchTerm, setSearchTerm] = useState('');
    const [channelFilter, setChannelFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [sortField, setSortField] = usePersistedState<SortField | null>('customers.sortField', 'created_at');
    const [sortDirection, setSortDirection] = usePersistedState<SortDirection>('customers.sortDirection', 'desc');
    const [currentPage, setCurrentPage] = usePersistedState('customers.page', 1);
    const [pageSize, setPageSize] = usePersistedState('customers.pageSize', 10);

    const listAnchorRef = useRef<HTMLDivElement>(null);
    useListScrollRestore('customers', listAnchorRef, !isLoading);
    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

    // Only the customer list depends on the search params. Stats and partners are
    // org-static, so they are fetched once (see the mount effect below) instead of
    // re-firing on every filter/search change.
    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const q = queryParams.get('q') || undefined;
            const channel = queryParams.get('channel') || undefined;
            const category = queryParams.get('category') || undefined;
            const customerIds = (queryParams.get('customer_ids') || '')
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean);

            let customersData: any[] = [];

            customersData = await crmService.getCustomers({
                ...(q ? { q } : {}),
                ...(channel ? { channel } : {}),
                ...(category ? { category } : {}),
                ...(customerIds.length > 0 ? { customer_ids: customerIds } : {}),
            });

            setCustomers(customersData || []);
        } catch (err: any) {
            console.error('Failed to fetch customers', err);
            setError(err.message || 'Failed to load customers');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setSearchTerm(queryParams.get('q') || '');
        setChannelFilter(queryParams.get('channel') || 'All');
        setCategoryFilter(queryParams.get('category') || 'All');
        fetchData();
    }, [location.search]);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            crmService.getCustomerStats().catch(() => ({})),
            crmService.getPartners().catch(() => [] as any[]),
        ]).then(([statsData, partnersData]) => {
            if (cancelled) return;
            setStats(statsData || {});
            setPartners(partnersData || []);
        });
        return () => { cancelled = true; };
    }, []);

    const filteredCustomers = useMemo(() => {
        let result = customers.filter((c) => {
            const matchesSearch =
                !searchTerm ||
                (c.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.phone || '').includes(searchTerm) ||
                (c.company_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesChannel = channelFilter === 'All' || c.channel === channelFilter;
            const matchesCategory = categoryFilter === 'All' || c.customer_category === categoryFilter;
            return matchesSearch && matchesChannel && matchesCategory;
        });

        if (sortField && sortDirection) {
            result = [...result].sort((a, b) => {
                let aVal: any, bVal: any;
                switch (sortField) {
                    case 'contact_name': aVal = a.contact_name || ''; bVal = b.contact_name || ''; break;
                    case 'email': aVal = a.email || ''; bVal = b.email || ''; break;
                    case 'channel': aVal = a.channel || ''; bVal = b.channel || ''; break;
                    case 'created_at': aVal = new Date(a.created_at).getTime(); bVal = new Date(b.created_at).getTime(); break;
                    default: return 0;
                }
                if (typeof aVal === 'string') {
                    return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }

        return result;
    }, [customers, searchTerm, channelFilter, categoryFilter, sortField, sortDirection]);

    const sandboxLimitedCustomers = useMemo(
        () => isSandboxMode ? filteredCustomers.slice(0, sandboxEntryLimit) : filteredCustomers,
        [filteredCustomers, isSandboxMode, sandboxEntryLimit],
    );

    const totalPages = Math.ceil(sandboxLimitedCustomers.length / pageSize);
    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sandboxLimitedCustomers.slice(start, start + pageSize);
    }, [sandboxLimitedCustomers, currentPage, pageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, channelFilter, categoryFilter]);

    const ChannelBadge = ({ channel }: { channel: string }) => {
        const config = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG.manual;
        const Icon = config.icon;
        return (
            <Badge tone={config.tone} size="sm" shape="pill">
                <Icon size={12} />
                {config.label}
            </Badge>
        );
    };

    const CategoryBadge = ({ category }: { category: string }) => {
        if (category === 'b2b') {
            return (
                <Badge tone="success" size="sm"><Building2 size={11} /> B2B</Badge>
            );
        }
        return (
            <Badge tone="neutral" size="sm">B2C</Badge>
        );
    };

    const AcquisitionBadge = ({ source }: { source: string }) => {
        const config = ACQUISITION_SOURCE_CONFIG[source] || { label: source || '-', tone: 'neutral' as BadgeTone };
        return (
            <Badge tone={config.tone} size="sm">{config.label}</Badge>
        );
    };

    const columns: DataTableColumn<any>[] = [
        {
            key: 'contact_name', header: 'Name', sortable: true,
            render: (c: any) => (
                <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-fg">{c.contact_name}</span>
                            <CategoryBadge category={c.customer_category || 'b2c'} />
                        </div>
                        {c.company_name && c.company_name !== c.contact_name && (
                            <span className="text-xs text-fg-muted">{c.company_name}</span>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'email', header: 'Email', sortable: true,
            render: (c: any) => (
                <div className="flex flex-col gap-1 text-fg-subtle">
                    <span className="flex items-center gap-1.5"><Mail size={14} /> {c.email}</span>
                    {c.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {c.phone}</span>}
                </div>
            ),
        },
        ...(categoryFilter !== 'b2c' ? ([
            {
                key: 'tax_id', header: 'Tax ID',
                render: (c: any) =>
                    c.customer_category === 'b2c' ? null :
                    c.tax_id ? (
                        <div className="flex items-center gap-1.5 text-sm">
                            <span className="text-fg-subtle font-mono text-xs">{c.tax_id}</span>
                            {c.tax_id_verified && <CheckCircle2 size={14} className="text-success" />}
                        </div>
                    ) : (
                        <span className="text-fg-muted text-sm">-</span>
                    ),
            },
            {
                key: 'credit_limit', header: 'Credit Limit', align: 'right',
                render: (c: any) => {
                    if (c.customer_category === 'b2c') return null;
                    const limit = parseFloat(c.credit_limit);
                    return limit > 0 ? (
                        <span className="flex items-center gap-1.5 text-fg-subtle text-sm">
                            <CreditCard size={14} />
                            {limit.toLocaleString()}
                        </span>
                    ) : (
                        <span className="text-fg-muted text-sm">-</span>
                    );
                },
            },
        ] as DataTableColumn<any>[]) : []),
        {
            key: 'channel', header: 'Channel', sortable: true,
            render: (c: any) => <ChannelBadge channel={c.channel} />,
        },
        {
            key: 'acquisition_source', header: 'Source',
            render: (c: any) => <AcquisitionBadge source={c.acquisition_source} />,
        },
        {
            key: 'referred_by', header: 'Referred By',
            render: (c: any) => {
                if (!c.referred_by) return <span className="text-fg-muted text-sm">—</span>;
                const partner = partners.find((p: any) => p.id === c.referred_by);
                return (
                    <Badge tone="primary" size="sm">
                        <GitMerge size={11} />
                        {partner?.company_name || c.referred_by}
                    </Badge>
                );
            },
        },
        {
            key: 'created_at', header: 'Joined', sortable: true,
            render: (c: any) => (
                <span className="text-fg-subtle text-sm flex items-center gap-1.5">
                    <Calendar size={14} />
                    {formatters.formatDate(c.created_at)}
                </span>
            ),
        },
    ];

    const filterConfig: ListFilterConfig = {
        fields: [
            { key: 'channel', label: 'Channel', type: 'select', quick: true, options: [
                { value: 'storefront_web', label: 'Web', count: stats.storefront_web || 0 },
                { value: 'storefront_mobile', label: 'Mobile', count: stats.storefront_mobile || 0 },
                { value: 'pos', label: 'POS', count: stats.pos || 0 },
                { value: 'manual', label: 'Manual', count: stats.manual || 0 },
            ] },
            { key: 'category', label: 'Category', type: 'select', quick: true, options: [
                { value: 'b2b', label: 'B2B', count: stats.b2b_count || 0 },
                { value: 'b2c', label: 'B2C', count: stats.b2c_count || 0 },
            ] },
        ],
        values: {
            ...(channelFilter !== 'All' ? { channel: channelFilter } : {}),
            ...(categoryFilter !== 'All' ? { category: categoryFilter } : {}),
        } as FilterValues,
        onChange: (next: FilterValues) => {
            setChannelFilter((next.channel as string) || 'All');
            setCategoryFilter((next.category as string) || 'All');
        },
        onClear: () => {
            setSearchTerm('');
            setChannelFilter('All');
            setCategoryFilter('All');
            navigate('/crm/customers');
        },
    };

    return (
        <ListPageTemplate
            trail={[]}
            title="Customers"
            description="Customers from Storefront, POS, guest checkout, and promoted leads"
            search={
                <SearchInput
                    placeholder="Search customers by name, email, phone..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                />
            }
            filterConfig={filterConfig}
            pagination={sandboxLimitedCustomers.length > 0 ? (
                <Pagination
                    className="w-full"
                    currentPage={currentPage}
                    totalPages={totalPages || 1}
                    totalItems={sandboxLimitedCustomers.length}
                    pageSize={pageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                />
            ) : undefined}
        >
            <div ref={listAnchorRef}>
            {/* Sandbox limit notice */}
            {isSandboxMode && isLimited(filteredCustomers.length) && (
                <div className="mb-4 px-4 py-2.5 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm flex items-center gap-2">
                    <span className="font-semibold">Sandbox mode:</span>
                    showing {sandboxEntryLimit} of {filteredCustomers.length} customers — full list visible in production.
                </div>
            )}

            {/* Table */}
            <DataTable
                name="customers"
                data-testid="customers-table"
                rows={paginatedCustomers}
                rowKey={(c: any) => c.id}
                columns={columns}
                loading={isLoading}
                onRowClick={(customer: any) => navigate(`../customers/${customer.id}`)}
                getRowProps={(c: any) => ({ 'data-testid': `customer-row-${c.id}` })}
                sortKey={sortField ?? undefined}
                sortDir={sortDirection ?? undefined}
                onSortChange={(key: string, dir: 'asc' | 'desc') => { setSortField(key as SortField); setSortDirection(dir); }}
                emptyState={error || 'No customers found. Customers appear here when they register via Storefront, POS, guest checkout, or are promoted from Leads.'}
            />

            </div>
        </ListPageTemplate>
    );
};

export default CustomersPage;
