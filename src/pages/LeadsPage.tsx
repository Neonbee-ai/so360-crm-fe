import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, User as UserIcon, Mail, Phone, Calendar } from 'lucide-react';
import { crmService } from '../services/crmService';
import { Lead } from '../types/crm';
import { Table } from '../components/common/Table';
import { CreateLeadModal } from '../components/leads/CreateLeadModal';

const LeadsPage = () => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchLeads = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await crmService.getLeads();
            setLeads(data);
        } catch (err: any) {
            console.error('Failed to fetch leads', err);
            setError(err.message || 'Failed to load leads');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const filteredLeads = leads.filter(lead => {
        const matchesSearch =
            lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.contact_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const columns = [
        {
            header: 'Company & Contact',
            accessor: (lead: Lead) => (
                <div className="flex flex-col gap-1">
                    <span className="font-semibold text-white">{lead.company_name}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <UserIcon size={12} /> {lead.contact_name}
                    </span>
                </div>
            )
        },
        {
            header: 'Communication',
            accessor: (lead: Lead) => (
                <div className="flex flex-col gap-1 text-slate-400">
                    <span className="flex items-center gap-1.5"><Mail size={14} /> {lead.contact_email}</span>
                    {lead.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {lead.phone}</span>}
                </div>
            )
        },
        {
            header: 'Owner',
            accessor: (lead: Lead) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold overflow-hidden border border-slate-700">
                        {lead.owner.avatar_url ? <img src={lead.owner.avatar_url} alt={lead.owner.full_name} /> : lead.owner.full_name.charAt(0)}
                    </div>
                    <span className="text-slate-300">{lead.owner.full_name}</span>
                </div>
            )
        },
        {
            header: 'Status',
            accessor: (lead: Lead) => {
                const colors: any = {
                    'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    'Qualified': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    'Won': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    'Lost': 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[lead.status]}`}>
                        {lead.status}
                    </span>
                );
            }
        },
        {
            header: 'Created',
            accessor: (lead: Lead) => (
                <span className="text-slate-400 flex items-center gap-1.5 text-xs">
                    <Calendar size={14} />
                    {new Date(lead.created_at).toLocaleDateString()}
                </span>
            )
        }
    ];

    return (
        <div className="p-8">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Leads & Accounts</h1>
                    <p className="text-slate-400 mt-1">Single source of truth for business deals</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                >
                    <Plus size={20} />
                    Create Lead
                </button>
            </header>

            <CreateLeadModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchLeads}
                existingLeads={leads.map(l => l.company_name)}
            />

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                    <input
                        type="text"
                        placeholder="Search company or contact..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 pl-12 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-slate-200"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-1">
                        <Filter size={16} className="text-slate-500" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent text-sm text-slate-300 focus:outline-none py-1.5 cursor-pointer"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="Qualified">Qualified</option>
                            <option value="Won">Won</option>
                            <option value="Lost">Lost</option>
                        </select>
                    </div>
                </div>
            </div>

            <Table
                data={filteredLeads}
                columns={columns}
                isLoading={isLoading}
                onRowClick={(lead) => navigate(`${lead.id}`)}
                emptyMessage={error || "No leads found. Start by adding your first lead."}
            />
        </div>
    );
};

export default LeadsPage;
