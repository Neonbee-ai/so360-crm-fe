import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Plus, FileText, Search, Filter, CheckCircle, XCircle, Clock, Send, Trash2,
    ChevronDown, ChevronUp, ChevronsUpDown, Eye, User, Inbox, Check, X,
    MoreVertical, Download, Printer, Copy, RotateCcw, AlertCircle, RefreshCw,
    Building2, CheckSquare, Square
} from 'lucide-react';
import { crmService } from '../services/crmService';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { Quote, QuoteStatus, Deal } from '../types/crm';
import { Table } from '../components/common/Table';
import { useBusinessSettings, useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import { QuotaGate, CrossLinkChip, toast } from '@so360/design-system';
import { quotesToCsv, downloadCsv } from '../components/quotes/quotesCsv';
import { quoteToDocumentData } from '../utils/quoteToDocumentData';

export const statusColors: Record<QuoteStatus, { bg: string; text: string; label: string; border: string }> = {
    draft: { bg: 'bg-slate-500/10', text: 'text-slate-300', label: 'Draft', border: 'border-slate-500/30' },
    pending_approval: { bg: 'bg-amber-500/10', text: 'text-amber-300', label: 'Pending Approval', border: 'border-amber-500/30' },
    approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', label: 'Approved', border: 'border-emerald-500/30' },
    rejected: { bg: 'bg-rose-500/10', text: 'text-rose-300', label: 'Rejected', border: 'border-rose-500/30' },
    converted: { bg: 'bg-blue-500/10', text: 'text-blue-300', label: 'Converted', border: 'border-blue-500/30' },
    expired: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Expired', border: 'border-zinc-500/30' },
};

// Allowed next transitions per status — empty means terminal (no dropdown)
const STATUS_TRANSITIONS: Partial<Record<QuoteStatus, Array<{ action: 'submit' | 'approve' | 'reject' | 'convert'; label: string; color: string }>>> = {
    draft:            [{ action: 'submit',  label: 'Submit for Approval', color: 'text-amber-300 hover:bg-amber-500/20' }],
    pending_approval: [
        { action: 'approve', label: 'Approve',  color: 'text-green-300 hover:bg-green-500/20' },
        { action: 'reject',  label: 'Reject',   color: 'text-red-300   hover:bg-red-500/20'   },
    ],
    approved: [{ action: 'convert', label: 'Convert to Order', color: 'text-blue-300 hover:bg-blue-500/20' }],
};

interface QuoteStatusCellProps {
    quote: Quote;
    isActionLoading: boolean;
    onAction: (quote: Quote, action: 'submit' | 'approve' | 'reject' | 'convert') => void;
}

export const QuoteStatusCell: React.FC<QuoteStatusCellProps> = ({ quote, isActionLoading, onAction }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const btnRef = useRef<HTMLButtonElement>(null);
    const transitions = STATUS_TRANSITIONS[quote.status] ?? [];
    const status = statusColors[quote.status] || statusColors.draft;

    const openDropdown = useCallback(() => {
        if (transitions.length === 0) return;
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) {
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                zIndex: 9999,
                minWidth: rect.width,
            });
        }
        setIsOpen(true);
    }, [transitions.length]);

    useEffect(() => {
        if (!isOpen) return;
        const close = (e: MouseEvent) => {
            if (btnRef.current && !btnRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [isOpen]);

    return (
        <div onClick={(e) => e.stopPropagation()} className="inline-block">
            <button
                ref={btnRef}
                onClick={openDropdown}
                disabled={isActionLoading}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${status.bg} ${status.text} ${status.border} ${transitions.length > 0 ? 'cursor-pointer hover:brightness-125' : 'cursor-default'} disabled:opacity-50`}
                title={transitions.length > 0 ? 'Click to update status' : status.label}
            >
                <span className={`w-1.5 h-1.5 rounded-full ${quote.status === 'approved' ? 'bg-emerald-400' : quote.status === 'pending_approval' ? 'bg-amber-400' : quote.status === 'rejected' ? 'bg-rose-400' : quote.status === 'converted' ? 'bg-blue-400' : 'bg-slate-400'}`} />
                <span>{status.label}</span>
                {transitions.length > 0 && <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />}
            </button>
            {isOpen && transitions.length > 0 && createPortal(
                <div style={dropdownStyle} className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden w-48">
                    <div className="py-1">
                        {transitions.map(t => (
                            <button
                                key={t.action}
                                onMouseDown={(e) => { e.stopPropagation(); setIsOpen(false); onAction(quote, t.action); }}
                                className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${t.color}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [dealDropdownOpen, setDealDropdownOpen] = useState(false);
    const [dealSearchTerm, setDealSearchTerm] = useState('');
    const dealDropdownRef = useRef<HTMLDivElement>(null);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

    // Row action popup menu state
    const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
    const [actionMenuStyle, setActionMenuStyle] = useState<React.CSSProperties>({});
    const actionMenuRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (!statusDropdownOpen) return;
        const handler = (e: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
                setStatusDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [statusDropdownOpen]);

    useEffect(() => {
        if (!activeActionMenuId) return;
        const handler = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setActiveActionMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [activeActionMenuId]);

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

    // Summary KPI stats calculation
    const quoteStats = useMemo(() => {
        return {
            total: quotes.length,
            draft: quotes.filter(q => q.status === 'draft').length,
            pending: quotes.filter(q => q.status === 'pending_approval').length,
            approved: quotes.filter(q => q.status === 'approved').length,
            converted: quotes.filter(q => q.status === 'converted').length,
        };
    }, [quotes]);

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

    // Selection management
    const allOnPageSelected = useMemo(() => {
        if (paginatedQuotes.length === 0) return false;
        return paginatedQuotes.every((q: Quote) => selectedQuoteIds.includes(q.id));
    }, [paginatedQuotes, selectedQuoteIds]);

    const toggleSelectAll = () => {
        if (allOnPageSelected) {
            const pageIds = new Set(paginatedQuotes.map((q: Quote) => q.id));
            setSelectedQuoteIds(prev => prev.filter(id => !pageIds.has(id)));
        } else {
            const newIds = new Set([...selectedQuoteIds, ...paginatedQuotes.map((q: Quote) => q.id)]);
            setSelectedQuoteIds(Array.from(newIds));
        }
    };

    const toggleSelectQuote = (id: string) => {
        setSelectedQuoteIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortableHeader = ({ label, field, align = 'left' }: { label: string; field: SortField; align?: 'left' | 'right' }) => (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSort(field); }}
            className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors ${align === 'right' ? 'justify-end w-full' : ''}`}
        >
            <span>{label}</span>
            {sortField === field ? (
                sortDirection === 'asc' ? (
                    <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                )
            ) : (
                <ChevronsUpDown className="w-3.5 h-3.5 text-slate-600 opacity-60" />
            )}
        </button>
    );

    const handleCreateQuote = async () => {
        if (!selectedDealId) return;
        try {
            const newQuote = await crmService.createQuote({ deal_id: selectedDealId });
            recordActivity({ eventType: 'quote.created', eventCategory: 'crm', description: `Created quote for deal`, resourceType: 'quote', resourceId: newQuote.id }).catch(() => {});
            navigate(`/crm/quotes/${newQuote.id}`);
        } catch (err: any) {
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

    // Open row action menu portal
    const handleOpenActionMenu = (e: React.MouseEvent<HTMLButtonElement>, quoteId: string) => {
        e.stopPropagation();
        if (activeActionMenuId === quoteId) {
            setActiveActionMenuId(null);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        setActionMenuStyle({
            position: 'fixed',
            top: rect.bottom + 4,
            right: window.innerWidth - rect.right,
            zIndex: 9999,
        });
        setActiveActionMenuId(quoteId);
    };

    const columns = [
        {
            key: 'select',
            header: (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                    <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                        title="Select all on this page"
                    />
                </div>
            ),
            accessor: (quote: Quote) => (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                    <input
                        type="checkbox"
                        checked={selectedQuoteIds.includes(quote.id)}
                        onChange={() => toggleSelectQuote(quote.id)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                    />
                </div>
            ),
            className: 'w-10 px-3',
        },
        {
            key: 'quote_number',
            header: <SortableHeader label="Quote #" field="quote_number" />,
            accessor: (quote: Quote) => (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openQuote(quote.id); }}
                    className="font-mono text-sm font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap transition-colors text-left"
                >
                    {quote.quote_number || `Q-${quote.id.slice(0, 8)}`}
                </button>
            ),
            className: 'whitespace-nowrap',
        },
        {
            key: 'title',
            header: <SortableHeader label="Title" field="title" />,
            accessor: (quote: Quote) => (
                <div className="flex flex-col min-w-0 max-w-xs">
                    <span
                        className="text-slate-200 font-medium truncate block"
                        title={quote.title || 'Untitled Quote'}
                    >
                        {quote.title || 'Untitled Quote'}
                    </span>
                    {quote.customer_reference && (
                        <span className="text-[11px] text-slate-500 truncate" title={`Buyer Reference: ${quote.customer_reference}`}>
                            Ref: {quote.customer_reference}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'customer',
            header: <SortableHeader label="Customer" field="customer" />,
            accessor: (quote: Quote) => {
                const customer = resolveCustomer(quote);
                if (!customer) return <span className="text-slate-500 text-xs">—</span>;
                return (
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[180px]">
                        <span className="text-slate-300 font-normal truncate" title={customer.name}>
                            {customer.name}
                        </span>
                        {customer.isLead && (
                            <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Lead
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'deal',
            header: <SortableHeader label="Deal" field="deal" />,
            accessor: (quote: Quote) => {
                const deal = resolveDeal(quote);
                if (!deal || !deal.id) return <span className="text-slate-500 text-xs">—</span>;
                return (
                    <div className="min-w-0 max-w-[160px] truncate" title={deal.name}>
                        <CrossLinkChip type="crm.deal" id={deal.id} label={deal.name} compact />
                    </div>
                );
            },
        },
        {
            key: 'total',
            header: <SortableHeader label="Total" field="total" align="right" />,
            accessor: (quote: Quote) => (
                <div className="text-right">
                    <span className="text-slate-100 font-medium font-mono">
                        {formatCurrency(quote.total_amount ?? quote.grand_total ?? 0)}
                    </span>
                </div>
            ),
            className: 'text-right',
        },
        {
            key: 'status',
            header: <SortableHeader label="Status" field="status" />,
            accessor: (quote: Quote) => (
                <QuoteStatusCell
                    quote={quote}
                    isActionLoading={!!actionLoading}
                    onAction={handleStatusAction}
                />
            ),
        },
        {
            key: 'valid_until',
            header: <SortableHeader label="Valid Until" field="valid_until" />,
            accessor: (quote: Quote) => {
                if (!quote.valid_until) return <span className="text-slate-500 text-xs">-</span>;
                const date = new Date(quote.valid_until);
                const now = new Date();
                const isExpired = date < now;
                const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isExpiringSoon = !isExpired && diffDays <= 7 && diffDays >= 0;

                if (isExpired) {
                    return (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-rose-400/80 line-through text-xs">{formatDate(quote.valid_until)}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Expired
                            </span>
                        </div>
                    );
                }
                if (isExpiringSoon) {
                    return (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-amber-300 text-xs font-medium">{formatDate(quote.valid_until)}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Soon
                            </span>
                        </div>
                    );
                }
                return <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(quote.valid_until)}</span>;
            },
            className: 'whitespace-nowrap',
        },
        {
            key: 'created_at',
            header: <SortableHeader label="Created" field="created_at" />,
            accessor: (quote: Quote) => (
                <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(quote.created_at)}</span>
            ),
            className: 'whitespace-nowrap',
        },
        {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            accessor: (quote: Quote) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openQuote(quote.id); }}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                        title="View"
                    >
                        <FileText className="w-4 h-4" />
                    </button>
                    {canCreateQuote && quote.status === 'draft' && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(quote.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => handleOpenActionMenu(e, quote.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                        title="More actions"
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>
                </div>
            ),
            className: 'w-24 text-right pr-4',
        },
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

    const approvalColumns = [
        {
            key: 'quote_number',
            header: 'Quote #',
            accessor: (item: any) => (
                <button
                    onClick={(e) => { e.stopPropagation(); openQuote(item.quote_id); }}
                    className="font-mono text-sm font-semibold text-blue-400 hover:text-blue-300 text-left whitespace-nowrap"
                >
                    {item.quote_number || `Q-${item.quote_id.slice(0, 8)}`}
                </button>
            ),
        },
        {
            key: 'title',
            header: 'Title',
            accessor: (item: any) => (
                <span className="text-slate-200 font-medium truncate max-w-xs block">{item.title || 'Untitled Quote'}</span>
            ),
        },
        {
            key: 'customer',
            header: 'Customer',
            accessor: (item: any) => (
                <span className="text-slate-300 text-sm">{item.customer_name || '—'}</span>
            ),
        },
        {
            key: 'amount',
            header: 'Amount',
            accessor: (item: any) => (
                <span className="text-slate-200 font-medium font-mono">{formatCurrency(Number(item.total_amount || 0))}</span>
            ),
        },
        {
            key: 'requested_by',
            header: 'Submitted By',
            accessor: (item: any) => (
                <span className="text-slate-300 text-xs">{item.requested_by || 'Unknown'}</span>
            ),
        },
        {
            key: 'requested_at',
            header: 'Submitted At',
            accessor: (item: any) => (
                <span className="text-slate-400 text-xs">{item.requested_at ? formatDate(item.requested_at) : '—'}</span>
            ),
        },
        {
            key: 'other_approvers',
            header: 'Reviewers',
            accessor: (item: any) => {
                const others = item.all_approvers || [];
                if (others.length === 0) return <span className="text-slate-500 text-xs">—</span>;
                return (
                    <div className="flex flex-wrap gap-1 max-w-xs">
                        {others.map((o: any, idx: number) => {
                            const badgeColor =
                                o.status === 'approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : o.status === 'rejected'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700';
                            return (
                                <span
                                    key={o.id || idx}
                                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${badgeColor}`}
                                >
                                    <span>{o.approver_name || o.approver_email || 'Approver'}</span>
                                    <span className="text-[9px] uppercase font-bold opacity-75">({o.status})</span>
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
            accessor: (item: any) => {
                if (item.approver_status === 'approved') {
                    return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            Approved
                        </span>
                    );
                }
                if (item.approver_status === 'rejected') {
                    return (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <X className="w-3 h-3" />
                            Rejected
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        Pending
                    </span>
                );
            },
        },
        {
            key: 'actions',
            header: 'Actions',
            accessor: (item: any) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {item.approver_status === 'pending' && (
                        <>
                            <button
                                onClick={() => handleQuickApprove(item.quote_id)}
                                disabled={actionLoading === item.quote_id + 'approve'}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded transition-colors disabled:opacity-50"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => handleQuickReject(item.quote_id)}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded transition-colors"
                            >
                                Reject
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => openQuote(item.quote_id)}
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
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
    const activeMenuQuote = useMemo(() => {
        return quotes.find(q => q.id === activeActionMenuId);
    }, [quotes, activeActionMenuId]);

    return (
        <div className="p-6 max-w-[1600px] mx-auto" ref={listAnchorRef}>
            {/* Header: Clean & Compact with action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Quotes</h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Manage sales quotes and proposals</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleExportSelected}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-sm font-medium transition-colors"
                        title="Export quotes to CSV"
                    >
                        <Download className="w-4 h-4" />
                        <span>Export CSV</span>
                    </button>
                    {canCreateQuote && (
                        <QuotaGate
                            quotaKey="max_quotes"
                            moduleCode="crm"
                            used={quotaData?.current_usage ?? 0}
                            limit={quotaData?.limit ?? 0}
                            isUnlimited={quotaData?.is_unlimited}
                            disableOnExceeded
                        >
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                New Quote
                            </button>
                        </QuotaGate>
                    )}
                </div>
            </div>

            {/* Error Notification */}
            {error && (
                <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={fetchData}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs font-semibold text-red-200 transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                    </button>
                </div>
            )}

            {/* Status Summary: Compact Interactive KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {[
                    { id: 'All', label: 'Total Quotes', count: quoteStats.total, icon: FileText, color: 'text-blue-400', border: 'border-slate-700' },
                    { id: 'draft', label: 'Draft', count: quoteStats.draft, icon: Clock, color: 'text-slate-400', border: 'border-slate-700' },
                    { id: 'pending_approval', label: 'Pending Approval', count: quoteStats.pending, icon: Send, color: 'text-amber-400', border: 'border-amber-500/30' },
                    { id: 'approved', label: 'Approved', count: quoteStats.approved, icon: CheckCircle, color: 'text-emerald-400', border: 'border-emerald-500/30' },
                    { id: 'converted', label: 'Converted', count: quoteStats.converted, icon: Check, color: 'text-blue-400', border: 'border-blue-500/30' },
                ].map((stat) => {
                    const isActive = statusFilter === stat.id;
                    const Icon = stat.icon;
                    return (
                        <div
                            key={stat.id}
                            role="group"
                            aria-label={`KPI ${stat.label}`}
                            tabIndex={0}
                            onClick={() => setStatusFilter(isActive && stat.id !== 'All' ? 'All' : stat.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setStatusFilter(isActive && stat.id !== 'All' ? 'All' : stat.id);
                                }
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer select-none ${
                                isActive
                                    ? 'bg-blue-600/10 border-blue-500/60 ring-1 ring-blue-500/40 shadow-sm'
                                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider truncate">
                                    {stat.label}
                                </span>
                                <Icon className={`w-4 h-4 ${stat.color} shrink-0 opacity-80`} />
                            </div>
                            <div className="mt-2 flex items-baseline justify-between">
                                <span className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
                                    {stat.count}
                                </span>
                                {isActive && (
                                    <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                                        Filtered
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* View Switcher Tabs: All Quotes | Approvals */}
            <div className="flex items-center gap-4 border-b border-slate-800 mb-5">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                        activeTab === 'all'
                            ? 'border-blue-500 text-blue-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    <span>All Quotes</span>
                </button>
                <button
                    onClick={() => setActiveTab('approvals')}
                    className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                        activeTab === 'approvals'
                            ? 'border-blue-500 text-blue-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Inbox className="w-4 h-4" />
                    <span>Approvals</span>
                    {pendingApprovalsCount > 0 && (
                        <span
                            data-testid="approvals-pending-badge"
                            className="ml-0.5 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                        >
                            {pendingApprovalsCount}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'all' && (
                <>
                    {/* Unified Filter & Search Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
                            {/* Search bar */}
                            <div className="relative flex-1 min-w-[220px] max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search quotes..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {/* Status Filter Dropdown */}
                            <div ref={statusDropdownRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setStatusDropdownOpen(o => !o)}
                                    className={`flex items-center gap-2 px-3 py-1.5 bg-slate-900 border rounded-lg text-xs font-medium transition-colors hover:border-slate-600 ${statusFilter !== 'All' ? 'border-blue-500/60 text-blue-300 bg-blue-500/5' : 'border-slate-700 text-slate-300'}`}
                                >
                                    <Filter className={`w-3.5 h-3.5 flex-shrink-0 ${statusFilter !== 'All' ? 'text-blue-400' : 'text-slate-400'}`} />
                                    <span>
                                        {statusFilter === 'All' ? 'All Status' : (statusColors[statusFilter as QuoteStatus]?.label ?? statusFilter)}
                                    </span>
                                    {statusFilter !== 'All' && (
                                        <span
                                            role="button"
                                            aria-label="Clear status filter"
                                            onClick={(e) => { e.stopPropagation(); setStatusFilter('All'); setStatusDropdownOpen(false); }}
                                            className="ml-0.5 text-blue-400 hover:text-slate-50 leading-none cursor-pointer"
                                        >×</span>
                                    )}
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {statusDropdownOpen && (
                                    <div className="absolute left-0 top-full mt-1 z-30 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                                        <div className="py-1">
                                            <button
                                                type="button"
                                                onClick={() => { setStatusFilter('All'); setStatusDropdownOpen(false); }}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-800 transition-colors ${statusFilter === 'All' ? 'text-blue-300 bg-blue-600/10' : 'text-slate-300'}`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                                                    All Status
                                                </span>
                                                <span className="text-slate-500 font-mono">{quotes.length}</span>
                                            </button>
                                            {(Object.entries(statusColors) as [QuoteStatus, typeof statusColors[QuoteStatus]][]).map(([value, cfg]) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => { setStatusFilter(value); setStatusDropdownOpen(false); }}
                                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-800 transition-colors ${statusFilter === value ? 'bg-blue-600/10' : ''}`}
                                                >
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                        {cfg.label}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-mono">
                                                        {quotes.filter(q => q.status === value).length}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Deal Filter Dropdown */}
                            {deals.length > 0 && (
                                <select
                                    value={dealFilter}
                                    onChange={(e) => setDealFilter(e.target.value)}
                                    className={`bg-slate-900 border px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 ${dealFilter !== 'All' ? 'border-blue-500/60 text-blue-300' : 'border-slate-700 text-slate-300'}`}
                                >
                                    <option value="All">All Deals</option>
                                    {deals.map(d => (
                                        <option key={d.id} value={d.id}>Deal: {d.name}</option>
                                    ))}
                                </select>
                            )}

                            {/* Validity Filter */}
                            <select
                                value={validityFilter}
                                onChange={(e) => setValidityFilter(e.target.value)}
                                className={`bg-slate-900 border px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 ${validityFilter !== 'All' ? 'border-blue-500/60 text-blue-300' : 'border-slate-700 text-slate-300'}`}
                            >
                                <option value="All">All Dates</option>
                                <option value="valid">Valid Proposals</option>
                                <option value="expired">Expired Proposals</option>
                            </select>

                            {/* Clear Filters Button */}
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="text-xs text-rose-400 hover:text-rose-300 underline font-medium px-1"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>

                        {/* Bulk Action Context Toolbar */}
                        {selectedQuoteIds.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs animate-in fade-in">
                                <span className="font-semibold text-blue-300">
                                    {selectedQuoteIds.length} selected
                                </span>
                                <span className="text-slate-600">|</span>
                                <button
                                    type="button"
                                    onClick={handleExportSelected}
                                    className="text-slate-200 hover:text-white font-medium underline"
                                >
                                    Export CSV
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedQuoteIds([])}
                                    className="text-slate-400 hover:text-slate-200 ml-1"
                                >
                                    Deselect
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sandbox limit notice */}
                    {isSandboxMode && isLimited(filteredQuotes.length) && (
                        <div className="mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm flex items-center gap-2">
                            <span className="font-semibold">Sandbox mode:</span>
                            showing {sandboxEntryLimit} of {filteredQuotes.length} quotes — full list visible in production.
                        </div>
                    )}

                    {/* Table View */}
                    {paginatedQuotes.length === 0 ? (
                        <div className="text-center py-16 bg-slate-900/50 border border-slate-700 rounded-lg">
                            <FileText className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                            <h3 className="text-lg font-medium text-slate-300 mb-2">No quotes found</h3>
                            <p className="text-slate-400 mb-4 text-sm">
                                {hasActiveFilters
                                    ? 'Try adjusting your filters'
                                    : 'Create your first quote to get started'}
                            </p>
                            {hasActiveFilters ? (
                                <button
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Clear Filters
                                </button>
                            ) : (
                                canCreateQuote && (
                                    <button
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create Quote
                                    </button>
                                )
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Table
                                data={paginatedQuotes}
                                columns={columns}
                                isLoading={isLoading}
                                onRowClick={(quote) => openQuote(quote.id)}
                            />

                            {/* Pagination Controls */}
                            {effectiveQuotes.length > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-slate-900/70 border border-slate-800 rounded-lg text-xs text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <span>Show</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            {[10, 25, 50, 100].map((size) => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                        <span>of {effectiveQuotes.length} quotes</span>
                                        {selectedQuoteIds.length > 0 && (
                                            <span className="text-blue-400 ml-2 font-medium">
                                                ({selectedQuoteIds.length} selected across pages)
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Prev
                                        </button>
                                        <span className="px-3 py-1 text-slate-300 font-medium">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Last
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'approvals' && (
                <div className="space-y-4">
                    {/* Approvals Filters & Search */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                            {[
                                { id: 'pending', label: 'Pending', count: approvals.filter(a => a.approver_status === 'pending').length },
                                { id: 'approved', label: 'Approved', count: approvals.filter(a => a.approver_status === 'approved').length },
                                { id: 'rejected', label: 'Rejected', count: approvals.filter(a => a.approver_status === 'rejected').length },
                                { id: 'all', label: 'All', count: approvals.length },
                            ].map((subtab) => (
                                <button
                                    key={subtab.id}
                                    onClick={() => setApprovalsStatusFilter(subtab.id as any)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                        approvalsStatusFilter === subtab.id
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                                >
                                    <span>{subtab.label}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                        approvalsStatusFilter === subtab.id
                                            ? 'bg-blue-700 text-blue-100'
                                            : 'bg-slate-800 text-slate-400'
                                    }`}>
                                        {subtab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search approvals..."
                                value={approvalsSearchTerm}
                                onChange={(e) => setApprovalsSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-xs"
                            />
                        </div>
                    </div>

                    {/* Approvals Table */}
                    {filteredApprovals.length === 0 ? (
                        <div className="text-center py-16 bg-slate-900/50 border border-slate-700 rounded-lg">
                            <CheckCircle className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                            <h3 className="text-lg font-medium text-slate-300 mb-2">No approval requests found</h3>
                            <p className="text-slate-400 text-sm">
                                {approvalsStatusFilter === 'pending'
                                    ? "You're all caught up! There are no quotes awaiting your approval."
                                    : 'No quotes match the selected filter.'}
                            </p>
                        </div>
                    ) : (
                        <Table
                            data={filteredApprovals}
                            columns={approvalColumns}
                            onRowClick={(item) => openQuote(item.quote_id)}
                        />
                    )}
                </div>
            )}

            {/* Portal Row Action Menu (⋮) */}
            {activeActionMenuId && activeMenuQuote && createPortal(
                <div
                    ref={actionMenuRef}
                    style={actionMenuStyle}
                    className="w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden py-1 text-xs animate-in fade-in duration-100"
                >
                    <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400 font-mono font-semibold">
                        {activeMenuQuote.quote_number}
                    </div>
                    <button
                        type="button"
                        onClick={() => { setActiveActionMenuId(null); openQuote(activeMenuQuote.id); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-left"
                    >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        View Quote Details
                    </button>
                    {activeMenuQuote.status === 'draft' && (
                        <button
                            type="button"
                            onClick={() => { setActiveActionMenuId(null); navigate(`/crm/quotes/${activeMenuQuote.id}?edit=true`); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-left"
                        >
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Edit Quote
                        </button>
                    )}
                    {activeMenuQuote.status === 'draft' && (
                        <button
                            type="button"
                            onClick={() => { setActiveActionMenuId(null); handleStatusAction(activeMenuQuote, 'submit'); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-amber-300 hover:bg-amber-500/10 transition-colors text-left"
                        >
                            <Send className="w-3.5 h-3.5 text-amber-400" />
                            Submit for Approval
                        </button>
                    )}
                    {activeMenuQuote.status === 'approved' && (
                        <button
                            type="button"
                            onClick={() => { setActiveActionMenuId(null); handleStatusAction(activeMenuQuote, 'convert'); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-blue-300 hover:bg-blue-500/10 transition-colors text-left"
                        >
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                            Convert to Order
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => { setActiveActionMenuId(null); handlePrintQuote(activeMenuQuote); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-left"
                    >
                        <Printer className="w-3.5 h-3.5 text-slate-400" />
                        Print Quote
                    </button>
                    <button
                        type="button"
                        onClick={() => { setActiveActionMenuId(null); openQuote(activeMenuQuote.id); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-left"
                    >
                        <Send className="w-3.5 h-3.5 text-slate-400" />
                        Email to Customer
                    </button>
                    {canCreateQuote && activeMenuQuote.status === 'draft' && (
                        <>
                            <div className="my-1 border-t border-slate-800" />
                            <button
                                type="button"
                                onClick={() => { setActiveActionMenuId(null); setShowDeleteConfirm(activeMenuQuote.id); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                            >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                Delete Quote
                            </button>
                        </>
                    )}
                </div>,
                document.body
            )}

            {/* Create Quote Modal */}
            {isCreateModalOpen && createPortal(
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md">
                        <div className="px-6 pt-6 pb-2">
                            <h2 className="text-xl font-semibold text-slate-100 mb-4">Create New Quote</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Select Deal *
                                    </label>
                                    <div ref={dealDropdownRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => { setDealDropdownOpen(o => !o); setDealSearchTerm(''); }}
                                            className="w-full flex items-center justify-between px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:border-slate-600"
                                        >
                                            {selectedDealId ? (() => {
                                                const d = deals.find(d => d.id === selectedDealId);
                                                return d ? (
                                                    <span className="flex flex-col min-w-0">
                                                        <span className="text-slate-100 text-sm font-medium truncate">{d.name}</span>
                                                        {d.company_name && <span className="text-slate-400 text-xs truncate">{d.company_name}</span>}
                                                    </span>
                                                ) : <span className="text-slate-400 text-sm">Select a deal...</span>;
                                            })() : <span className="text-slate-400 text-sm">Select a deal...</span>}
                                            <ChevronDown className={`ml-2 h-4 w-4 text-slate-400 shrink-0 transition-transform ${dealDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {dealDropdownOpen && (
                                            <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                                                <div className="p-2 border-b border-slate-700">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder="Search deals..."
                                                            value={dealSearchTerm}
                                                            onChange={e => setDealSearchTerm(e.target.value)}
                                                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        />
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
                                                                    className={`w-full flex flex-col items-start px-4 py-2.5 text-left hover:bg-slate-700 transition-colors ${selectedDealId === deal.id ? 'bg-blue-600/20' : ''}`}
                                                                >
                                                                    <span className={`text-sm font-medium truncate w-full ${selectedDealId === deal.id ? 'text-blue-300' : 'text-slate-100'}`}>{deal.name}</span>
                                                                    {deal.company_name && <span className="text-xs text-slate-400 truncate w-full mt-0.5">{deal.company_name}</span>}
                                                                </button>
                                                            </li>
                                                        ))
                                                    }
                                                    {deals.filter(d =>
                                                        !dealSearchTerm ||
                                                        d.name.toLowerCase().includes(dealSearchTerm.toLowerCase()) ||
                                                        (d.company_name || '').toLowerCase().includes(dealSearchTerm.toLowerCase())
                                                    ).length === 0 && (
                                                        <li className="px-4 py-3 text-sm text-slate-500 text-center">No deals found</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-800/50 border-t border-slate-700 rounded-b-lg">
                            <button
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setSelectedDealId('');
                                    setDealDropdownOpen(false);
                                    setDealSearchTerm('');
                                }}
                                className="px-4 py-2 text-slate-300 hover:text-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateQuote}
                                disabled={!selectedDealId}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            >
                                Create Quote
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Reject Reason Modal */}
            {rejectTarget && createPortal(
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-lg font-semibold text-slate-100 mb-2">Reject Quote</h2>
                        <p className="text-xs text-slate-400 mb-3">
                            Please provide a reason for rejecting this quote. Rejection reasons are mandatory.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (mandatory) *"
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                                className="px-4 py-2 text-slate-300 hover:text-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
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
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirm Dialog */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-semibold text-slate-100 mb-2">Delete Quote?</h2>
                        <p className="text-slate-400 mb-6">
                            Are you sure you want to delete{' '}
                            <span className="text-slate-200 font-medium">
                                {(() => {
                                    const target = quotes.find(q => q.id === showDeleteConfirm);
                                    return target ? `${target.quote_number}${target.title ? ` – ${target.title}` : ''}` : 'this quote';
                                })()}
                            </span>
                            ? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 text-slate-300 hover:text-slate-50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteQuote(showDeleteConfirm)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60"
                            >
                                {isDeleting ? 'Deleting…' : 'Delete Quote'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default QuotesPage;
