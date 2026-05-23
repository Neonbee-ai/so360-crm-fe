import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserCheck, Plus, ChevronUp, ChevronDown, ChevronsUpDown, DollarSign, BarChart2 } from 'lucide-react';
import { partnersApi, settingsApi } from '../services/crmService';
import { Table } from '../components/common/Table';

type SortField = 'contact_name' | 'partner_type' | 'grading' | 'total_deals' | 'total_deal_value';
type SortDirection = 'asc' | 'desc' | null;

const GRADING_CONFIG: Record<string, { label: string; color: string }> = {
    low:  { label: 'Low',  color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
    mid:  { label: 'Mid',  color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    high: { label: 'High', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

interface CreatePartnerModalProps {
    partnerTypes: any[];
    onClose: () => void;
    onCreated: () => void;
}

const CreatePartnerModal = ({ partnerTypes, onClose, onCreated }: CreatePartnerModalProps) => {
    const [form, setForm] = useState({
        contact_name: '',
        email: '',
        phone: '',
        partner_type: '',
        grading: '',
        commission_rate: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.contact_name.trim() || !form.partner_type) {
            setError('Name and partner type are required.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await partnersApi.create({
                ...form,
                commission_rate: form.commission_rate ? parseFloat(form.commission_rate) : 0,
            });
            onCreated();
        } catch (err: any) {
            setError(err.message || 'Failed to create partner');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-lg font-semibold text-white mb-5">Add Partner</h2>
                {error && <p className="text-rose-400 text-sm mb-3">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Name *</label>
                        <input
                            type="text"
                            value={form.contact_name}
                            onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            placeholder="Partner name"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="email@example.com"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Phone</label>
                            <input
                                type="text"
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="+91 98765 43210"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Partner Type *</label>
                        <select
                            value={form.partner_type}
                            onChange={e => setForm(f => ({ ...f, partner_type: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            <option value="">Select type...</option>
                            {partnerTypes.map(pt => (
                                <option key={pt.value} value={pt.value}>{pt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Grading</label>
                            <select
                                value={form.grading}
                                onChange={e => setForm(f => ({ ...f, grading: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <option value="">Select...</option>
                                <option value="low">Low</option>
                                <option value="mid">Mid</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Commission Rate (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={form.commission_rate}
                                onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Creating...' : 'Create Partner'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PartnersPage = () => {
    const navigate = useNavigate();
    const [partners, setPartners] = useState<any[]>([]);
    const [partnerTypes, setPartnerTypes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [sortField, setSortField] = useState<SortField | null>('contact_name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [partnersData, typesData] = await Promise.all([
                partnersApi.getAll(),
                settingsApi.partnerTypes.getAll().catch(() => []),
            ]);
            setPartners(partnersData || []);
            setPartnerTypes(typesData || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load partners');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDirection === 'asc') setSortDirection('desc');
            else if (sortDirection === 'desc') { setSortField(null); setSortDirection(null); }
            else setSortDirection('asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ChevronsUpDown size={14} className="text-slate-600" />;
        if (sortDirection === 'asc') return <ChevronUp size={14} className="text-blue-400" />;
        if (sortDirection === 'desc') return <ChevronDown size={14} className="text-blue-400" />;
        return <ChevronsUpDown size={14} className="text-slate-600" />;
    };

    const SortableHeader = ({ label, field }: { label: string; field: SortField }) => (
        <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
            {label}
            <SortIcon field={field} />
        </button>
    );

    const filteredPartners = useMemo(() => {
        let result = partners.filter(p => {
            const matchesSearch = !searchTerm ||
                (p.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.company_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === 'All' || p.partner_type === typeFilter;
            return matchesSearch && matchesType;
        });

        if (sortField && sortDirection) {
            result = [...result].sort((a, b) => {
                let aVal: any, bVal: any;
                switch (sortField) {
                    case 'contact_name': aVal = a.contact_name || ''; bVal = b.contact_name || ''; break;
                    case 'partner_type': aVal = a.partner_type || ''; bVal = b.partner_type || ''; break;
                    case 'grading': aVal = a.grading || ''; bVal = b.grading || ''; break;
                    case 'total_deals': aVal = a.total_deals || 0; bVal = b.total_deals || 0; break;
                    case 'total_deal_value': aVal = a.total_deal_value || 0; bVal = b.total_deal_value || 0; break;
                    default: return 0;
                }
                if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }
        return result;
    }, [partners, searchTerm, typeFilter, sortField, sortDirection]);

    const totalPages = Math.ceil(filteredPartners.length / pageSize);
    const paginatedPartners = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPartners.slice(start, start + pageSize);
    }, [filteredPartners, currentPage, pageSize]);

    const GradingBadge = ({ grading }: { grading?: string }) => {
        if (!grading) return <span className="text-slate-600 text-sm">-</span>;
        const config = GRADING_CONFIG[grading] || GRADING_CONFIG.low;
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.color}`}>
                {config.label}
            </span>
        );
    };

    const getPartnerTypeLabel = (value: string) => {
        const found = partnerTypes.find(pt => pt.value === value);
        return found?.label || value || '-';
    };

    const totals = useMemo(() => ({
        total: partners.length,
        totalDeals: partners.reduce((s, p) => s + (p.total_deals || 0), 0),
        totalValue: partners.reduce((s, p) => s + (p.total_deal_value || 0), 0),
        pendingCommission: partners.reduce((s, p) => s + (p.pending_commission || 0), 0),
    }), [partners]);

    const columns = [
        {
            header: <SortableHeader label="Name" field="contact_name" />,
            accessor: (p: any) => (
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-white">{p.contact_name}</span>
                    {p.email && <span className="text-xs text-slate-500">{p.email}</span>}
                </div>
            ),
        },
        {
            header: <SortableHeader label="Type" field="partner_type" />,
            accessor: (p: any) => (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {getPartnerTypeLabel(p.partner_type)}
                </span>
            ),
        },
        {
            header: <SortableHeader label="Grading" field="grading" />,
            accessor: (p: any) => <GradingBadge grading={p.grading} />,
        },
        {
            header: <SortableHeader label="Deals" field="total_deals" />,
            accessor: (p: any) => (
                <span className="text-slate-300 text-sm font-medium">{p.total_deals || 0}</span>
            ),
        },
        {
            header: <SortableHeader label="Deal Value" field="total_deal_value" />,
            accessor: (p: any) => (
                <span className="text-slate-300 text-sm">
                    {(p.total_deal_value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </span>
            ),
        },
        {
            header: 'Commission Pending',
            accessor: (p: any) => (
                <span className={`text-sm font-medium ${(p.pending_commission || 0) > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {(p.pending_commission || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                </span>
            ),
        },
        {
            header: 'Rate',
            accessor: (p: any) => (
                <span className="text-slate-400 text-sm">{p.commission_rate ? `${p.commission_rate}%` : '-'}</span>
            ),
        },
    ];

    return (
        <div className="p-8">
            <header className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Partners</h1>
                    <p className="text-slate-400 mt-1">Referral agents, resellers, and dealers who bring in deals</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition-colors"
                >
                    <Plus size={16} />
                    Add Partner
                </button>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><UserCheck size={14} /> Total Partners</div>
                    <div className="text-2xl font-bold text-white">{totals.total}</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><BarChart2 size={14} /> Total Deals</div>
                    <div className="text-2xl font-bold text-white">{totals.totalDeals}</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><DollarSign size={14} /> Total Deal Value</div>
                    <div className="text-xl font-bold text-white">{totals.totalValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1"><DollarSign size={14} /> Commission Pending</div>
                    <div className="text-xl font-bold text-white">{totals.pendingCommission.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                    <input
                        type="text"
                        placeholder="Search partners by name, email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                    <option value="All">All Types</option>
                    {partnerTypes.map(pt => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                </select>
                {(searchTerm || typeFilter !== 'All') && (
                    <button onClick={() => { setSearchTerm(''); setTypeFilter('All'); }} className="text-xs text-rose-400 hover:text-rose-300 underline">
                        Clear Filters
                    </button>
                )}
            </div>

            <Table
                data={paginatedPartners}
                columns={columns}
                isLoading={isLoading}
                onRowClick={p => navigate(`../partners/${p.id}`)}
                emptyMessage={error || 'No partners found. Add a partner to get started.'}
            />

            {filteredPartners.length > 0 && (
                <div className="flex items-center justify-between mt-4 px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                    <span className="text-sm text-slate-400">{filteredPartners.length} partners</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-50">First</button>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-50">Prev</button>
                        <span className="px-3 py-1 text-slate-300 text-sm">Page {currentPage} of {Math.max(1, totalPages)}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-50">Next</button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 disabled:opacity-50">Last</button>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <CreatePartnerModal
                    partnerTypes={partnerTypes}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => { setShowCreateModal(false); fetchData(); }}
                />
            )}
        </div>
    );
};

export default PartnersPage;
