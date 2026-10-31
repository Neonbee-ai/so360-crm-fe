import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Mail, Phone, Edit2, Check, X,
    MapPin, Percent, Users, User,
} from 'lucide-react';
import { partnersApi, settingsApi, crmService } from '../services/crmService';
import { validatePhone } from '../utils/phoneValidation';
import { toast, Grid, GridItem, Skeleton, Badge, type BadgeTone } from '@so360/design-system';
import { ClickToCallButton } from '../components/common/ClickToCallButton';
import { useBusinessSettings, useShell } from '@so360/shell-context';
import NeuraAiSummaryCard from './components/NeuraAiSummaryCard';
import { useFormatters } from '@so360/formatters';
import { DetailPageTemplate, Card, Badge, Button, KpiCard, EmptyState, DataTable, TextField, NumberInput, Select } from '@so360/design-system';
import { Modal } from '../components/common/Modal';
import { PartnerDlCustomFields } from '../components/customFields/PartnerDlCustomFields';
import { DL_CUSTOM_FIELDS_FLAG } from '../components/customFields/DlCustomFieldsPanel';
import { useCrmFeatureFlag } from '../hooks/useCrmFeatureFlag';

type TabType = 'overview' | 'deals' | 'commissions' | 'activity';

const GRADING_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
    low:  { label: 'Low',  tone: 'neutral' },
    mid:  { label: 'Mid',  tone: 'info' },
    high: { label: 'High', tone: 'success' },
};

const COMMISSION_STATUS_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
    pending:  { label: 'Pending',  tone: 'warning' },
    approved: { label: 'Approved', tone: 'info' },
    paid:     { label: 'Paid',     tone: 'success' },
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

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Mark Royalty as Paid"
            size="sm"
            dismissible={!saving}
            footer={(
                <>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" form="mark-paid-form" variant="primary" disabled={saving}>
                        {saving ? 'Saving...' : 'Mark Paid'}
                    </Button>
                </>
            )}
        >
            {error && <p className="text-danger text-sm mb-3">{error}</p>}
            <form id="mark-paid-form" onSubmit={handleSubmit} className="space-y-4">
                <TextField
                    name="payment-reference"
                    label="Payment Reference"
                    type="text"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    placeholder="e.g. NEFT-2026-001"
                />
            </form>
        </Modal>
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
    const shellCtx = useShell() as any;
    const canUseNeuraAi = (shellCtx?.effectiveFlagsLoaded !== false) && (shellCtx?.isFeatureEnabled?.('submodule:crm:neura_ai_copilot') ?? false);
    const [activities, setActivities] = useState<any[]>([]);
    const dlCustomFields = useCrmFeatureFlag(DL_CUSTOM_FIELDS_FLAG);
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

    // Rail cards (Value, Recent activity) show on every tab, so load their data up front.
    useEffect(() => { fetchCommissions(); fetchActivities(); }, [fetchCommissions, fetchActivities]);

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
            <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4">
                <Skeleton variant="rect" />
                <Skeleton variant="text" lines={3} />
                <span className="sr-only">Loading partner...</span>
            </div>
        );
    }

    if (!partner) {
        return (
            <div className="py-12 text-center text-fg-muted">
                <p>Partner not found.</p>
                <div className="mt-4"><Button variant="secondary" onClick={() => navigate('/crm/partners')}>Back to Partners</Button></div>
            </div>
        );
    }

    const gradingCfg = GRADING_CONFIG[partner.grading] || null;

    const fieldLabelCls = 'text-xs text-fg-muted mb-1';

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
            trail={[{ label: 'Partners', to: '/crm/partners' }]}
            title={partnerName}
            status={
                <>
                    <Badge size="sm" tone="info">{getTypeLabel(partner.partner_type)}</Badge>
                    {gradingCfg && (
                        <Badge tone={gradingCfg.tone} size="sm">
                            {gradingCfg.label}
                        </Badge>
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
            sidePanel={
                <div className="flex flex-col gap-nb-3">
                    {/* 1. Owner / relationship manager */}
                    <Card title="Relationship manager">
                        {getUserName(partner.owner_person_id)
                            ? <p className="flex items-center gap-1.5 text-sm text-fg"><User size={14} className="text-fg-subtle" />{getUserName(partner.owner_person_id)}</p>
                            : <p className="text-sm text-fg-muted">Unassigned</p>}
                    </Card>

                    {/* 2. Status and key dates */}
                    <Card title="Status & key dates">
                        <dl className="flex flex-col gap-nb-2 text-sm">
                            {partner.created_at && (
                                <div className="flex items-center justify-between gap-nb-2">
                                    <dt className="text-xs text-fg-muted">Created</dt>
                                    <dd className="text-fg">{formatters.formatDate(partner.created_at)}</dd>
                                </div>
                            )}
                            {partner.updated_at && (
                                <div className="flex items-center justify-between gap-nb-2">
                                    <dt className="text-xs text-fg-muted">Last updated</dt>
                                    <dd className="text-fg">{formatters.formatDate(partner.updated_at)}</dd>
                                </div>
                            )}
                        </dl>
                    </Card>

                    {/* 3. Value */}
                    <Card title="Value">
                        <dl className="flex flex-col gap-nb-2 text-sm">
                            <div className="flex items-center justify-between gap-nb-2">
                                <dt className="text-xs text-fg-muted">Customers connected</dt>
                                <dd className="text-fg">{partner.customers_connected != null ? partner.customers_connected : '—'}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-nb-2">
                                <dt className="text-xs text-fg-muted">Value of purchase</dt>
                                <dd className="text-fg">{partner.value_of_purchase != null ? formatters.formatCurrency(partner.value_of_purchase) : '—'}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-nb-2">
                                <dt className="text-xs text-fg-muted">Total purchase till date</dt>
                                <dd className="text-fg">{partner.total_purchase_till_date != null ? formatters.formatCurrency(partner.total_purchase_till_date) : '—'}</dd>
                            </div>
                            {commissions?.summary && (
                                <>
                                    <div className="flex items-center justify-between gap-nb-2">
                                        <dt className="text-xs text-fg-muted">Royalties earned</dt>
                                        <dd className="text-fg">{formatters.formatCurrency(commissions.summary.total_earned || 0)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-nb-2">
                                        <dt className="text-xs text-fg-muted">Royalties pending</dt>
                                        <dd className="text-fg">{formatters.formatCurrency(commissions.summary.pending || 0)}</dd>
                                    </div>
                                </>
                            )}
                        </dl>
                    </Card>

                    {/* 4. Neura summary */}
                    {canUseNeuraAi && (
                        <NeuraAiSummaryCard
                            leadId={partner.id}
                            leadLabel={partner.company_name || [partner.first_name, partner.last_name].filter(Boolean).join(' ') || partner.id}
                            isInboxEnabled={false}
                            entity="partners"
                        />
                    )}

                    {/* 5. Recent activity */}
                    {activities.length > 0 && (
                        <Card
                            title="Recent activity"
                            padding="none"
                            actions={<Button variant="secondary" size="sm" onClick={() => setActiveTab('activity')}>View all</Button>}
                        >
                            <div className="divide-y divide-line">
                                {activities.slice(0, 5).map((a: any) => (
                                    <div key={a.id} className="p-nb-3">
                                        <p className="text-sm text-fg font-medium">{a.type || 'Activity'}</p>
                                        <p className="text-xs text-fg-muted mt-1">{a.created_at ? formatters.formatDateTime(a.created_at) : ''}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            }
        >
            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="flex flex-col gap-nb-3">
                    {isEditing ? (
                        <Card title="Partner information" actions={overviewActions}>
                        <div className="space-y-6">
                            <Grid gap="md">
                                <GridItem span={{ md: 4, lg: 6 }}><TextField name="first-name" label="First Name" placeholder="Dhanooj" value={editForm.first_name}
                                    onChange={e => setEditForm((f: any) => ({ ...f, first_name: e.target.value }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><TextField name="last-name" label="Last Name" placeholder="B S" value={editForm.last_name}
                                    onChange={e => setEditForm((f: any) => ({ ...f, last_name: e.target.value }))} /></GridItem>
                                <GridItem span="full"><div>
                                    <TextField name="company-name" label="Company Name" placeholder="Moonhive Pvt Ltd" value={editForm.company_name}
                                    onChange={e => setEditForm((f: any) => ({ ...f, company_name: e.target.value }))} />
                                </div></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><Select name="partner-type" label="Partner Type" placeholder="Select..." value={editForm.partner_type}
                                    onChange={e => setEditForm((f: any) => ({ ...f, partner_type: e.target.value }))}
                                    options={partnerTypes.map(pt => ({ value: pt.value, label: pt.label }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><TextField name="email" label="Email" type="email" value={editForm.email}
                                    onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><TextField name="phone" label="Phone" type="tel" maxLength={20} value={editForm.phone} error={phoneError || undefined}
                                    onChange={e => { setEditForm((f: any) => ({ ...f, phone: e.target.value })); setPhoneError(validatePhone(e.target.value)); }} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><Select name="grading" label="Architect Grading" placeholder="Select..." value={editForm.grading}
                                    onChange={e => setEditForm((f: any) => ({ ...f, grading: e.target.value }))}
                                    options={[{ value: 'low', label: 'Low' }, { value: 'mid', label: 'Mid' }, { value: 'high', label: 'High' }]} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><NumberInput name="commission-rate" label="Royalty Rate (%)" min={0} max={100} step={0.5} value={editForm.commission_rate === '' || editForm.commission_rate == null ? null : Number(editForm.commission_rate)}
                                    onChange={v => setEditForm((f: any) => ({ ...f, commission_rate: v == null ? '' : String(v) }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><Select name="owner-person" label="Relationship Manager" placeholder="— Assign RM —" value={editForm.owner_person_id}
                                    onChange={e => setEditForm((f: any) => ({ ...f, owner_person_id: e.target.value }))}
                                    options={users.map(u => ({ value: u.id, label: u.full_name }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><NumberInput name="customers-connected" label="Customers Connected" min={0} step={1} value={editForm.customers_connected === '' || editForm.customers_connected == null ? null : Number(editForm.customers_connected)}
                                    onChange={v => setEditForm((f: any) => ({ ...f, customers_connected: v == null ? '' : String(v) }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><NumberInput name="value-of-purchase" label="Value of Purchase" min={0} step={0.01} value={editForm.value_of_purchase === '' || editForm.value_of_purchase == null ? null : Number(editForm.value_of_purchase)}
                                    onChange={v => setEditForm((f: any) => ({ ...f, value_of_purchase: v == null ? '' : String(v) }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><NumberInput name="total-purchase" label="Total Purchase Till Date" min={0} step={0.01} value={editForm.total_purchase_till_date === '' || editForm.total_purchase_till_date == null ? null : Number(editForm.total_purchase_till_date)}
                                    onChange={v => setEditForm((f: any) => ({ ...f, total_purchase_till_date: v == null ? '' : String(v) }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><TextField name="poc-primary" label="1st POC" placeholder="Primary contact" value={editForm.poc_primary}
                                    onChange={e => setEditForm((f: any) => ({ ...f, poc_primary: e.target.value }))} /></GridItem>
                                <GridItem span={{ md: 4, lg: 6 }}><TextField name="poc-secondary" label="2nd POC" placeholder="Secondary contact" value={editForm.poc_secondary}
                                    onChange={e => setEditForm((f: any) => ({ ...f, poc_secondary: e.target.value }))} /></GridItem>
                            </Grid>
                            <div>
                                <p className="text-xs text-fg-subtle mb-1">Area Served</p>
                                <div className="flex flex-wrap gap-2">
                                    {AREA_OPTIONS.map(area => {
                                        const selected = (editForm.area_served || []).includes(area);
                                        return (
                                            <Button variant={selected ? 'primary' : 'secondary'} size="sm"
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
                                               
                                            >
                                                {area}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        </Card>
                    ) : (
                        <>
                            <Card title="Partner details" actions={overviewActions}>
                                <Grid gap="md">
                                    <GridItem span={{ md: 4, lg: 6 }}><dl>
                                        <dt className={fieldLabelCls}>Partner type</dt>
                                        <dd className="mt-1">
                                            <Badge size="sm" tone="info">{getTypeLabel(partner.partner_type)}</Badge>
                                        </dd>
                                    </dl></GridItem>
                                    <GridItem span={{ md: 4, lg: 6 }}><dl>
                                        <dt className={fieldLabelCls}>Architect grading</dt>
                                        <dd className="mt-1">
                                            {gradingCfg ? (
                                                <Badge tone={gradingCfg.tone} size="sm">
                                                    {gradingCfg.label}
                                                </Badge>
                                            ) : <span className="text-fg-muted text-sm">—</span>}
                                        </dd>
                                    </dl></GridItem>
                                    <GridItem span={{ md: 4, lg: 6 }}><dl>
                                        <dt className={fieldLabelCls}>Royalty rate</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {partner.commission_rate > 0
                                                ? <><Percent size={13} className="text-fg-subtle" /><span>{partner.commission_rate}%</span></>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </dl></GridItem>
                                    <GridItem span={{ md: 4, lg: 6 }}><dl>
                                        <dt className={fieldLabelCls}>Relationship manager</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {getUserName(partner.owner_person_id)
                                                ? <><User size={13} className="text-fg-subtle" /><span>{getUserName(partner.owner_person_id)}</span></>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </dl></GridItem>
                                </Grid>
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

                            <Card title="Contact information">
                                <Grid gap="md">
                                    {partner.company_name && (
                                        <GridItem span="full"><dl>
                                            <dt className={fieldLabelCls}>Company name</dt>
                                            <dd className="text-sm text-fg mt-1">{partner.company_name}</dd>
                                        </dl></GridItem>
                                    )}
                                    <GridItem span={{ md: 4, lg: 6 }}><dl>
                                        <dt className={fieldLabelCls}>1st POC</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {partner.poc_primary
                                                ? <><User size={13} className="text-fg-muted" />{partner.poc_primary}</>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </dl></GridItem>
                                    <GridItem span={{ md: 4, lg: 6 }}><dl>
                                        <dt className={fieldLabelCls}>2nd POC</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {partner.poc_secondary
                                                ? <><User size={13} className="text-fg-muted" />{partner.poc_secondary}</>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </dl></GridItem>
                                    <GridItem span={{ md: 4, lg: 6 }}><dl>
                                        <dt className={fieldLabelCls}>Email</dt>
                                        <dd className="mt-1">
                                            {partner.email
                                                ? <a href={`mailto:${partner.email}`} className="text-sm text-primary hover:underline flex items-center gap-1.5 transition-colors"><Mail size={13} />{partner.email}</a>
                                                : <span className="text-fg-muted text-sm">—</span>}
                                        </dd>
                                    </dl></GridItem>
                                    <GridItem span={{ md: 4, lg: 6 }}><dl>
                                        <dt className={fieldLabelCls}>Phone</dt>
                                        <dd className="text-sm text-fg mt-1 flex items-center gap-1.5">
                                            {partner.phone
                                                ? <><Phone size={13} className="text-fg-muted" />{partner.phone}</>
                                                : <span className="text-fg-muted">—</span>}
                                        </dd>
                                    </dl></GridItem>
                                </Grid>
                            </Card>
                        </>
                    )}
                    {dlCustomFields && !isEditing && <PartnerDlCustomFields corePartnerId={partner?.core_partner_id} />}
                </div>
            )}

            {/* Referred Deals Tab */}
            {activeTab === 'deals' && (
                <div className="flex flex-col gap-nb-3">
                    {deals ? (
                        <>
                            <Grid gap="md">
                                <GridItem span={3}><KpiCard label="Total deals" value={deals.summary.total_count} /></GridItem>
                                <GridItem span={3}><KpiCard label="Total value" value={formatters.formatCurrency(deals.summary.total_value || 0)} /></GridItem>
                                <GridItem span={3}><KpiCard label="Won deals" value={deals.summary.won_count} /></GridItem>
                                <GridItem span={3}><KpiCard label="Won value" value={formatters.formatCurrency(deals.summary.won_value || 0)} /></GridItem>
                            </Grid>
                            <Card title="Referred deals" padding="none">
                                {deals.deals.length > 0 ? (
                                    <DataTable
                                        name="partner-referred-deals"
                                        columns={[
                                            { key: 'name', header: 'Deal name', render: (deal: any) => <span className="text-fg font-medium">{deal.name}</span> },
                                            { key: 'company', header: 'Customer', render: (deal: any) => <span className="text-fg-subtle">{deal.company || '-'}</span> },
                                            { key: 'value', header: 'Value', render: (deal: any) => <div className="text-right text-fg-subtle">{formatters.formatCurrency(deal.value || 0)}</div> },
                                            { key: 'stage', header: 'Stage', render: (deal: any) => (
                                                <Badge size="sm" tone={deal.status === 'won' ? 'success' : deal.status === 'lost' ? 'danger' : 'neutral'}>
                                                    {deal.stage?.name || deal.status || '-'}
                                                </Badge>
                                            ) },
                                            { key: 'won_at', header: 'Won date', render: (deal: any) => <span className="text-fg-subtle">{deal.won_at ? formatters.formatDate(deal.won_at) : '-'}</span> },
                                        ]}
                                        rows={deals.deals}
                                        rowKey={(deal: any) => String(deal.id)}
                                        onRowClick={(deal: any) => navigate(`/crm/deal/${deal.id}`)}
                                    />
                                ) : (
                                    <EmptyState title="No referred deals yet." />
                                )}
                            </Card>
                        </>
                    ) : (
                        <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4"><Skeleton variant="rect" /><Skeleton variant="text" lines={3} /><span className="sr-only">Loading deals...</span></div>
                    )}
                </div>
            )}

            {/* Commissions Tab */}
            {activeTab === 'commissions' && (
                <div className="flex flex-col gap-nb-3">
                    {commissions ? (
                        <>
                            <Grid gap="md">
                                <GridItem span={4}><KpiCard label="Total earned" value={formatters.formatCurrency(commissions.summary.total_earned || 0)} /></GridItem>
                                <GridItem span={4}><KpiCard label="Pending" value={formatters.formatCurrency(commissions.summary.pending || 0)} /></GridItem>
                                <GridItem span={4}><KpiCard label="Paid" value={formatters.formatCurrency(commissions.summary.paid || 0)} /></GridItem>
                            </Grid>
                            <Card title="Royalties" padding="none">
                                {commissions.commissions.length > 0 ? (
                                    <DataTable
                                        name="partner-royalties"
                                        columns={[
                                            { key: 'deal', header: 'Deal', render: (c: any) => <span className="text-fg">{c.deal?.name || c.deal_id.slice(0, 8)}</span> },
                                            { key: 'deal_amount', header: 'Deal amount', render: (c: any) => <div className="text-right text-fg-subtle">{formatters.formatCurrency(c.deal_amount || 0)}</div> },
                                            { key: 'rate', header: 'Rate', render: (c: any) => <div className="text-right text-fg-subtle">{c.commission_rate}%</div> },
                                            { key: 'royalty', header: 'Royalty', render: (c: any) => <div className="text-right text-fg font-medium">{formatters.formatCurrency(c.commission_amount || 0)}</div> },
                                            { key: 'status', header: 'Status', render: (c: any) => {
                                                const statusCfg = COMMISSION_STATUS_CONFIG[c.status] || COMMISSION_STATUS_CONFIG.pending;
                                                return (
                                                    <Badge tone={statusCfg.tone} size="sm">
                                                        {statusCfg.label}
                                                    </Badge>
                                                );
                                            } },
                                            { key: 'actions', header: 'Actions', render: (c: any) => (
                                                <>
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
                                                </>
                                            ) },
                                        ]}
                                        rows={commissions.commissions}
                                        rowKey={(c: any) => String(c.id)}
                                    />
                                ) : (
                                    <EmptyState title="No royalties yet." description="Royalties are created automatically when a referred deal is won." />
                                )}
                            </Card>
                        </>
                    ) : (
                        <div role="status" aria-busy="true" className="w-full space-y-nb-3 p-nb-4"><Skeleton variant="rect" /><Skeleton variant="text" lines={3} /><span className="sr-only">Loading royalties...</span></div>
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
