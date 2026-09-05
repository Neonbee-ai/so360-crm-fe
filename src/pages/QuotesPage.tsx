import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, FileText, Search, Filter, CheckCircle, XCircle, Clock, Send, Trash2, ChevronDown, Eye, User, Inbox, Check, X } from 'lucide-react';
import { crmService } from '../services/crmService';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { Quote, QuoteStatus, Deal } from '../types/crm';
import { Table } from '../components/common/Table';
import { useBusinessSettings, useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import { QuotaBar, QuotaGate, CrossLinkChip, toast } from '@so360/design-system';

const statusColors: Record<QuoteStatus, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Draft' },
    pending_approval: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Pending Approval' },
    approved: { bg: 'bg-green-500/20', text: 'text-green-300', label: 'Approved' },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Rejected' },
    converted: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Converted' },
    expired: { bg: 'bg-gray-500/20', text: 'text-gray-300', label: 'Expired' },
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
        <div onClick={(e) => e.stopPropagation()}>
            <button
                ref={btnRef}
                onClick={openDropdown}
                disabled={isActionLoading}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${status.bg} ${status.text} ${transitions.length > 0 ? 'cursor-pointer hover:brightness-125' : 'cursor-default'} disabled:opacity-50`}
                title={transitions.length > 0 ? 'Click to update status' : status.label}
            >
                {status.label}
                {transitions.length > 0 && <ChevronDown className="w-3 h-3 opacity-60" />}
            </button>
            {isOpen && transitions.length > 0 && createPortal(
                <div style={dropdownStyle} className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden w-44">
                    <div className="py-1">
                        {transitions.map(t => (
                            <button
                                key={t.action}
                                // onMouseDown fires before the document mousedown outside-click
                                // listener, so stopPropagation prevents it from closing the
                                // dropdown before the action callback executes.
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

const QuotesPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    /**
     * Open a quote, recording where the reader came from.
     *
     * Quote Detail's Back control reads this back. Without it the control fell
     * through to raw history, and a quote that links onward to its deal could
     * send the reader to Deal Details instead of the list they started on.
     * The search string travels too, so filters and paging survive the return.
     */
    const openQuote = (quoteId: string) =>
        navigate(`/crm/quotes/${quoteId}`, { state: { from: `${location.pathname}${location.search}` } });
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateQuote = (shell?.permissionsLoaded === true) && (shell?.hasPermission?.('quotes.create') ?? false) && (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:quotes:create') ?? true);
    const quotaChecks = useMemo(() => [{ module_code: 'crm', quota_key: 'max_quotes' }], []);
    const { getQuota } = useQuota({ checks: quotaChecks, orgId: shell?.currentOrg?.id || '' });
    const quotaData = getQuota('max_quotes');
    const { isSandboxMode, sandboxEntryLimit, isLimited } = useSandboxLimit();

    // Use dynamic formatters from business settings
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'XXX',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });

    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // View state survives a trip to a quote's detail page and back.
    const [searchTerm, setSearchTerm] = usePersistedState('quotes.search', '');
    const [statusFilter, setStatusFilter] = usePersistedState<string>('quotes.status', 'All');

    const listAnchorRef = useRef<HTMLDivElement>(null);
    useListScrollRestore('quotes', listAnchorRef, !isLoading);
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
    // View mode: 'all' = All Quotes, 'approvals' = Approvals Inbox
    const [activeTab, setActiveTab] = usePersistedState<'all' | 'approvals'>('quotes.activeTab', 'all');
    const [approvals, setApprovals] = useState<any[]>([]);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
    const [approvalsStatusFilter, setApprovalsStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [approvalsSearchTerm, setApprovalsSearchTerm] = useState('');

    const fetchApprovals = async () => {
        try {
            const data = await crmService.getApprovalsInbox();
            const list = Array.isArray(data) ? data : [];
            setApprovals(list);
            const pending = list.filter((a: any) => a.approver_status === 'pending');
            setPendingApprovalsCount(pending.length);
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

    const filteredQuotes = quotes.filter(quote => {
        const matchesSearch = !searchTerm ||
            quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            quote.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            quote.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || quote.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleCreateQuote = async () => {
        if (!selectedDealId) return;
        try {
            // Only the deal is sent. Title, customer and line items are derived by
            // crm-be from the deal and its products — a hard-coded 'New Quote' with
            // an empty `lines` array suppressed that derivation and forced the
            // seller to retype data the CRM already holds.
            const newQuote = await crmService.createQuote({ deal_id: selectedDealId });
            recordActivity({ eventType: 'quote.created', eventCategory: 'crm', description: `Created quote for deal`, resourceType: 'quote', resourceId: newQuote.id }).catch(() => {});
            navigate(`/crm/quotes/${newQuote.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to create quote');
        }
    };

    // Performs the actual API call — called after rejection reason is collected
    const executeStatusAction = async (quote: Quote, action: 'submit' | 'approve' | 'reject' | 'convert') => {
        setActionLoading(quote.id + action);
        try {
            if (action === 'submit')  await crmService.submitQuoteForApproval(quote.id);
            if (action === 'approve') await crmService.approveQuote(quote.id);
            if (action === 'reject')  await crmService.rejectQuote(quote.id, rejectReason);
            if (action === 'convert') await crmService.convertQuoteToOrder(quote.id);
            setRejectTarget(null);
            setRejectReason('');
            await fetchData();
        } catch (err: any) {
            setError(err.message || `Failed to ${action} quote`);
        } finally {
            setActionLoading(null);
        }
    };

    // Dispatch: reject opens the reason modal; all other actions execute immediately
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
            setQuotes(quotes.filter(q => q.id !== quoteId));
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

    // Format functions now use dynamic settings
    const formatCurrency = (value: number) => formatters.formatCurrency(value);
    const formatDate = (dateString: string) => formatters.formatDate(dateString, { year: 'numeric', month: 'short', day: 'numeric' });

    const columns = [
        {
            key: 'quote_number',
            header: 'Quote #',
            accessor: (quote: Quote) => (
                <button
                    onClick={() => openQuote(quote.id)}
                    className="text-blue-400 hover:text-blue-300 font-medium"
                >
                    {quote.quote_number || `Q-${quote.id.slice(0, 8)}`}
                </button>
            )
        },
        {
            key: 'title',
            header: 'Title',
            accessor: (quote: Quote) => (
                <span className="text-slate-200">{quote.title || 'Untitled Quote'}</span>
            )
        },
        {
            key: 'customer',
            header: 'Customer',
            accessor: (quote: Quote) => (
                <span className="text-slate-300">{quote.customer_name || quote.deal?.company_name || '-'}</span>
            )
        },
        {
            key: 'deal',
            header: 'Deal',
            accessor: (quote: Quote) =>
                quote.deal_id ? (
                    <CrossLinkChip type="crm.deal" id={quote.deal_id} label={quote.deal?.name} compact />
                ) : (
                    <span className="text-slate-500">-</span>
                )
        },
        {
            key: 'total',
            header: 'Total',
            accessor: (quote: Quote) => (
                <span className="text-slate-200 font-medium">{formatCurrency(quote.grand_total || 0)}</span>
            )
        },
        {
            key: 'status',
            header: (
                <span className="flex items-center gap-1.5">
                    Status
                    {statusFilter !== 'All' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {statusColors[statusFilter as QuoteStatus]?.label ?? statusFilter}
                        </span>
                    )}
                </span>
            ),
            accessor: (quote: Quote) => (
                <QuoteStatusCell
                    quote={quote}
                    isActionLoading={!!actionLoading}
                    onAction={handleStatusAction}
                />
            )
        },
        {
            key: 'valid_until',
            header: 'Valid Until',
            accessor: (quote: Quote) => {
                if (!quote.valid_until) return <span className="text-slate-500">-</span>;
                const isExpired = new Date(quote.valid_until) < new Date();
                if (isExpired) {
                    return (
                        <span className="flex items-center gap-1.5">
                            <span className="text-red-400/70 line-through text-xs">{formatDate(quote.valid_until)}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">Expired</span>
                        </span>
                    );
                }
                return <span className="text-slate-400">{formatDate(quote.valid_until)}</span>;
            }
        },
        {
            key: 'created_at',
            header: 'Created',
            accessor: (quote: Quote) => (
                <span className="text-slate-400">{formatDate(quote.created_at)}</span>
            )
        },
        {
            key: 'actions',
            header: '',
            accessor: (quote: Quote) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); openQuote(quote.id); }}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                        title="View"
                    >
                        <FileText className="w-4 h-4" />
                    </button>
                    {canCreateQuote && quote.status === 'draft' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(quote.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )
        }
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
                    className="text-blue-400 hover:text-blue-300 font-medium text-left"
                >
                    {item.quote_number || `Q-${item.quote_id.slice(0, 8)}`}
                </button>
            )
        },
        {
            key: 'title',
            header: 'Title',
            accessor: (item: any) => (
                <span className="text-slate-200">{item.title || 'Untitled Quote'}</span>
            )
        },
        {
            key: 'customer',
            header: 'Customer',
            accessor: (item: any) => (
                <span className="text-slate-300">{item.customer_name || '-'}</span>
            )
        },
        {
            key: 'amount',
            header: 'Amount',
            accessor: (item: any) => (
                <span className="text-slate-200 font-medium">{formatCurrency(Number(item.total_amount || 0))}</span>
            )
        },
        {
            key: 'requested_by',
            header: 'Submitted By',
            accessor: (item: any) => (
                <span className="text-slate-300 text-xs">{item.requested_by || 'Unknown'}</span>
            )
        },
        {
            key: 'requested_at',
            header: 'Submitted At',
            accessor: (item: any) => (
                <span className="text-slate-400 text-xs">{item.requested_at ? formatDate(item.requested_at) : '-'}</span>
            )
        },
        {
            key: 'other_approvers',
            header: 'Reviewers',
            accessor: (item: any) => {
                const others = item.all_approvers || [];
                if (others.length === 0) return <span className="text-slate-500 text-xs">-</span>;
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
            }
        },
        {
            key: 'status',
            header: 'Your Decision',
            accessor: (item: any) => {
                if (item.approver_status === 'approved') {
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            Approved
                        </span>
                    );
                }
                if (item.approver_status === 'rejected') {
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <X className="w-3 h-3" />
                            Rejected
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        Pending
                    </span>
                );
            }
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
            )
        }
    ];

    if (isLoading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-slate-800 rounded w-48" />
                    <div className="h-64 bg-slate-800 rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-8" ref={listAnchorRef}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Quotes</h1>
                    <p className="text-sm text-slate-400 mt-1">Manage sales quotes and proposals</p>
                </div>
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
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Quote
                        </button>
                    </QuotaGate>
                )}
            </div>

            {quotaData && (
                <QuotaBar
                    label="Quotes"
                    used={quotaData.current_usage}
                    limit={quotaData.limit}
                    isUnlimited={quotaData.is_unlimited}
                    className="mb-6"
                />
            )}

            {error && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
                    {error}
                </div>
            )}

            {/* View Switcher Tabs: All Quotes | Approvals */}
            <div className="flex items-center gap-2 border-b border-slate-800 mb-6">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
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
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
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
                            className="ml-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                        >
                            {pendingApprovalsCount}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'all' && (
                <>
                    {/* Filters */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search quotes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div ref={statusDropdownRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setStatusDropdownOpen(o => !o)}
                                className={`flex items-center gap-2 px-3 py-2 bg-slate-800 border rounded-lg text-sm transition-colors hover:border-slate-600 ${statusFilter !== 'All' ? 'border-blue-500/60 text-blue-300' : 'border-slate-700 text-slate-300'}`}
                            >
                                <Filter className={`w-4 h-4 flex-shrink-0 ${statusFilter !== 'All' ? 'text-blue-400' : 'text-slate-400'}`} />
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
                                <div className="absolute left-0 top-full mt-1 z-20 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                                    <div className="py-1">
                                        <button
                                            type="button"
                                            onClick={() => { setStatusFilter('All'); setStatusDropdownOpen(false); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-700 transition-colors ${statusFilter === 'All' ? 'text-blue-300 bg-blue-600/10' : 'text-slate-300'}`}
                                        >
                                            <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                                            All Status
                                        </button>
                                        {(Object.entries(statusColors) as [QuoteStatus, typeof statusColors[QuoteStatus]][]).map(([value, cfg]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => { setStatusFilter(value); setStatusDropdownOpen(false); }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-700 transition-colors ${statusFilter === value ? 'bg-blue-600/10' : ''}`}
                                            >
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                                                    {cfg.label}
                                                </span>
                                                <span className="ml-auto text-xs text-slate-500">
                                                    {quotes.filter(q => q.status === value).length}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mb-6 bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-700">
                                <tr>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Count</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {[
                                    { label: 'Total Quotes', value: quotes.length, icon: FileText, textColor: 'text-blue-400' },
                                    { label: 'Draft', value: quotes.filter(q => q.status === 'draft').length, icon: Clock, textColor: 'text-slate-300' },
                                    { label: 'Pending Approval', value: quotes.filter(q => q.status === 'pending_approval').length, icon: Send, textColor: 'text-amber-400' },
                                    { label: 'Approved', value: quotes.filter(q => q.status === 'approved').length, icon: CheckCircle, textColor: 'text-green-400' },
                                ].map((stat) => (
                                    <tr key={stat.label} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <stat.icon className={`w-4 h-4 ${stat.textColor} shrink-0`} />
                                                <span className="text-slate-300">{stat.label}</span>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-semibold ${stat.textColor}`}>{stat.value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Sandbox limit notice */}
                    {isSandboxMode && isLimited(filteredQuotes.length) && (
                        <div className="mb-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm flex items-center gap-2">
                            <span className="font-semibold">Sandbox mode:</span>
                            showing {sandboxEntryLimit} of {filteredQuotes.length} quotes — full list visible in production.
                        </div>
                    )}

                    {/* Table */}
                    {(isSandboxMode ? filteredQuotes.slice(0, sandboxEntryLimit) : filteredQuotes).length === 0 ? (
                        <div className="text-center py-16 bg-slate-900/50 border border-slate-700 rounded-lg">
                            <FileText className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                            <h3 className="text-lg font-medium text-slate-300 mb-2">No quotes found</h3>
                            <p className="text-slate-400 mb-4">
                                {searchTerm || statusFilter !== 'All'
                                    ? 'Try adjusting your filters'
                                    : 'Create your first quote to get started'}
                            </p>
                            {canCreateQuote && <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Create Quote
                            </button>}
                        </div>
                    ) : (
                        <Table
                            data={isSandboxMode ? filteredQuotes.slice(0, sandboxEntryLimit) : filteredQuotes}
                            columns={columns}
                            onRowClick={(quote) => openQuote(quote.id)}
                        />
                    )}
                </>
            )}

            {activeTab === 'approvals' && (
                <div className="space-y-6">
                    {/* Approvals Filters & Search */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
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
                                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
