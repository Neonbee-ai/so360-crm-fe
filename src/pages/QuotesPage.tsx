import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, Filter, CheckCircle, XCircle, Clock, Send, Trash2, ChevronDown } from 'lucide-react';
import { crmService } from '../services/crmService';
import { Quote, QuoteStatus, Deal } from '../types/crm';
import { Table } from '../components/common/Table';
import { useBusinessSettings, useActivity, useShellBridge, useQuota, useSandboxLimit } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import { QuotaBar, QuotaGate } from '@so360/design-system';

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
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateQuote = (shell?.effectiveFlagsLoaded !== false) && (shell?.isFeatureEnabled?.('action:crm:quotes:create') ?? true);
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
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedDealId, setSelectedDealId] = useState<string>('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [dealDropdownOpen, setDealDropdownOpen] = useState(false);
    const [dealSearchTerm, setDealSearchTerm] = useState('');
    const dealDropdownRef = useRef<HTMLDivElement>(null);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [quotesData, dealsData] = await Promise.all([
                crmService.getQuotes(),
                crmService.getDeals()
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
            const newQuote = await crmService.createQuote({
                deal_id: selectedDealId,
                title: 'New Quote',
                lines: []
            });
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
        try {
            await crmService.deleteQuote(quoteId);
            setQuotes(quotes.filter(q => q.id !== quoteId));
            setShowDeleteConfirm(null);
        } catch (err: any) {
            setError(err.message || 'Failed to delete quote');
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
                    onClick={() => navigate(`/crm/quotes/${quote.id}`)}
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
                        onClick={() => navigate(`/crm/quotes/${quote.id}`)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                        title="View"
                    >
                        <FileText className="w-4 h-4" />
                    </button>
                    {canCreateQuote && quote.status === 'draft' && (
                        <button
                            onClick={() => setShowDeleteConfirm(quote.id)}
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
        <div className="p-8">
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
                    onRowClick={(quote) => navigate(`/crm/quotes/${quote.id}`)}
                />
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
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-lg font-semibold text-slate-100 mb-3">Reject Quote</h2>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (optional)"
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
                                onClick={() => {
                                    const q = quotes.find(q => q.id === rejectTarget)!;
                                    executeStatusAction(q, 'reject');
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
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
                        <h2 className="text-xl font-semibold text-slate-100 mb-2">Delete Quote</h2>
                        <p className="text-slate-400 mb-6">
                            Are you sure you want to delete this quote? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 text-slate-300 hover:text-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteQuote(showDeleteConfirm)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                                Delete
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
