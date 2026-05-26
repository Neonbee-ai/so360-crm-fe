import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, Filter, MoreHorizontal, CheckCircle, XCircle, Clock, Send, Trash2 } from 'lucide-react';
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

const QuotesPage = () => {
    const navigate = useNavigate();
    const { recordActivity } = useActivity();
    const shell = useShellBridge();
    const canCreateQuote = shell?.isFeatureEnabled?.('action:crm:quotes:create') ?? true;
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

    const handleStatusAction = async (quote: Quote, action: 'submit' | 'approve' | 'reject' | 'convert') => {
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
            accessor: (quote: Quote) => {
                const status = statusColors[quote.status] || statusColors.draft;
                const isFiltered = statusFilter === quote.status;
                const isLoading = (id: string) => actionLoading === quote.id + id;
                return (
                    <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setStatusFilter(isFiltered ? 'All' : quote.status)}
                            title={isFiltered ? 'Click to clear filter' : `Filter by ${status.label}`}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text} transition-opacity hover:opacity-80 ${isFiltered ? 'ring-1 ring-offset-1 ring-offset-slate-950 ring-current' : ''}`}
                        >
                            {status.label}
                        </button>
                        {quote.status === 'draft' && (
                            <button
                                onClick={() => handleStatusAction(quote, 'submit')}
                                disabled={!!actionLoading}
                                className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 transition-colors disabled:opacity-40"
                            >
                                {isLoading('submit') ? '...' : 'Submit'}
                            </button>
                        )}
                        {quote.status === 'pending_approval' && (
                            <>
                                <button
                                    onClick={() => handleStatusAction(quote, 'approve')}
                                    disabled={!!actionLoading}
                                    className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-green-500/20 text-green-300 hover:bg-green-500/40 transition-colors disabled:opacity-40"
                                >
                                    {isLoading('approve') ? '...' : 'Approve'}
                                </button>
                                <button
                                    onClick={() => setRejectTarget(quote.id)}
                                    disabled={!!actionLoading}
                                    className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors disabled:opacity-40"
                                >
                                    Reject
                                </button>
                            </>
                        )}
                        {quote.status === 'approved' && (
                            <button
                                onClick={() => handleStatusAction(quote, 'convert')}
                                disabled={!!actionLoading}
                                className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 transition-colors disabled:opacity-40"
                            >
                                {isLoading('convert') ? '...' : 'Convert'}
                            </button>
                        )}
                    </div>
                );
            }
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
            <div className="flex items-center justify-between mb-6">
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
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                    <Filter className={`w-4 h-4 flex-shrink-0 ${statusFilter !== 'All' ? 'text-blue-400' : 'text-slate-400'}`} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-transparent text-slate-200 focus:outline-none text-sm cursor-pointer"
                    >
                        <option value="All">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="pending_approval">Pending Approval</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="converted">Converted</option>
                        <option value="expired">Expired</option>
                    </select>
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
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold text-slate-100 mb-4">Create New Quote</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Select Deal *
                                    </label>
                                    <select
                                        value={selectedDealId}
                                        onChange={(e) => setSelectedDealId(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select a deal...</option>
                                        {deals.map((deal) => (
                                            <option key={deal.id} value={deal.id}>
                                                {deal.name} - {deal.company_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-800/50 border-t border-slate-700 rounded-b-lg">
                            <button
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setSelectedDealId('');
                                }}
                                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
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
                </div>
            )}

            {/* Reject Reason Modal */}
            {rejectTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
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
                                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const q = quotes.find(q => q.id === rejectTarget)!;
                                    handleStatusAction(q, 'reject');
                                }}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Dialog */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-semibold text-slate-100 mb-2">Delete Quote</h2>
                        <p className="text-slate-400 mb-6">
                            Are you sure you want to delete this quote? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
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
                </div>
            )}
        </div>
    );
};

export default QuotesPage;
