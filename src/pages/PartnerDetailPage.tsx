import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Mail, Phone, Edit2, Loader2, Check, X,
    MapPin, Percent, Users, User,
} from 'lucide-react';
import { partnersApi, settingsApi, crmService } from '../services/crmService';
import { validatePhone } from '../utils/phoneValidation';
import { toast } from '@so360/design-system';
import { ClickToCallButton } from '../components/common/ClickToCallButton';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import { goBackFrom } from '../components/common/DetailBackLink';
import { DetailPageTemplate, Card, Badge, Button, KpiCard, EmptyState } from '@so360/design-system';
import { crmPortalRoot } from '../utils/crmScope';

type TabType = 'overview' | 'deals' | 'commissions' | 'activity';

const GRADING_CONFIG: Record<string, { label: string; color: string }> = {
    low:  { label: 'Low',  color: 'bg-fg-muted/10 text-fg-subtle border-line' },
    mid:  { label: 'Mid',  color: 'bg-info/10 text-info border-info/20' },
    high: { label: 'High', color: 'bg-success/10 text-success border-success/20' },
};

const COMMISSION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pending',  color: 'bg-warning/10 text-warning border-warning/20' },
    approved: { label: 'Approved', color: 'bg-info/10 text-info border-info/20' },
    paid:     { label: 'Paid',     color: 'bg-success/10 text-success border-success/20' },
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
        <div className="fixed inset-0 z-dialog flex items-center justify-center bg-overlay">
            <div className="bg-surface border border-line rounded-nb-lg p-6 w-full max-w-sm shadow-overlay">
                <h2 className="text-base font-semibold text-fg mb-4">Mark Royalty as Paid</h2>
                {error && <p className="text-danger text-sm mb-3">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-fg-subtle mb-1 block">Payment Reference</label>
                        <input
                            type="text"
                            value={paymentRef}
                            onChange={e => setPaymentRef(e.target.value)}
                            placeholder="e.g. NEFT-2026-001"
                            className="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-fg-subtle hover:text-fg">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-success hover:bg-success/90 text-white rounded-lg font-medium disabled:opacity-50">
                            {saving ? 'Saving...' : 'Mark Paid'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        crmPortalRoot()
    );
};

const PartnerDetailPage = () => {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [partner, setPartner] = useState<any>(null);
    const [partnerTypes, setPartnerTypes] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
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
        timezone: settings?.timezone || 'UTC',
    });

    const fetchData = useCallback(async () => {
        try {
            const [partnerData, typesData, usersData] = await Promise.all([
                partnersApi.getOne(id),
                settingsApi.partnerTypes.getAll().catch(() => []),
                crmService.getUsers().catch(() => []),
            ]);
            setPartner(partnerData);
            setPartnerTypes(typesData || []);
            setUsers(usersData || []);
            setEditForm({
                first_name: partnerData.first_name || '',
                last_name: partnerData.last_name || '',
                company_name: partnerData.company_name || '',
                contact_name: partnerData.contact_name || '',
                email: partnerData.email || '',
                phone: partnerData.phone || '',
                partner_type: partnerData.partner_type || '',
                grading: partnerData.grading || '',
                area_served: partnerData.area_served || [],
                commission_rate: partnerData.commission_rate ?? 0,
                owner_person_id: partnerData.owner_person_id || '',
                poc_primary: partnerData.poc_primary || '',
                poc_secondary: partnerData.poc_secondary || '',
                customers_connected: partnerData.customers_connected ?? '',
                value_of_purchase: partnerData.value_of_purchase ?? '',
                total_purchase_till_date: partnerData.total_purchase_till_date ?? '',
            });
        } catch (err: any) {
            toast.error('Failed to load partner');
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
                first_name: editForm.first_name,
                last_name: editForm.last_name,
                company_name: editForm.company_name || null,
                grading: (['low', 'mid', 'high'] as string[]).includes(editForm.grading) ? editForm.grading : null,
                commission_rate: parseFloat(editForm.commission_rate) || 0,
                owner_person_id: editForm.owner_person_id || null,
                poc_primary: editForm.poc_primary || null,
                poc_secondary: editForm.poc_secondary || null,
                customers_connected: editForm.customers_connected === '' ? null : parseInt(editForm.customers_connected, 10),
                value_of_purchase: editForm.value_of_purchase === '' ? null : parseFloat(editForm.value_of_purchase),
                total_purchase_till_date: editForm.total_purchase_till_date === '' ? null : parseFloat(editForm.total_purchase_till_date),
            });
            setPartner(updated);
            setIsEditing(false);
            toast.success('Partner updated');
        } catch (err: any) {
            toast.error(err.message || 'Failed to update partner');
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async (commissionId: string) => {
        setApprovingId(commissionId);
        try {
            await partnersApi.updateCommission(commissionId, { status: 'approved' });
            toast.success('Royalty approved');
            fetchCommissions();
        } catch (err: any) {
            toast.error(err.message || 'Failed to approve royalty');
        } finally {
            setApprovingId(null);
        }
    };

    const getTypeLabel = (value: string) => {
        const found = partnerTypes.find(pt => pt.value === value);
        return found?.label || value || '-';
    };

    const getUserName = (userId?: string) => {
        if (!userId) return null;
        const found = users.find(u => u.id === userId);
        return found?.full_name || null;
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center text-fg-muted gap-3 py-12">
                <Loader2 className="animate-spin" />
                <span>Loading partner...</span>
            </div>
        );
    }

    if (!partner) {
        return (
            <div className="py-12 text-center text-fg-muted">
                <p>Partner not found.</p>
                <button onClick={() => navigate('/crm/partners')} className="text-primary hover:underline mt-4 inline-block">Back to Partners</button>
            </div>
        );
    }

    const gradingCfg = GRADING_CONFIG[partner.grading] || null;

    const fieldLabelCls = 'text-xs text-fg-muted mb-1';
    const editLabelCls = 'text-xs text-fg-subtle mb-1 block';
    const editInputCls = 'w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary/50';

    const overviewActions = isEditing ? (
        <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setIsEditing(false); }}><X size={14} /> Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
                <Check size={14} />{saving ? 'Saving...' : 'Save'}
            </Button>
        </div>
    ) : (
        <Button variant="secondary" onClick={() => setIsEditing(true)}><Edit2 size={14} /> Edit</Button>
    );

    const partnerName = [partner.first_name, partner.last_name].filter(Boolean).join(' ') || partner.contact_name;

    return (
        <DetailPageTemplate
            onBack={() => goBackFrom(navigate, '/crm/partners')}
            backLabel="Back"
            title={partnerName}
            status={
                <>
                    <Badge size="sm" tone="info">{getTypeLabel(partner.partner_type)}</Badge>
                    {gradingCfg && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${gradingCfg.color}`}>
                            {gradingCfg.label}
                        </span>
                    )}
                </>
            }
            meta={
                <>
                    {partner.company_name && (
                        <p className="text-fg-subtle text-sm mb-1">{partner.company_name}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-fg-subtle text-sm">
                        {partner.email && <span className="flex items-center gap-1.5"><Mail size={14} />{partner.email}</span>}
                        {partner.phone && (
                            <span className="flex items-center gap-1.5">
                                <Phone size={14} />{partner.phone}
                                <ClickToCallButton
                                    number={partner.phone}
                                    entityType="company"
                                    entityId={partner.id}
                                    name={partnerName}
                                />
                            </span>
                        )}
                        {partner.commission_rate > 0 && (
                            <span className="flex items-center gap-1.5"><Percent size={14} />{partner.commission_rate}% royalty</span>
                        )}
                        {getUserName(partner.owner_person_id) && (
                            <span className="flex items-center gap-1.5"><User size={14} />{getUserName(partner.owner_person_id)}</span>
                        )}
                    </div>
                </>
            }
            tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'deals', label: 'Referred Deals' },
                { id: 'commissions', label: 'Royalties' },
                { id: 'activity', label: 'Activity' },
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as TabType)}
        >
            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="flex flex-col gap-nb-3">
                    {isEditing ? (
                        <Card title="Partner information" actions={overviewActions}>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                                <div>
                                    <label className={editLabelCls}>First Name</label>
                                    <input value={editForm.first_name}
                                        onChange={e => setEditForm((f: any) => ({ ...f, first_name: e.target.value }))}
                                        className={editInputCls} placeholder="Dhanooj" />
                                </div>
                                <div>
                                    <label className={editLabelCls}>Last Name</label>
                                    <input value={editForm.last_name}
                                        onChange={e => setEditForm((f: any) => ({ ...f, last_name: e.target.value }))}
                                        className={editInputCls} placeholder="B S" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={editLabelCls}>Company Name</label>
                                    <input value={editForm.company_name}
                                        onChange={e => setEditForm((f: any) => ({ ...f, company_name: e.target.value }))}
                                        className={editInputCls} placeholder="Moonhive Pvt Ltd" />
                                </div>
                                <div>
                                    <label className={editLabelCls}>Partner Type</label>
                                    <select value={editForm.partner_type}
                                        onChange={e => setEditForm((f: any) => ({ ...f, partner_type: e.target.value }))}
                                        className={editInputCls}>
                                        <option value="">Select...</option>
                                        {partnerTypes.map(pt => (
                                            <option key={pt.value} value={pt.value}>{pt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={editLabelCls}>Email</label>
                                    <input type="email" value={editForm.email}
                                        onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                                        className={editInputCls} />
                                </div>
                                <div>
                                    <label className={editLabelCls}>Phone</label>
                                    <input type="tel" maxLength={20} value={editForm.phone}
                                        onChange={e => { setEditForm((f: any) => ({ ...f, phone: e.target.value })); setPhoneError(validatePhone(e.target.value)); }}
                                        className={`w-full bg-bg border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 ${phoneError ? 'border-danger/60 focus:ring-danger/50' : 'border-line focus:ring-primary/50'}`} />
                                    {phoneError && <p className="text-danger text-xs mt-1">{phoneError}</p>}
                                </div>
                                <div>
                                    <label className={editLabelCls}>Architect Grading</label>
                                    <select value={editForm.grading}
                                        onChange={e => setEditForm((f: any) => ({ ...f, grading: e.target.value }))}
                                        className={editInputCls}>
                                        <option value="">Select...</option>
                                        <option value="low">Low</option>
                                        <option value="mid">Mid</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={editLabelCls}>Royalty Rate (%)</label>
                                    <input type="number" min="0" max="100" step="0.5" value={editForm.commission_rate}
                                        onChange={e => setEditForm((f: any) => ({ ...f, commission_rate: e.target.value }))}
                                        className={editInputCls} />
                                </div>
                                <div>
                                    <label className={editLabelCls}>Relationship Manager</label>
                                    <select value={editForm.owner_person_id}
                                        onChange={e => setEditForm((f: any) => ({ ...f, owner_person_id: e.target.value }))}
                                        className={editInputCls}>
                                        <option value="">— Assign RM —</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={editLabelCls}>Customers Connected</label>
                                    <input type="number" min="0" step="1" value={editForm.customers_connected}
                                        onChange={e => setEditForm((f: any) => ({ ...f, customers_connected: e.target.value }))}
                                        className={editInputCls} />
                                </div>
                                <div>
                                    <label className={editLabelCls}>Value of Purchase</label>
                                    <input type="number" min="0" step="0.01" value={editForm.value_of_purchase}
                                        onChange={e => setEditForm((f: any) => ({ ...f, value_of_purchase: e.target.value }))}
                                        className={editInputCls} />
                                </div>
                                <div>
                                    <label className={editLabelCls}>Total Purchase Till Date</label>
                                    <input type="number" min="0" step="0.01" value={editForm.total_purchase_till_date}
                                        onChange={e => setEditForm((f: any) => ({ ...f, total_purchase_till_date: e.target.value }))}
                                        className={editInputCls} />
                                </div>
                                <div>
                                    <label className={editLabelCls}>1st POC</label>
                                    <input type="text" value={editForm.poc_primary}
                                        onChange={e => setEditForm((f: any) => ({ ...f, poc_primary: e.target.value }))}
                                        className={editInputCls} placeholder="Primary contact" />
                                </div>
                                <div>
                                    <label className={editLabelCls}>2nd POC</label>
                                    <input type="text" value={editForm.poc_secondary}
                                        onChange={e => setEditForm((f: any) => ({ ...f, poc_secondary: e.target.value }))}
                                        className={editInputCls} placeholder="Secondary contact" />
                                </div>
                            </div>
                            <div>
                                <label className={editLabelCls}>Area Served</label>
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
                                                        ? 'bg-primary/10 text-primary border-primary/40'
                                                        : 'bg-surface-raised text-fg-subtle border-line hover:border-line'
                                                }`}
                                            >
                                                {area}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        </Card>
                    ) : (
                        <>
                            <Card title="Partner details" actions={overviewActions}>
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-nb-3">
                                    <div>
                                        <dt className={fieldLabelCls}>Partner type</dt>
                                        <dd className="mt-1">
                                            <Badge size="sm" tone="info">{getTypeLabel(partner.partner_type)}</Badge>
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className={fieldLabelCls}>Architect grading</dt>
                                        <dd className="mt-1">
                                            {gradingCfg ? (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${gradingCfg.color}`}>
                                                    {gradingCfg.label}
                                                </span>
                                            ) : <span className="text-fg-muted text-sm">—</span>}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className={fieldLabelCls}>Royalty rate</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {partner.commission_rate > 0
                                                ? <><Percent size={13} className="text-fg-subtle" /><span>{partner.commission_rate}%</span></>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className={fieldLabelCls}>Relationship manager</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {getUserName(partner.owner_person_id)
                                                ? <><User size={13} className="text-fg-subtle" /><span>{getUserName(partner.owner_person_id)}</span></>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </div>
                                </dl>
                            </Card>

                            <Card title="Geographic coverage">
                                <dl>
                                    <dt className={fieldLabelCls}>Area served</dt>
                                    <dd className="flex flex-wrap gap-2 mt-2">
                                        {(partner.area_served || []).length > 0
                                            ? partner.area_served.map((area: string) => (
                                                <Badge key={area} size="sm" tone="neutral">
                                                    <MapPin size={10} className="mr-1" />{area}
                                                </Badge>
                                            ))
                                            : <span className="text-fg-muted text-sm">—</span>
                                        }
                                    </dd>
                                </dl>
                            </Card>

                            <div className="grid grid-cols-1 wc-medium:grid-cols-3 gap-nb-3">
                                <KpiCard label="Customers connected" value={partner.customers_connected != null ? partner.customers_connected : '—'} />
                                <KpiCard label="Value of purchase" value={partner.value_of_purchase != null ? formatters.formatCurrency(partner.value_of_purchase) : '—'} />
                                <KpiCard label="Total purchase till date" value={partner.total_purchase_till_date != null ? formatters.formatCurrency(partner.total_purchase_till_date) : '—'} />
                            </div>

                            <Card title="Contact information">
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-nb-3">
                                    {partner.company_name && (
                                        <div className="sm:col-span-2">
                                            <dt className={fieldLabelCls}>Company name</dt>
                                            <dd className="text-sm text-fg mt-1">{partner.company_name}</dd>
                                        </div>
                                    )}
                                    <div>
                                        <dt className={fieldLabelCls}>1st POC</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {partner.poc_primary
                                                ? <><User size={13} className="text-fg-muted" />{partner.poc_primary}</>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className={fieldLabelCls}>2nd POC</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {partner.poc_secondary
                                                ? <><User size={13} className="text-fg-muted" />{partner.poc_secondary}</>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className={fieldLabelCls}>Email</dt>
                                        <dd className="mt-1">
                                            {partner.email
                                                ? <a href={`mailto:${partner.email}`} className="text-sm text-primary hover:underline flex items-center gap-1.5 transition-colors"><Mail size={13} />{partner.email}</a>
                                                : <span className="text-fg-muted text-sm">—</span>}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className={fieldLabelCls}>Phone</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {partner.phone
                                                ? <><Phone size={13} className="text-fg-muted" />{partner.phone}</>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </div>
                                </dl>
                            </Card>
                        </>
                    )}
                </div>
            )}

            {/* Referred Deals Tab */}
            {activeTab === 'deals' && (
                <div className="flex flex-col gap-nb-3">
                    {deals ? (
                        <>
                            <div className="grid grid-cols-2 wc-medium:grid-cols-4 gap-nb-3">
                                <KpiCard label="Total deals" value={deals.summary.total_count} />
                                <KpiCard label="Total value" value={formatters.formatCurrency(deals.summary.total_value || 0)} />
                                <KpiCard label="Won deals" value={deals.summary.won_count} />
                                <KpiCard label="Won value" value={formatters.formatCurrency(deals.summary.won_value || 0)} />
                            </div>
                            <Card title="Referred deals" padding="none">
                                {deals.deals.length > 0 ? (
                                    <div className="w-full overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-line">
                                                    <th className="text-left px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Deal name</th>
                                                    <th className="text-left px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Customer</th>
                                                    <th className="text-right px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Value</th>
                                                    <th className="text-left px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Stage</th>
                                                    <th className="text-left px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Won date</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-line">
                                                {deals.deals.map((deal: any) => (
                                                    <tr
                                                        key={deal.id}
                                                        className="hover:bg-surface-high cursor-pointer"
                                                        onClick={() => navigate(`/crm/deal/${deal.id}`)}
                                                    >
                                                        <td className="px-nb-3 py-nb-2 text-fg font-medium">{deal.name}</td>
                                                        <td className="px-nb-3 py-nb-2 text-fg-subtle">{deal.company || '-'}</td>
                                                        <td className="px-nb-3 py-nb-2 text-fg-subtle text-right">{formatters.formatCurrency(deal.value || 0)}</td>
                                                        <td className="px-nb-3 py-nb-2">
                                                            <Badge size="sm" tone={deal.status === 'won' ? 'success' : deal.status === 'lost' ? 'danger' : 'neutral'}>
                                                                {deal.stage?.name || deal.status || '-'}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-nb-3 py-nb-2 text-fg-subtle">{deal.won_at ? formatters.formatDate(deal.won_at) : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <EmptyState title="No referred deals yet." />
                                )}
                            </Card>
                        </>
                    ) : (
                        <div className="flex items-center gap-3 text-fg-muted p-nb-4"><Loader2 className="animate-spin" /> Loading deals...</div>
                    )}
                </div>
            )}

            {/* Commissions Tab */}
            {activeTab === 'commissions' && (
                <div className="flex flex-col gap-nb-3">
                    {commissions ? (
                        <>
                            <div className="grid grid-cols-1 wc-medium:grid-cols-3 gap-nb-3">
                                <KpiCard label="Total earned" value={formatters.formatCurrency(commissions.summary.total_earned || 0)} />
                                <KpiCard label="Pending" value={formatters.formatCurrency(commissions.summary.pending || 0)} />
                                <KpiCard label="Paid" value={formatters.formatCurrency(commissions.summary.paid || 0)} />
                            </div>
                            <Card title="Royalties" padding="none">
                                {commissions.commissions.length > 0 ? (
                                    <div className="w-full overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-line">
                                                    <th className="text-left px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Deal</th>
                                                    <th className="text-right px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Deal amount</th>
                                                    <th className="text-right px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Rate</th>
                                                    <th className="text-right px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Royalty</th>
                                                    <th className="text-left px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Status</th>
                                                    <th className="text-left px-nb-3 py-nb-2 text-xs font-medium text-fg-muted">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-line">
                                                {commissions.commissions.map((c: any) => {
                                                    const statusCfg = COMMISSION_STATUS_CONFIG[c.status] || COMMISSION_STATUS_CONFIG.pending;
                                                    return (
                                                        <tr key={c.id}>
                                                            <td className="px-nb-3 py-nb-2 text-fg">{c.deal?.name || c.deal_id.slice(0, 8)}</td>
                                                            <td className="px-nb-3 py-nb-2 text-fg-subtle text-right">{formatters.formatCurrency(c.deal_amount || 0)}</td>
                                                            <td className="px-nb-3 py-nb-2 text-fg-subtle text-right">{c.commission_rate}%</td>
                                                            <td className="px-nb-3 py-nb-2 text-fg font-medium text-right">{formatters.formatCurrency(c.commission_amount || 0)}</td>
                                                            <td className="px-nb-3 py-nb-2">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusCfg.color}`}>
                                                                    {statusCfg.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-nb-3 py-nb-2">
                                                                {c.status === 'pending' && (
                                                                    <Button
                                                                        variant="secondary"
                                                                        onClick={() => handleApprove(c.id)}
                                                                        disabled={approvingId === c.id}
                                                                    >
                                                                        {approvingId === c.id ? 'Approving...' : 'Approve'}
                                                                    </Button>
                                                                )}
                                                                {c.status === 'approved' && (
                                                                    <Button
                                                                        variant="secondary"
                                                                        onClick={() => setMarkPaidId(c.id)}
                                                                    >
                                                                        Mark Paid
                                                                    </Button>
                                                                )}
                                                                {c.status === 'paid' && c.payment_ref && (
                                                                    <span className="text-xs text-fg-muted">{c.payment_ref}</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <EmptyState title="No royalties yet." description="Royalties are created automatically when a referred deal is won." />
                                )}
                            </Card>
                        </>
                    ) : (
                        <div className="flex items-center gap-3 text-fg-muted p-nb-4"><Loader2 className="animate-spin" /> Loading royalties...</div>
                    )}
                </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
                <Card title="Activity" padding="none">
                    {activities.length === 0 ? (
                        <EmptyState title="No activity recorded yet." />
                    ) : (
                        <div className="divide-y divide-line">
                            {activities.map((a: any) => (
                                <div key={a.id} className="p-nb-3 flex items-start gap-nb-3">
                                    <div className="w-8 h-8 rounded-full bg-surface-raised border border-line flex items-center justify-center flex-shrink-0">
                                        <Users size={14} className="text-fg-muted" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-fg font-medium">{a.type || 'Activity'}</p>
                                        <p className="text-sm text-fg-subtle mt-0.5">{a.notes || '-'}</p>
                                        <p className="text-xs text-fg-muted mt-1">{a.created_at ? formatters.formatDateTime(a.created_at) : ''}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {markPaidId && (
                <MarkPaidModal
                    commissionId={markPaidId}
                    onClose={() => setMarkPaidId(null)}
                    onPaid={() => { setMarkPaidId(null); toast.success('Royalty marked as paid'); fetchCommissions(); }}
                />
            )}
        </DetailPageTemplate>
    );
};

export default PartnerDetailPage;
