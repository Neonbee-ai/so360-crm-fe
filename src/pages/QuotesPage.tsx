import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Plus, FileText, Search, CheckCircle, XCircle, Clock, ChevronDown, Eye, User, Check, X,
    Download, Copy, RotateCcw, AlertCircle, RefreshCw,
    Building2, CheckSquare, Square
} from 'lucide-react';
import { crmService } from '../services/crmService';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { Quote, QuoteStatus, Deal } from '../types/crm';
import { useBusinessSettings, useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import { QuotaGate, CrossLinkChip, SegmentedControl, toast, ListPageTemplate, Button, Pagination, DataTable, SearchInput, Menu, TextField, Textarea, type DataTableColumn, type FilterValues, type ListFilterConfig } from '@so360/design-system';
import { quotesToCsv, downloadCsv } from '../components/quotes/quotesCsv';
import { quoteToDocumentData } from '../utils/quoteToDocumentData';
import ExportMenu from '../components/ExportMenu';
import { CrmScope } from '../utils/crmScope';
import { Modal } from '../components/common/Modal';

export const statusColors: Record<QuoteStatus, { bg: string; text: string; label: string; border: string }> = {
    draft: { bg: 'bg-fg-muted/10', text: 'text-fg-subtle', label: 'Draft', border: 'border-line' },
    pending_approval: { bg: 'bg-warning/10', text: 'text-warning', label: 'Pending Approval', border: 'border-warning/30' },
    approved: { bg: 'bg-success/10', text: 'text-success', label: 'Approved', border: 'border-success/30' },
    rejected: { bg: 'bg-danger/10', text: 'text-danger', label: 'Rejected', border: 'border-danger/30' },
    converted: { bg: 'bg-primary/10', text: 'text-primary', label: 'Converted', border: 'border-primary/30' },
    expired: { bg: 'bg-fg-muted/10', text: 'text-fg-subtle', label: 'Expired', border: 'border-line' },
};

// Allowed next transitions per status — empty means terminal (no dropdown)
const STATUS_TRANSITIONS: Partial<Record<QuoteStatus, Array<{ action: 'submit' | 'approve' | 'reject' | 'convert'; label: string; color: string }>>> = {
    draft:            [{ action: 'submit',  label: 'Submit for Approval', color: 'text-warning hover:bg-warning/20' }],
    pending_approval: [
        { action: 'approve', label: 'Approve',  color: 'text-success hover:bg-success/20' },
        { action: 'reject',  label: 'Reject',   color: 'text-danger   hover:bg-danger/20'   },
    ],
    approved: [{ action: 'convert', label: 'Convert to Order', color: 'text-primary hover:bg-primary/20' }],
};

interface QuoteStatusCellProps {
    quote: Quote;
    isActionLoading: boolean;
    onAction: (quote: Quote, action: 'submit' | 'approve' | 'reject' | 'convert') => void;
}

export const QuoteStatusCell: React.FC<QuoteStatusCellProps> = ({ quote, isActionLoading, onAction }) => {
    const transitions = STATUS_TRANSITIONS[quote.status] ?? [];
    const status = statusColors[quote.status] || statusColors.draft;

    const badge = (
        <button
            type="button"
            disabled={isActionLoading}
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${status.bg} ${status.text} ${status.border} ${transitions.length > 0 ? 'cursor-pointer hover:brightness-125' : 'cursor-default'} disabled:opacity-50`}
            title={transitions.length > 0 ? 'Click to update status' : status.label}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${quote.status === 'approved' ? 'bg-success' : quote.status === 'pending_approval' ? 'bg-warning' : quote.status === 'rejected' ? 'bg-danger' : quote.status === 'converted' ? 'bg-primary' : 'bg-fg-subtle'}`} />
            <span>{status.label}</span>
            {transitions.length > 0 && <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />}
        </button>
    );

    return (
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
            {transitions.length > 0 ? (
                <Menu
                    name={`quote-status-${quote.id}`}
                    trigger={badge}
                    items={transitions.map((t) => ({
                        label: t.label,
                        danger: t.action === 'reject',
                        onSelect: () => onAction(quote, t.action),
                    }))}
                />
            ) : badge}
        </div>
    );
};

type SortField = 'quote_number' | 'title' | 'customer' | 'deal' | 'total' | 'status' | 'valid_until' | 'created_at';
type SortDirection = 'asc' | 'desc';

const QuotesPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const openQuote = (quoteId: string) =>
        navigate(`/crm/quotes/${quoteId}`, { state: { from: `${location.pathname}${location.search}` } });

    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateQuote = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('quotes.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:quotes:create') ?? true);
    const quotaChecks = useMemo(() => [{ module_code: 'crm', quota_key: 'max_quotes' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_quotes');
    const { isSandboxMode, sandboxEntryLimit, isLimited } = useSandboxLimit();

    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });

    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = usePersistedState('quotes.search', '');
    const [statusFilter, setStatusFilter] = usePersistedState<string>('quotes.status', 'All');
    const [dealFilter, setDealFilter] = usePersistedState<string>('quotes.deal', 'All');
    const [validityFilter, setValidityFilter] = usePersistedState<string>('quotes.validity', 'All');

    // Sorting & Selection & Pagination states
    const [sortField, setSortField] = usePersistedState<SortField | null>('quotes.sortField', null);
    const [sortDirection, setSortDirection] = usePersistedState<SortDirection>('quotes.sortDir', 'asc');
    const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = usePersistedState('quotes.page', 1);
    const [pageSize, setPageSize] = usePersistedState('quotes.pageSize', 25);

    const listAnchorRef = useRef<HTMLDivElement>(null);
    useListScrollRestore('quotes', listAnchorRef, !isLoading);

    // Modals and action tracking
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedDealId, setSelectedDealId] = useState<string>('');
    // Settings → Documents → Numbering: when Sales Quote auto-numbering is off the user types the number.
    const [quoteAutoNumbering, setQuoteAutoNumbering] = useState(true);
    const [manualQuoteNumber, setManualQuoteNumber] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [dealDropdownOpen, setDealDropdownOpen] = useState(false);
    const [dealSearchTerm, setDealSearchTerm] = useState('');
    const dealDropdownRef = useRef<HTMLDivElement>(null);

    // Row action popup menu state

    // View mode: 'all' = All Quotes, 'approvals' = Approvals Inbox
    const [activeTab, setActiveTab] = usePersistedState<'all' | 'approvals'>('quotes.activeTab', 'all');
    const [approvals, setApprovals] = useState<any[]>([]);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [approvalsStatusFilter, setApprovalsStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [approvalsSearchTerm, setApprovalsSearchTerm] = useState('');

    const fetchApprovals = async () => {
        try {
            if (crmService.getApprovalsInbox) {
                const data = await crmService.getApprovalsInbox();
                const list = Array.isArray(data) ? data : [];
                setApprovals(list);
                const pending = list.filter((a: any) => a.approver_status === 'pending');
                setPendingApprovalsCount(pending.length);
            }
        } catch (err) {
            console.error('Failed to load approvals inbox', err);
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [quotesData, dealsData] = await Promise.all([
                crmService.getQuotes(),
                crmService.getDeals(),
                fetchApprovals()
            ]);
            setQuotes(quotesData || []);
            setDeals(dealsData || []);
        } catch (err: any) {
            console.error('Failed to fetch quotes', err);
            setError(err.message || 'Failed to load quotes');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Re-read on every open so a settings change made meanwhile is picked up.
    useEffect(() => {
        if (!isCreateModalOpen) return;
        let cancelled = false;
        crmService.isQuoteAutoNumbering().then(auto => {
            if (!cancelled) setQuoteAutoNumbering(auto);
        });
        return () => { cancelled = true; };
    }, [isCreateModalOpen]);

    useEffect(() => {
        if (!dealDropdownOpen) return;
        const handler = (e: MouseEvent) => {
            if (dealDropdownRef.current && !dealDropdownRef.current.contains(e.target as Node)) {
                setDealDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [dealDropdownOpen]);


    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, dealFilter, validityFilter]);

    // Fast deal lookup map
    const dealsMap = useMemo(() => new Map(deals.map(d => [d.id, d])), [deals]);

    // Customer name resolution
    const resolveCustomer = useCallback((quote: Quote): { name: string; isLead: boolean } | null => {
        if (quote.customer_name) return { name: quote.customer_name, isLead: false };
        const deal = quote.deal_id ? dealsMap.get(quote.deal_id) : quote.deal;
        const anyDeal = deal as any;
        if (deal?.company_name) return { name: deal.company_name, isLead: false };
        if (deal?.company) return { name: deal.company, isLead: false };
        if (anyDeal?.contact_name) return { name: anyDeal.contact_name, isLead: !deal?.company_name };
        if (anyDeal?.lead?.company_name) return { name: anyDeal.lead.company_name, isLead: true };
        if (anyDeal?.lead?.contact_name) return { name: anyDeal.lead.contact_name, isLead: true };
        return null;
    }, [dealsMap]);

    // Deal name resolution
    const resolveDeal = useCallback((quote: Quote): { id: string; name: string } | null => {
        if (!quote.deal_id && !quote.deal?.id) return null;
        const deal = quote.deal_id ? dealsMap.get(quote.deal_id) : quote.deal;
        return {
            id: quote.deal_id || deal?.id || '',
            name: deal?.name || quote.deal?.name || 'Deal',
        };
    }, [dealsMap]);

    // Filtering & Sorting
    const filteredQuotes = useMemo(() => {
        const lowerSearch = searchTerm.trim().toLowerCase();
        const filtered = quotes.filter(quote => {
            const customer = resolveCustomer(quote);
            const deal = resolveDeal(quote);

            const matchesSearch = !lowerSearch ||
                quote.quote_number?.toLowerCase().includes(lowerSearch) ||
                quote.title?.toLowerCase().includes(lowerSearch) ||
                customer?.name.toLowerCase().includes(lowerSearch) ||
                deal?.name.toLowerCase().includes(lowerSearch) ||
                quote.customer_reference?.toLowerCase().includes(lowerSearch);

            const matchesStatus = statusFilter === 'All' || quote.status === statusFilter;
            const matchesDeal = dealFilter === 'All' || quote.deal_id === dealFilter;

            let matchesValidity = true;
            if (validityFilter === 'valid') {
                matchesValidity = !quote.valid_until || new Date(quote.valid_until) >= new Date();
            } else if (validityFilter === 'expired') {
                matchesValidity = !!quote.valid_until && new Date(quote.valid_until) < new Date();
            }

            return matchesSearch && matchesStatus && matchesDeal && matchesValidity;
        });

        if (!sortField) return filtered;

        return [...filtered].sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortField) {
                case 'quote_number':
                    valA = a.quote_number || '';
                    valB = b.quote_number || '';
                    break;
                case 'title':
                    valA = a.title || '';
                    valB = b.title || '';
                    break;
                case 'customer':
                    valA = resolveCustomer(a)?.name || '';
                    valB = resolveCustomer(b)?.name || '';
                    break;
                case 'deal':
                    valA = resolveDeal(a)?.name || '';
                    valB = resolveDeal(b)?.name || '';
                    break;
                case 'total':
                    valA = Number(a.total_amount ?? a.grand_total ?? 0);
                    valB = Number(b.total_amount ?? b.grand_total ?? 0);
                    break;
                case 'status':
                    valA = a.status || '';
                    valB = b.status || '';
                    break;
                case 'valid_until':
                    valA = a.valid_until ? new Date(a.valid_until).getTime() : 0;
                    valB = b.valid_until ? new Date(b.valid_until).getTime() : 0;
                    break;
                case 'created_at':
                    valA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    valB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [quotes, searchTerm, statusFilter, dealFilter, validityFilter, sortField, sortDirection, resolveCustomer, resolveDeal]);

    // Sandbox & Pagination
    const effectiveQuotes = useMemo(() => {
        return isSandboxMode ? filteredQuotes.slice(0, sandboxEntryLimit) : filteredQuotes;
    }, [filteredQuotes, isSandboxMode, sandboxEntryLimit]);

    const totalPages = Math.max(1, Math.ceil(effectiveQuotes.length / pageSize));
    const paginatedQuotes = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return effectiveQuotes.slice(start, start + pageSize);
    }, [effectiveQuotes, currentPage, pageSize]);

    const handleCreateQuote = async () => {
        if (!selectedDealId) return;
        const quoteNumber = manualQuoteNumber.trim();
        if (!quoteAutoNumbering && !quoteNumber) return;
        try {
            const newQuote = await crmService.createQuote({
                deal_id: selectedDealId,
                ...(quoteAutoNumbering ? {} : { quote_number: quoteNumber }),
            });
            recordActivity({ eventType: 'quote.created', eventCategory: 'crm', description: `Created quote for deal`, resourceType: 'quote', resourceId: newQuote.id }).catch(() => {});
            navigate(`/crm/quotes/${newQuote.id}`);
        } catch (err: any) {
            // The setting could not be read (or changed meanwhile): crm-be is the
            // judge, so show the manual field when it says a number is required.
            if (/quote number is required/i.test(err?.message || '')) setQuoteAutoNumbering(false);
            setError(err.message || 'Failed to create quote');
            toast.error(err.message || 'Failed to create quote');
        }
    };

    const executeStatusAction = async (quote: Quote, action: 'submit' | 'approve' | 'reject' | 'convert') => {
        setActionLoading(quote.id + action);
        try {
            if (action === 'submit')  await crmService.submitQuoteForApproval(quote.id);
            if (action === 'approve') await crmService.approveQuote(quote.id);
            if (action === 'reject')  await crmService.rejectQuote(quote.id, rejectReason);
            if (action === 'convert') await crmService.convertQuoteToOrder(quote.id);
            setRejectTarget(null);
            setRejectReason('');
            toast.success(`Quote ${action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'converted'} successfully`);
            await fetchData();
        } catch (err: any) {
            setError(err.message || `Failed to ${action} quote`);
            toast.error(err.message || `Failed to ${action} quote`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleStatusAction = (quote: Quote, action: 'submit' | 'approve' | 'reject' | 'convert') => {
        if (action === 'reject') {
            setRejectTarget(quote.id);
            return;
        }
        executeStatusAction(quote, action);
    };

    const handleDeleteQuote = async (quoteId: string) => {
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await crmService.deleteQuote(quoteId);
            setQuotes(prev => prev.filter(q => q.id !== quoteId));
            setSelectedQuoteIds(prev => prev.filter(id => id !== quoteId));
            setShowDeleteConfirm(null);
            toast.success('Quote deleted successfully.');
        } catch (err: any) {
            const message = err.message || 'Failed to delete quote';
            setError(message);
            toast.error(message);
        } finally {
            setIsDeleting(false);
        }
    };

    // Print quotation directly from table
    const handlePrintQuote = async (quote: Quote) => {
        try {
            const fullQuote = await crmService.getQuoteById(quote.id);
            const customerData = fullQuote.customer_id ? await crmService.getLeadById(fullQuote.customer_id).catch(() => null) : null;
            const org = shell?.currentOrg as any;
            if (shell?.printDocument) {
                shell.printDocument('sales_quote', quoteToDocumentData(fullQuote, {
                    currency: settings?.base_currency || 'USD',
                    seller: {
                        name: org?.name || '',
                        address: org?.billing_address ? [
                            org.billing_address.street,
                            org.billing_address.city,
                            org.billing_address.country,
                        ].filter(Boolean).join(', ') : undefined,
                        tax_number: org?.tax_id,
                        pan: org?.pan,
                    },
                    customer: customerData,
                    sellerState: org?.billing_address?.state,
                    sellerCountry: org?.billing_address?.country,
                }));
            } else {
                openQuote(quote.id);
            }
        } catch (err: any) {
            toast.error('Unable to prepare quote for printing. Opening quote details.');
            openQuote(quote.id);
        }
    };

    // Export selected or all visible quotes as CSV
    const handleExportSelected = () => {
        const rowsToExport = selectedQuoteIds.length > 0
            ? quotes.filter(q => selectedQuoteIds.includes(q.id))
            : effectiveQuotes;

        if (rowsToExport.length === 0) {
            toast.error('No quotes available to export.');
            return;
        }

        const csv = quotesToCsv(rowsToExport, deals);
        downloadCsv(`quotes-export-${rowsToExport.length}.csv`, csv);
        toast.success(`Exported ${rowsToExport.length} quotes to CSV.`);
    };

    const formatCurrency = (value: number) => formatters.formatCurrency(value);
    const formatDate = (dateString: string) => formatters.formatDate(dateString, { year: 'numeric', month: 'short', day: 'numeric' });

    const columns: DataTableColumn<Quote>[] = [
        {
            key: 'quote_number',
            header: 'Quote #',
            sortable: true,
            render: (quote: Quote) => (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openQuote(quote.id); }}
                    className="font-mono text-sm font-semibold text-primary hover:text-primary whitespace-nowrap transition-colors text-left"
                >
                    {quote.quote_number || `Q-${quote.id.slice(0, 8)}`}
                </button>
            ),
        },
        {
            key: 'title',
            header: 'Title',
            sortable: true,
            render: (quote: Quote) => (
                <div className="flex flex-col min-w-0 max-w-xs">
                    <span
                        className="text-fg font-medium truncate block"
                        title={quote.title || 'Untitled Quote'}
                    >
                        {quote.title || 'Untitled Quote'}
                    </span>
                    {quote.customer_reference && (
                        <span className="text-xs text-fg-muted truncate" title={`Buyer Reference: ${quote.customer_reference}`}>
                            Ref: {quote.customer_reference}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'customer',
            header: 'Customer',
            sortable: true,
            render: (quote: Quote) => {
                const customer = resolveCustomer(quote);
                if (!customer) return <span className="text-fg-muted text-xs">—</span>;
                return (
                    <div className="flex items-center gap-1.5 min-w-0 max-w-44">
                        <span className="text-fg-subtle font-normal truncate" title={customer.name}>
                            {customer.name}
                        </span>
                        {customer.isLead && (
                            <span className="shrink-0 px-1.5 py-0.2 rounded text-xs font-semibold bg-success/10 text-success border border-success/20">
                                Lead
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'deal',
            header: 'Deal',
            sortable: true,
            render: (quote: Quote) => {
                const deal = resolveDeal(quote);
                if (!deal || !deal.id) return <span className="text-fg-muted text-xs">—</span>;
                return (
                    <div className="min-w-0 max-w-40 truncate" title={deal.name}>
                        <CrossLinkChip type="crm.deal" id={deal.id} label={deal.name} compact />
                    </div>
                );
            },
        },
        {
            key: 'total',
            header: 'Total',
            sortable: true,
            align: 'right',
            render: (quote: Quote) => (
                <div className="text-right">
                    <span className="text-fg font-medium font-mono">
                        {formatCurrency(quote.total_amount ?? quote.grand_total ?? 0)}
                    </span>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (quote: Quote) => (
                <QuoteStatusCell
                    quote={quote}
                    isActionLoading={!!actionLoading}
                    onAction={handleStatusAction}
                />
            ),
        },
        {
            key: 'valid_until',
            header: 'Valid Until',
            sortable: true,
            render: (quote: Quote) => {
                if (!quote.valid_until) return <span className="text-fg-muted text-xs">-</span>;
                const date = new Date(quote.valid_until);
                const now = new Date();
                const isExpired = date < now;
                const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isExpiringSoon = !isExpired && diffDays <= 7 && diffDays >= 0;

                if (isExpired) {
                    return (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-danger/80 line-through text-xs">{formatDate(quote.valid_until)}</span>
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold  bg-danger/10 text-danger border border-danger/20">
                                Expired
                            </span>
                        </div>
                    );
                }
                if (isExpiringSoon) {
                    return (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-warning text-xs font-medium">{formatDate(quote.valid_until)}</span>
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold  bg-warning/10 text-warning border border-warning/20">
                                Soon
                            </span>
                        </div>
                    );
                }
                return <span className="text-fg-subtle text-xs whitespace-nowrap">{formatDate(quote.valid_until)}</span>;
            },
        },
        {
            key: 'created_at',
            header: 'Created',
            sortable: true,
            render: (quote: Quote) => (
                <span className="text-fg-subtle text-xs whitespace-nowrap">{formatDate(quote.created_at)}</span>
            ),
        },
    ];

    const quoteRowActions = (quote: Quote) => [
                            { label: 'View Quote Details', onSelect: () => openQuote(quote.id) },
                            ...(quote.status === 'draft' ? [
                                { label: 'Edit Quote', onSelect: () => navigate(`/crm/quotes/${quote.id}?edit=true`) },
                                { label: 'Submit for Approval', onSelect: () => handleStatusAction(quote, 'submit') },
                            ] : []),
                            ...(quote.status === 'approved' ? [
                                { label: 'Convert to Order', onSelect: () => handleStatusAction(quote, 'convert') },
                            ] : []),
                            { label: 'Print Quote', onSelect: () => handlePrintQuote(quote) },
                            ...(canCreateQuote && quote.status === 'draft' ? [
                                { label: 'Delete Quote', danger: true, onSelect: () => setShowDeleteConfirm(quote.id) },
                            ] : []),
    ];

    const handleQuickApprove = async (quoteId: string) => {
        setActionLoading(quoteId + 'approve');
        try {
            await crmService.approveQuote(quoteId);
            toast.success('Quote approved successfully');
            await fetchData();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to approve quote');
        } finally {
            setActionLoading(null);
        }
    };

    const handleQuickReject = (quoteId: string) => {
        setRejectTarget(quoteId);
    };

    const filteredApprovals = useMemo(() => {
        return approvals.filter((item) => {
            const matchesStatus =
                approvalsStatusFilter === 'all' ||
                item.approver_status === approvalsStatusFilter;
            const term = approvalsSearchTerm.trim().toLowerCase();
            const matchesSearch =
                !term ||
                item.quote_number?.toLowerCase().includes(term) ||
                item.title?.toLowerCase().includes(term) ||
                item.customer_name?.toLowerCase().includes(term) ||
                item.requested_by?.toLowerCase().includes(term);
            return matchesStatus && matchesSearch;
        });
    }, [approvals, approvalsStatusFilter, approvalsSearchTerm]);

    const approvalColumns: DataTableColumn<any>[] = [
        {
            key: 'quote_number',
            header: 'Quote #',
            render: (item: any) => (
                <button
                    onClick={(e) => { e.stopPropagation(); openQuote(item.quote_id); }}
                    className="font-mono text-sm font-semibold text-primary hover:text-primary text-left whitespace-nowrap"
                >
                    {item.quote_number || `Q-${item.quote_id.slice(0, 8)}`}
                </button>
            ),
        },
        {
            key: 'title',
            header: 'Title',
            render: (item: any) => (
                <span className="text-fg font-medium truncate max-w-xs block">{item.title || 'Untitled Quote'}</span>
            ),
        },
        {
            key: 'customer',
            header: 'Customer',
            render: (item: any) => (
                <span className="text-fg-subtle text-sm">{item.customer_name || '—'}</span>
            ),
        },
        {
            key: 'amount',
            header: 'Amount',
            render: (item: any) => (
                <span className="text-fg font-medium font-mono">{formatCurrency(Number(item.total_amount || 0))}</span>
            ),
        },
        {
            key: 'requested_by',
            header: 'Submitted By',
            render: (item: any) => (
                <span className="text-fg-subtle text-xs">{item.requested_by || 'Unknown'}</span>
            ),
        },
        {
            key: 'requested_at',
            header: 'Submitted At',
            render: (item: any) => (
                <span className="text-fg-subtle text-xs">{item.requested_at ? formatDate(item.requested_at) : '—'}</span>
            ),
        },
        {
            key: 'other_approvers',
            header: 'Reviewers',
            render: (item: any) => {
                const others = item.all_approvers || [];
                if (others.length === 0) return <span className="text-fg-muted text-xs">—</span>;
                return (
                    <div className="flex flex-wrap gap-1 max-w-xs">
                        {others.map((o: any, idx: number) => {
                            const badgeColor =
                                o.status === 'approved'
                                    ? 'bg-success/10 text-success border-success/30'
                                    : o.status === 'rejected'
                                    ? 'bg-danger/10 text-danger border-danger/30'
                                    : 'bg-surface-raised text-fg-subtle border-line';
                            return (
                                <span
                                    key={o.id || idx}
                                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${badgeColor}`}
                                >
                                    <span>{o.approver_name || o.approver_email || 'Approver'}</span>
                                    <span className="text-xs font-bold opacity-75">({o.status})</span>
                                </span>
                            );
                        })}
                    </div>
                );
            },
        },
        {
            key: 'status',
            header: 'Your Decision',
            render: (item: any) => {
                if (item.approver_status === 'approved') {
                    return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/30">
                            <Check className="w-3 h-3" />
                            Approved
                        </span>
                    );
                }
                if (item.approver_status === 'rejected') {
                    return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/30">
                            <X className="w-3 h-3" />
                            Rejected
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/30">
                        <Clock className="w-3 h-3" />
                        Pending
                    </span>
                );
            },
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (item: any) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {item.approver_status === 'pending' && (
                        <>
                            <button
                                onClick={() => handleQuickApprove(item.quote_id)}
                                disabled={actionLoading === item.quote_id + 'approve'}
                                className="px-2.5 py-1 text-xs font-semibold text-success bg-success/10 hover:bg-success/20 border border-success/30 rounded transition-colors disabled:opacity-50"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => handleQuickReject(item.quote_id)}
                                className="px-2.5 py-1 text-xs font-semibold text-danger bg-danger/10 hover:bg-danger/20 border border-danger/30 rounded transition-colors"
                            >
                                Reject
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => openQuote(item.quote_id)}
                        className="p-1 text-fg-subtle hover:text-fg hover:bg-surface-raised rounded transition-colors"
                        title="View Details"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ];

    const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'All' || dealFilter !== 'All' || validityFilter !== 'All');

    const resetFilters = () => {
        setSearchTerm('');
        setStatusFilter('All');
        setDealFilter('All');
        setValidityFilter('All');
    };

    // Find quote for the active 3-dots action menu

    const filterConfig: ListFilterConfig = {
        fields: [
            { key: 'status', label: 'Status', type: 'select', quick: true, options: (Object.entries(statusColors) as [QuoteStatus, typeof statusColors[QuoteStatus]][]).map(([value, cfg]) => ({ value, label: cfg.label, count: quotes.filter((q) => q.status === value).length })) },
            ...(deals.length > 0 ? [{ key: 'deal', label: 'Deal', type: 'select' as const, options: deals.map(d => ({ value: d.id, label: d.name })) }] : []),
            { key: 'validity', label: 'Validity', type: 'select', quick: true, options: [{ value: 'valid', label: 'Valid Proposals' }, { value: 'expired', label: 'Expired Proposals' }] },
        ],
        values: {
            ...(statusFilter !== 'All' ? { status: statusFilter } : {}),
            ...(dealFilter !== 'All' ? { deal: dealFilter } : {}),
            ...(validityFilter !== 'All' ? { validity: validityFilter } : {}),
        } as FilterValues,
        onChange: (next: FilterValues) => {
            setStatusFilter((next.status as string) || 'All');
            setDealFilter((next.deal as string) || 'All');
            setValidityFilter((next.validity as string) || 'All');
        },
        onClear: resetFilters,
    };
    const approvalsFilterConfig: ListFilterConfig = {
        fields: [
            {
                key: 'status', label: 'Status', type: 'select', quick: true,
                options: (['pending', 'approved', 'rejected'] as const).map((id) => ({
                    value: id,
                    label: `${id.charAt(0).toUpperCase()}${id.slice(1)} (${approvals.filter((a) => a.approver_status === id).length})`,
                })),
            },
        ],
        values: (approvalsStatusFilter !== 'all' ? { status: approvalsStatusFilter } : {}) as FilterValues,
        onChange: (next: FilterValues) => setApprovalsStatusFilter(((next.status as string) || 'all') as 'all' | 'pending' | 'approved' | 'rejected'),
        onClear: () => { setApprovalsStatusFilter('all'); setApprovalsSearchTerm(''); },
    };
    const bulkNode = selectedQuoteIds.length > 0 ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg text-xs animate-in fade-in">
                                <span className="font-semibold text-primary">
                                    {selectedQuoteIds.length} selected
                                </span>
                                <span className="text-fg-muted">|</span>
                                <button
                                    type="button"
                                    onClick={handleExportSelected}
                                    className="text-fg hover:text-fg font-medium underline"
                                >
                                    Export CSV
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedQuoteIds([])}
                                    className="text-fg-subtle hover:text-fg ml-1"
                                >
                                    Deselect
                                </button>
                            </div>
    ) : null;

    const viewsNode = (
        <SegmentedControl
            size="sm"
            aria-label="Quote views"
            data-testid="quotes-views"
            value={activeTab}
            onChange={(v: string) => setActiveTab(v as 'all' | 'approvals')}
            options={[
                { value: 'all', label: 'All Quotes' },
                { value: 'approvals', label: pendingApprovalsCount > 0 ? `Approvals (${pendingApprovalsCount})` : 'Approvals' },
            ]}
        />
    );

    return (
        <ListPageTemplate
            title="Quotes"
            description="Manage sales quotes and proposals"
            headerSecondaryActions={[
                <ExportMenu
                    key="export"
                    label="Export quotes"
                    formats={['csv']}
                    onExport={async () => {
                        handleExportSelected();
                    }}
                />,
            ]}
            primaryAction={canCreateQuote ? (
                <QuotaGate
                    quotaKey="max_quotes"
                    moduleCode="crm"
                    used={quotaData?.current_usage ?? 0}
                    limit={quotaData?.limit ?? 0}
                    isUnlimited={quotaData?.is_unlimited}
                    disableOnExceeded
                >
                    <Button onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4" />
                        New Quote
                    </Button>
                </QuotaGate>
            ) : undefined}
            views={viewsNode}
            search={activeTab === 'all' ? (
                <SearchInput placeholder="Search quotes..." value={searchTerm} onChange={setSearchTerm} />
            ) : (
                <SearchInput name="approvals-search" placeholder="Search approvals..." value={approvalsSearchTerm} onChange={setApprovalsSearchTerm} />
            )}
            filterConfig={activeTab === 'all' ? filterConfig : approvalsFilterConfig}
            toolbarEnd={activeTab === 'all' ? bulkNode : undefined}
            pagination={activeTab === 'all' && paginatedQuotes.length > 0 && effectiveQuotes.length > 0 ? (
                <Pagination
                    currentPage={currentPage}
                    totalPages={Math.max(1, totalPages)}
                    totalItems={effectiveQuotes.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                    pageSizeOptions={[10, 25, 50, 100]}
                />
            ) : undefined}
        >
            <div ref={listAnchorRef}>
            {/* Error Notification */}
            {error && (
                <div className="mb-5 p-3.5 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={fetchData}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-danger/20 hover:bg-danger/30 rounded text-xs font-semibold text-danger transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                    </button>
                </div>
            )}
            {activeTab === 'all' && (
                <>
                    {/* Sandbox limit notice */}
                    {isSandboxMode && isLimited(filteredQuotes.length) && (
                        <div className="mb-4 px-4 py-2.5 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm flex items-center gap-2">
                            <span className="font-semibold">Sandbox mode:</span>
                            showing {sandboxEntryLimit} of {filteredQuotes.length} quotes — full list visible in production.
                        </div>
                    )}

                    {/* Table View */}
                    {paginatedQuotes.length === 0 ? (
                        <div className="text-center py-16 bg-surface-sunken border border-line rounded-lg">
                            <FileText className="w-12 h-12 mx-auto text-fg-muted mb-4" />
                            <h3 className="text-lg font-medium text-fg-subtle mb-2">No quotes found</h3>
                            <p className="text-fg-subtle mb-4 text-sm">
                                {hasActiveFilters
                                    ? 'Try adjusting your filters'
                                    : 'Create your first quote to get started'}
                            </p>
                            {hasActiveFilters ? (
                                <button
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-surface-raised hover:bg-line border border-line text-fg rounded-lg text-sm font-medium transition-colors"
                                >
                                    Clear filters
                                </button>
                            ) : (
                                canCreateQuote && (
                                    <button
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-fg rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Quote
                                    </button>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <DataTable
                                name="quotes"
                                data-testid="quotes-table"
                                rows={paginatedQuotes}
                                rowKey={(q: Quote) => q.id}
                                columns={columns}
                                loading={isLoading}
                                onRowClick={(quote: Quote) => openQuote(quote.id)}
                                selectedKeys={new Set(selectedQuoteIds)}
                                onSelectionChange={(keys: Set<string>) => setSelectedQuoteIds(Array.from(keys))}
                                sortKey={sortField}
                                sortDir={sortDirection}
                                onSortChange={(key: string, dir: SortDirection) => { setSortField(key as SortField); setSortDirection(dir); }}
                                rowActions={quoteRowActions}
                            />

                        </div>
                    )}
                </>
            )}

            {activeTab === 'approvals' && (
                <div className="space-y-4">
                    {/* Approvals Table */}
                    {filteredApprovals.length === 0 ? (
                        <div className="text-center py-16 bg-surface-sunken border border-line rounded-lg">
                            <CheckCircle className="w-12 h-12 mx-auto text-fg-muted mb-4" />
                            <h3 className="text-lg font-medium text-fg-subtle mb-2">No approval requests found</h3>
                            <p className="text-fg-subtle text-sm">
                                {approvalsStatusFilter === 'pending'
                                    ? "You're all caught up! There are no quotes awaiting your approval."
                                    : 'No quotes match the selected filter.'}
                            </p>
                        </div>
                    ) : (
                        <DataTable
                            name="quote-approvals"
                            rows={filteredApprovals}
                            columns={approvalColumns}
                            rowKey={(item: any) => String(item.id ?? item.quote_id)}
                            onRowClick={(item: any) => openQuote(item.quote_id)}
                        />
                    )}
                </div>
            )}

            {/* Portal Row Action Menu (⋮) */}
            {/* Create Quote Modal */}
            {isCreateModalOpen && (
                <Modal
                    isOpen
                    size="md"
                    title="Create New Quote"
                    data-testid="create-quote-modal"
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setSelectedDealId('');
                        setManualQuoteNumber('');
                        setDealDropdownOpen(false);
                        setDealSearchTerm('');
                    }}
                    footer={
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setSelectedDealId('');
                                    setManualQuoteNumber('');
                                    setDealDropdownOpen(false);
                                    setDealSearchTerm('');
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleCreateQuote}
                                disabled={!selectedDealId || (!quoteAutoNumbering && !manualQuoteNumber.trim())}
                            >
                                Create Quote
                            </Button>
                        </>
                    }
                >
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-fg-subtle mb-2">
                                        Select Deal *
                                    </label>
                                    <div ref={dealDropdownRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => { setDealDropdownOpen(o => !o); setDealSearchTerm(''); }}
                                            className="w-full flex items-center justify-between px-4 py-2 bg-surface-raised border border-line rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-focus transition-colors hover:border-line"
                                        >
                                            {selectedDealId ? (() => {
                                                const d = deals.find(d => d.id === selectedDealId);
                                                return d ? (
                                                    <span className="flex flex-col min-w-0">
                                                        <span className="text-fg text-sm font-medium truncate">{d.name}</span>
                                                        {d.company_name && <span className="text-fg-subtle text-xs truncate">{d.company_name}</span>}
                                                    </span>
                                                ) : <span className="text-fg-subtle text-sm">Select a deal...</span>;
                                            })() : <span className="text-fg-subtle text-sm">Select a deal...</span>}
                                            <ChevronDown className={`ml-2 h-4 w-4 text-fg-subtle shrink-0 transition-transform ${dealDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {dealDropdownOpen && (
                                            <div className="absolute z-menu mt-1 w-full bg-surface-raised border border-line rounded-lg shadow-xl overflow-hidden">
                                                <div className="p-2 border-b border-line">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-muted" />
<CrmScope>
                                                        <TextField
                                                            autoFocus
                                                            name="deal-search"
                                                            type="text"
                                                            size="sm"
                                                            placeholder="Search deals..."
                                                            value={dealSearchTerm}
                                                            onChange={e => setDealSearchTerm(e.target.value)}
                                                            className="pl-8"
                                                        />
</CrmScope>
                                                    </div>
                                                </div>
                                                <ul className="max-h-52 overflow-y-auto py-1">
                                                    {deals
                                                        .filter(d =>
                                                            !dealSearchTerm ||
                                                            d.name.toLowerCase().includes(dealSearchTerm.toLowerCase()) ||
                                                            (d.company_name || '').toLowerCase().includes(dealSearchTerm.toLowerCase())
                                                        )
                                                        .map(deal => (
                                                            <li key={deal.id}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setSelectedDealId(deal.id); setDealDropdownOpen(false); }}
                                                                    className={`w-full flex flex-col items-start px-4 py-2.5 text-left hover:bg-line transition-colors ${selectedDealId === deal.id ? 'bg-primary/20' : ''}`}
                                                                >
                                                                    <span className={`text-sm font-medium truncate w-full ${selectedDealId === deal.id ? 'text-primary' : 'text-fg'}`}>{deal.name}</span>
                                                                    {deal.company_name && <span className="text-xs text-fg-subtle truncate w-full mt-0.5">{deal.company_name}</span>}
                                                                </button>
                                                            </li>
                                                        ))
                                                    }
                                                    {deals.filter(d =>
                                                        !dealSearchTerm ||
                                                        d.name.toLowerCase().includes(dealSearchTerm.toLowerCase()) ||
                                                        (d.company_name || '').toLowerCase().includes(dealSearchTerm.toLowerCase())
                                                    ).length === 0 && (
                                                        <li className="px-4 py-3 text-sm text-fg-muted text-center">No deals found</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {!quoteAutoNumbering && (
                                    <div>
                                        <label htmlFor="manual-quote-number" className="block text-sm font-medium text-fg-subtle mb-2">
                                            Quote Number (manual) *
                                        </label>
<CrmScope>
                                        <TextField
                                            id="manual-quote-number"
                                            name="manual-quote-number"
                                            type="text"
                                            maxLength={50}
                                            value={manualQuoteNumber}
                                            onChange={e => setManualQuoteNumber(e.target.value)}
                                            placeholder="e.g. QT-501"
                                        />
</CrmScope>
                                        <p className="mt-1.5 text-xs text-fg-subtle">
                                            Auto-numbering for quotes is turned off in Settings → Documents → Numbering. Use letters, digits and - / _ . only; the number must be unique.
                                        </p>
                                    </div>
                                )}
                            </div>
                </Modal>
            )}

            {/* Reject Reason Modal */}
            {rejectTarget && (
                <Modal
                    isOpen
                    size="md"
                    title="Reject Quote"
                    data-testid="reject-quote-modal"
                    onClose={() => { setRejectTarget(null); setRejectReason(''); }}
                    footer={
                        <>
                            <Button type="button" variant="secondary" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={async () => {
                                    if (!rejectReason.trim()) {
                                        toast.error('Rejection reason is required');
                                        return;
                                    }
                                    setActionLoading(rejectTarget + 'reject');
                                    try {
                                        await crmService.rejectQuote(rejectTarget, rejectReason.trim());
                                        toast.success('Quote rejected successfully');
                                        setRejectTarget(null);
                                        setRejectReason('');
                                        await fetchData();
                                    } catch (err: any) {
                                        toast.error(err?.message || 'Failed to reject quote');
                                    } finally {
                                        setActionLoading(null);
                                    }
                                }}
                                disabled={!rejectReason.trim()}
                            >
                                Confirm Reject
                            </Button>
                        </>
                    }
                >
                    <p className="text-xs text-fg-subtle mb-3">
                        Please provide a reason for rejecting this quote. Rejection reasons are mandatory.
                    </p>
                        <CrmScope>
                            <Textarea
                                name="reject-reason"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Reason for rejection (mandatory) *"
                                rows={3}
                            />
                        </CrmScope>
                </Modal>
            )}

            {/* Delete Confirm Dialog */}
            {showDeleteConfirm && (
                <Modal
                    isOpen
                    size="md"
                    title="Delete Quote?"
                    dismissible={!isDeleting}
                    data-testid="delete-quote-modal"
                    onClose={() => setShowDeleteConfirm(null)}
                    footer={
                        <>
                            <Button type="button" variant="secondary" onClick={() => setShowDeleteConfirm(null)} disabled={isDeleting}>
                                Cancel
                            </Button>
                            <Button type="button" variant="danger" onClick={() => handleDeleteQuote(showDeleteConfirm)} disabled={isDeleting}>
                                {isDeleting ? 'Deleting…' : 'Delete Quote'}
                            </Button>
                        </>
                    }
                >
                        <p className="text-fg-subtle">
                            Are you sure you want to delete{' '}
                            <span className="text-fg font-medium">
                                {(() => {
                                    const target = quotes.find(q => q.id === showDeleteConfirm);
                                    return target ? `${target.quote_number}${target.title ? ` – ${target.title}` : ''}` : 'this quote';
                                })()}
                            </span>
                            ? This action cannot be undone.
                        </p>
                </Modal>
            )}
            </div>
        </ListPageTemplate>
    );
};

export default QuotesPage;
