import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Mail, Phone, Edit2, Loader2, Check, X,
    BarChart2, DollarSign, Trophy, MapPin, Percent, Users,
} from 'lucide-react';
import { partnersApi, settingsApi, crmService } from '../services/crmService';
import { validatePhone } from '../utils/phoneValidation';
import { ToastContainer, useToast } from '../components/common/Toast';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';

type TabType = 'overview' | 'deals' | 'commissions' | 'activity';

const GRADING_CONFIG: Record<string, { label: string; color: string }> = {
    low:  { label: 'Low',  color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
    mid:  { label: 'Mid',  color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    high: { label: 'High', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const COMMISSION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pending',  color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    approved: { label: 'Approved', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    paid:     { label: 'Paid',     color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const AREA_OPTIONS = ['South India', 'North India', 'Central India', 'East India', 'West India'];

interface MarkPaidModalProps {
    commissionId: string;
    onClose: () => void;
    onPaid: () => void;
}

const MarkPaidModal = ({ commissionId, onClose, onPaid }: MarkPaidModalProps) => {
    const [paymentRef, setPaymentRef] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            await partnersApi.updateCommission(commissionId, { status: 'paid', payment_ref: paymentRef });
            onPaid();
        } catch (err: any) {
            setError(err.message || 'Failed to mark as paid');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <h2 className="text-base font-semibold text-white mb-4">Mark Commission as Paid</h2>
                {error && <p className="text-rose-400 text-sm mb-3">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Payment Reference</label>
                        <input
                            type="text"
                            value={paymentRef}
                            onChange={e => setPaymentRef(e.target.value)}
                            placeholder="e.g. NEFT-2026-001"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50">
                            {saving ? 'Saving...' : 'Mark Paid'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

const PartnerDetailPage = () => {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toasts, showSuccess, showError, dismissToast } = useToast();

    const [partner, setPartner] = useState<any>(null);
    const [partnerTypes, setPartnerTypes] = useState<any[]>([]);
    const [deals, setDeals] = useState<any>(null);
    const [commissions, setCommissions] = useState<any>(null);
    const [activities, setActivities] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [saving, setSaving] = useState(false);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [markPaidId, setMarkPaidId] = useState<string | null>(null);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
    });

    const fetchData = useCallback(async () => {
        try {
            const [partnerData, typesData] = await Promise.all([
                partnersApi.getOne(id),
                settingsApi.partnerTypes.getAll().catch(() => []),
            ]);
            setPartner(partnerData);
            setPartnerTypes(typesData || []);
            setEditForm({
                contact_name: partnerData.contact_name || '',
                email: partnerData.email || '',
                phone: partnerData.phone || '',
                partner_type: partnerData.partner_type || '',
                grading: partnerData.grading || '',
                area_served: partnerData.area_served || [],
                commission_rate: partnerData.commission_rate ?? 0,
                poc_primary: partnerData.poc_primary || '',
                poc_secondary: partnerData.poc_secondary || '',
            });
        } catch (err: any) {
            showError('Failed to load partner');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    const fetchDeals = useCallback(async () => {
        try {
            const data = await partnersApi.getDeals(id);
            setDeals(data);
        } catch (err: any) {
            console.error('Failed to load deals', err);
        }
    }, [id]);

    const fetchCommissions = useCallback(async () => {
        try {
            const data = await partnersApi.getCommissions(id);
            setCommissions(data);
        } catch (err: any) {
            console.error('Failed to load commissions', err);
        }
    }, [id]);

    const fetchActivities = useCallback(async () => {
        try {
            const data = await crmService.getActivitiesByLeadId(id);
            setActivities(data || []);
        } catch (err: any) {
            console.error('Failed to load activities', err);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (activeTab === 'deals') fetchDeals();
        else if (activeTab === 'commissions') fetchCommissions();
        else if (activeTab === 'activity') fetchActivities();
    }, [activeTab, fetchDeals, fetchCommissions, fetchActivities]);

    const handleSave = async () => {
        const pErr = validatePhone(editForm.phone ?? '');
        setPhoneError(pErr);
        if (pErr) return;
        setSaving(true);
        try {
            const updated = await partnersApi.update(id, {
                ...editForm,
                commission_rate: parseFloat(editForm.commission_rate) || 0,
                poc_primary: editForm.poc_primary || undefined,
                poc_secondary: editForm.poc_secondary || undefined,
            });
            setPartner(updated);
            setIsEditing(false);
            showSuccess('Partner updated');
        } catch (err: any) {
            showError(err.message || 'Failed to update partner');
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async (commissionId: string) => {
        setApprovingId(commissionId);
        try {
            await partnersApi.updateCommission(commissionId, { status: 'approved' });
            showSuccess('Commission approved');
            fetchCommissions();
        } catch (err: any) {
            showError(err.message || 'Failed to approve commission');
        } finally {
            setApprovingId(null);
        }
    };

    const getTypeLabel = (value: string) => {
        const found = partnerTypes.find(pt => pt.value === value);
        return found?.label || value || '-';
    };

    const tabCls = (tab: TabType) =>
        `flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
            activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                : 'text-slate-500 hover:text-slate-300'
        }`;

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 gap-3 p-8">
                <Loader2 className="animate-spin" />
                <span>Loading partner...</span>
            </div>
        );
    }

    if (!partner) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p>Partner not found.</p>
                <Link to=".." className="text-blue-500 hover:underline mt-4 inline-block">Back to Partners</Link>
            </div>
        );
    }

    const gradingCfg = GRADING_CONFIG[partner.grading] || null;

    return (
        <div className="p-8">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* Header */}
            <header className="mb-8">
                <Link to=".." className="flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors mb-4 group">
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Partners
                </Link>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold text-white">{partner.contact_name}</h1>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                                {getTypeLabel(partner.partner_type)}
                            </span>
                            {gradingCfg && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${gradingCfg.color}`}>
                                    {gradingCfg.label}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-slate-400 text-sm">
                            {partner.email && <span className="flex items-center gap-1.5"><Mail size={14} />{partner.email}</span>}
                            {partner.phone && <span className="flex items-center gap-1.5"><Phone size={14} />{partner.phone}</span>}
                            {partner.commission_rate > 0 && (
                                <span className="flex items-center gap-1.5"><Percent size={14} />{partner.commission_rate}% commission</span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b border-slate-800 mb-6 flex overflow-x-auto">
                <button className={tabCls('overview')} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={tabCls('deals')} onClick={() => setActiveTab('deals')}>Referred Deals</button>
                <button className={tabCls('commissions')} onClick={() => setActiveTab('commissions')}>Commissions</button>
                <button className={tabCls('activity')} onClick={() => setActiveTab('activity')}>Activity</button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Partner Profile</h2>
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <button onClick={() => { setIsEditing(false); }} className="p-1.5 rounded text-slate-400 hover:text-white"><X size={16} /></button>
                                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium disabled:opacity-50">
                                        <Check size={14} />{saving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="p-1.5 rounded text-slate-500 hover:text-white transition-colors">
                                    <Edit2 size={16} />
                                </button>
                            )}
                        </div>

                        {isEditing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Name</label>
                                    <input
                                        value={editForm.contact_name}
                                        onChange={e => setEditForm((f: any) => ({ ...f, contact_name: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Email</label>
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Phone</label>
                                        <input
                                            type="tel"
                                            maxLength={20}
                                            value={editForm.phone}
                                            onChange={e => { setEditForm((f: any) => ({ ...f, phone: e.target.value })); setPhoneError(validatePhone(e.target.value)); }}
                                            className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 ${phoneError ? 'border-rose-500/60 focus:ring-rose-500/50' : 'border-slate-800 focus:ring-blue-500/50'}`}
                                        />
                                        {phoneError && <p className="text-rose-400 text-xs mt-1">{phoneError}</p>}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Partner Type</label>
                                    <select
                                        value={editForm.partner_type}
                                        onChange={e => setEditForm((f: any) => ({ ...f, partner_type: e.target.value }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    >
                                        <option value="">Select...</option>
                                        {partnerTypes.map(pt => (
                                            <option key={pt.value} value={pt.value}>{pt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Grading</label>
                                        <select
                                            value={editForm.grading}
                                            onChange={e => setEditForm((f: any) => ({ ...f, grading: e.target.value }))}
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
                                            value={editForm.commission_rate}
                                            onChange={e => setEditForm((f: any) => ({ ...f, commission_rate: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Area Served</label>
                                    <div className="flex flex-wrap gap-2">
                                        {AREA_OPTIONS.map(area => {
                                            const selected = (editForm.area_served || []).includes(area);
                                            return (
                                                <button
                                                    key={area}
                                                    type="button"
                                                    onClick={() => {
                                                        setEditForm((f: any) => ({
                                                            ...f,
                                                            area_served: selected
                                                                ? (f.area_served || []).filter((a: string) => a !== area)
                                                                : [...(f.area_served || []), area],
                                                        }));
                                                    }}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                                        selected
                                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                                                    }`}
                                                >
                                                    {area}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <dl className="space-y-3">
                                <div className="flex justify-between">
                                    <dt className="text-xs text-slate-500">Partner Type</dt>
                                    <dd className="text-sm text-white">{getTypeLabel(partner.partner_type)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-xs text-slate-500">Grading</dt>
                                    <dd>
                                        {gradingCfg ? (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${gradingCfg.color}`}>
                                                {gradingCfg.label}
                                            </span>
                                        ) : <span className="text-slate-500 text-sm">-</span>}
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-xs text-slate-500">Commission Rate</dt>
                                    <dd className="text-sm text-white">{partner.commission_rate ? `${partner.commission_rate}%` : '-'}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-xs text-slate-500">Email</dt>
                                    <dd className="text-sm text-slate-300">{partner.email || '-'}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-xs text-slate-500">Phone</dt>
                                    <dd className="text-sm text-slate-300">{partner.phone || '-'}</dd>
                                </div>
                                <div className="flex justify-between items-start">
                                    <dt className="text-xs text-slate-500">Area Served</dt>
                                    <dd className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                                        {(partner.area_served || []).length > 0
                                            ? partner.area_served.map((area: string) => (
                                                <span key={area} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-slate-800 text-slate-300 border-slate-700">
                                                    <MapPin size={10} />{area}
                                                </span>
                                            ))
                                            : <span className="text-slate-500 text-sm">-</span>
                                        }
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-xs text-slate-500">POC Primary</dt>
                                    <dd className="text-sm text-slate-300">{partner.poc_primary || '-'}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-xs text-slate-500">POC Secondary</dt>
                                    <dd className="text-sm text-slate-300">{partner.poc_secondary || '-'}</dd>
                                </div>
                            </dl>
                        )}
                    </div>
                </div>
            )}

            {/* Referred Deals Tab */}
            {activeTab === 'deals' && (
                <div>
                    {deals ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><BarChart2 size={14} />Total Deals</div>
                                    <div className="text-2xl font-bold text-white">{deals.summary.total_count}</div>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><DollarSign size={14} />Total Value</div>
                                    <div className="text-xl font-bold text-white">{formatters.formatCurrency(deals.summary.total_value || 0)}</div>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1"><Trophy size={14} />Won Deals</div>
                                    <div className="text-2xl font-bold text-white">{deals.summary.won_count}</div>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1"><DollarSign size={14} />Won Value</div>
                                    <div className="text-xl font-bold text-white">{formatters.formatCurrency(deals.summary.won_value || 0)}</div>
                                </div>
                            </div>
                            {deals.deals.length > 0 ? (
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-800">
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deal Name</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Won Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deals.deals.map((deal: any) => (
                                                <tr
                                                    key={deal.id}
                                                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                                                    onClick={() => navigate(`/crm/deal/${deal.id}`)}
                                                >
                                                    <td className="px-4 py-3 text-white font-medium">{deal.name}</td>
                                                    <td className="px-4 py-3 text-slate-400">{deal.company || '-'}</td>
                                                    <td className="px-4 py-3 text-slate-300 text-right">{formatters.formatCurrency(deal.value || 0)}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${deal.status === 'won' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : deal.status === 'lost' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                                            {deal.stage?.name || deal.status || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-400">{deal.won_at ? new Date(deal.won_at).toLocaleDateString() : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                                    No referred deals yet.
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-3 text-slate-500 p-8"><Loader2 className="animate-spin" /> Loading deals...</div>
                    )}
                </div>
            )}

            {/* Commissions Tab */}
            {activeTab === 'commissions' && (
                <div>
                    {commissions ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1"><DollarSign size={14} />Total Earned</div>
                                    <div className="text-xl font-bold text-white">{formatters.formatCurrency(commissions.summary.total_earned || 0)}</div>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1"><DollarSign size={14} />Pending</div>
                                    <div className="text-xl font-bold text-white">{formatters.formatCurrency(commissions.summary.pending || 0)}</div>
                                </div>
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1"><DollarSign size={14} />Paid</div>
                                    <div className="text-xl font-bold text-white">{formatters.formatCurrency(commissions.summary.paid || 0)}</div>
                                </div>
                            </div>
                            {commissions.commissions.length > 0 ? (
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-800">
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deal</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deal Amount</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Commission</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {commissions.commissions.map((c: any) => {
                                                const statusCfg = COMMISSION_STATUS_CONFIG[c.status] || COMMISSION_STATUS_CONFIG.pending;
                                                return (
                                                    <tr key={c.id} className="border-b border-slate-800/50">
                                                        <td className="px-4 py-3 text-white">{c.deal?.name || c.deal_id.slice(0, 8)}</td>
                                                        <td className="px-4 py-3 text-slate-300 text-right">{formatters.formatCurrency(c.deal_amount || 0)}</td>
                                                        <td className="px-4 py-3 text-slate-400 text-right">{c.commission_rate}%</td>
                                                        <td className="px-4 py-3 text-white font-medium text-right">{formatters.formatCurrency(c.commission_amount || 0)}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusCfg.color}`}>
                                                                {statusCfg.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {c.status === 'pending' && (
                                                                <button
                                                                    onClick={() => handleApprove(c.id)}
                                                                    disabled={approvingId === c.id}
                                                                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium disabled:opacity-50 transition-colors"
                                                                >
                                                                    {approvingId === c.id ? 'Approving...' : 'Approve'}
                                                                </button>
                                                            )}
                                                            {c.status === 'approved' && (
                                                                <button
                                                                    onClick={() => setMarkPaidId(c.id)}
                                                                    className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors"
                                                                >
                                                                    Mark Paid
                                                                </button>
                                                            )}
                                                            {c.status === 'paid' && c.payment_ref && (
                                                                <span className="text-xs text-slate-500">{c.payment_ref}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                                    No commissions yet. Commissions are created automatically when a referred deal is won.
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-3 text-slate-500 p-8"><Loader2 className="animate-spin" /> Loading commissions...</div>
                    )}
                </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
                <div className="space-y-3">
                    {activities.length === 0 ? (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                            No activity recorded yet.
                        </div>
                    ) : (
                        activities.map((a: any) => (
                            <div key={a.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                    <Users size={14} className="text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white font-medium">{a.type || 'Activity'}</p>
                                    <p className="text-sm text-slate-400 mt-0.5">{a.notes || '-'}</p>
                                    <p className="text-xs text-slate-600 mt-1">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {markPaidId && (
                <MarkPaidModal
                    commissionId={markPaidId}
                    onClose={() => setMarkPaidId(null)}
                    onPaid={() => { setMarkPaidId(null); showSuccess('Commission marked as paid'); fetchCommissions(); }}
                />
            )}
        </div>
    );
};

export default PartnerDetailPage;
