import React, { useState, useEffect } from 'react';
import {
    Building2, CreditCard, Shield, CheckCircle2, AlertCircle, Loader2,
    Tag, ShoppingCart, Users, MapPin, Pencil, Save, X, FileSignature,
    DollarSign, FileText, Globe,
} from 'lucide-react';
import { crmService } from '../services/crmService';
import { useCRMFormatters } from '../utils/formatters';
import { parseUtcDate } from '../utils/datetime';
import { useBusinessSettings, useShell } from '@so360/shell-context';
import SignRequestModal from './sign/SignRequestModal';

interface Partner {
    id: string;
    company_name: string;
    contact_name?: string;
}

interface AddressShape {
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
}

interface BusinessProfileShape {
    business_name?: string;
    legal_entity_name?: string;
    // GST (India)
    gst_number?: string;
    gst_treatment?: string;
    place_of_supply?: string;
    pan_number?: string;
    // VAT
    vat_number?: string;
    vat_treatment?: string;
    // US sales tax
    tax_exempt_id?: string;
    // Common
    business_type?: string;
    billing_address?: AddressShape | null;
    shipping_address?: AddressShape | null;
    // Accounting
    payment_terms?: string;
    customer_currency?: string;
    preferred_tax_group?: string;
    internal_notes?: string;
}

// ─── Tax regime constants ────────────────────────────────────────────────────

const GST_TREATMENT_OPTIONS = [
    { label: 'Registered Business', value: 'registered_business' },
    { label: 'Unregistered Business', value: 'unregistered_business' },
    { label: 'Consumer', value: 'consumer' },
    { label: 'Composition Dealer', value: 'composition_dealer' },
    { label: 'SEZ', value: 'sez' },
    { label: 'SEZ Developer', value: 'sez_developer' },
    { label: 'Overseas', value: 'overseas' },
    { label: 'Government Body', value: 'government_body' },
];
const GST_TREATMENT_LABELS: Record<string, string> = Object.fromEntries(GST_TREATMENT_OPTIONS.map(o => [o.value, o.label]));

const VAT_TREATMENT_OPTIONS = [
    { label: 'Standard Rated', value: 'standard_rated' },
    { label: 'Zero Rated', value: 'zero_rated' },
    { label: 'Exempt', value: 'exempt' },
    { label: 'Out of Scope', value: 'out_of_scope' },
    { label: 'Reverse Charge', value: 'reverse_charge' },
];
const VAT_TREATMENT_LABELS: Record<string, string> = Object.fromEntries(VAT_TREATMENT_OPTIONS.map(o => [o.value, o.label]));

const PAYMENT_TERMS_OPTIONS = [
    { label: 'Due on Receipt', value: 'due_on_receipt' },
    { label: 'Net 7', value: 'net_7' },
    { label: 'Net 15', value: 'net_15' },
    { label: 'Net 30', value: 'net_30' },
    { label: 'Net 45', value: 'net_45' },
    { label: 'Net 60', value: 'net_60' },
    { label: 'Custom', value: 'custom' },
];
const PAYMENT_TERMS_LABELS: Record<string, string> = Object.fromEntries(PAYMENT_TERMS_OPTIONS.map(o => [o.value, o.label]));

type TaxRegime = 'gst' | 'vat' | 'us' | 'generic';

function resolveTaxRegime(taxRegime?: string | null): TaxRegime {
    const r = (taxRegime || '').toLowerCase();
    if (r.includes('gst') || r === 'india') return 'gst';
    if (r.includes('vat')) return 'vat';
    if (r.includes('us') || r.includes('sales_tax')) return 'us';
    return 'generic';
}

// ─── Address helpers ─────────────────────────────────────────────────────────

const emptyAddress = (): AddressShape => ({ street: '', street2: '', city: '', state: '', postal_code: '', country: '' });

const addressIsEmpty = (a?: AddressShape | null): boolean =>
    !a || !(a.street || a.street2 || a.city || a.state || a.postal_code || a.country);

const formatAddress = (a?: AddressShape | null): string => {
    if (addressIsEmpty(a)) return '—';
    return [a!.street, a!.street2, a!.city, a!.state, a!.postal_code, a!.country].filter(Boolean).join(', ');
};

// ─── Shared input class ──────────────────────────────────────────────────────

const FIELD_CLS = 'w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50';

// ─── Props ───────────────────────────────────────────────────────────────────

interface CustomerDetailsPanelProps {
    lead: any;
    onUpdate: (updatedLead: any) => void;
    showToast: (message: string, type: 'success' | 'error') => void;
    partners?: Partner[];
}

const ACQUISITION_SOURCE_LABELS: Record<string, string> = {
    storefront_registration: 'Storefront Registration',
    guest_checkout: 'Guest Checkout',
    pos_inline: 'POS Inline',
    manual_entry: 'Manual Entry',
    lead_promotion: 'Lead Promotion',
};

// ─── Component ───────────────────────────────────────────────────────────────

const CustomerDetailsPanel: React.FC<CustomerDetailsPanelProps> = ({ lead, onUpdate, showToast, partners = [] }) => {
    const formatters = useCRMFormatters();
    const { settings: bizSettings } = useBusinessSettings();
    const taxRegime = resolveTaxRegime(bizSettings?.tax_regime);

    // ── Tax ID & Credit Limit state ──────────────────────────────────────────
    const [taxIdInput, setTaxIdInput] = useState(lead.tax_id || '');
    const [creditLimitInput, setCreditLimitInput] = useState(String(lead.credit_limit || 0));
    const [signOpen, setSignOpen] = useState(false);
    const { isModuleEnabled } = useShell();
    const isSignEnabled = isModuleEnabled('sign');
    const [isValidatingTax, setIsValidatingTax] = useState(false);
    const [isSavingCredit, setIsSavingCredit] = useState(false);
    const [taxError, setTaxError] = useState<string | null>(null);

    const handleValidateTaxId = async () => {
        if (!taxIdInput.trim()) return;
        setIsValidatingTax(true);
        setTaxError(null);
        try {
            const updated = await crmService.validateCustomerTaxId(lead.id, taxIdInput.trim());
            onUpdate(updated);
            showToast('Tax ID validated successfully', 'success');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || 'Validation failed';
            setTaxError(msg);
            showToast(msg, 'error');
        } finally {
            setIsValidatingTax(false);
        }
    };

    const handleSaveCreditLimit = async () => {
        const limit = parseFloat(creditLimitInput);
        if (isNaN(limit) || limit < 0) return;
        setIsSavingCredit(true);
        try {
            const updated = await crmService.updateCustomerCreditLimit(lead.id, limit);
            onUpdate(updated);
            showToast('Credit limit updated', 'success');
        } catch (err: any) {
            showToast(err?.message || 'Failed to update credit limit', 'error');
        } finally {
            setIsSavingCredit(false);
        }
    };

    // ── Business profile state ───────────────────────────────────────────────
    const [profile, setProfile] = useState<BusinessProfileShape | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [draft, setDraft] = useState<BusinessProfileShape>({});
    const [shippingSame, setShippingSame] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!lead?.id) return;
            setIsLoadingProfile(true);
            try {
                const data = await crmService.getCustomerBusinessProfile(lead.id);
                if (!cancelled) setProfile(data || {});
            } catch {
                if (!cancelled) setProfile({});
            } finally {
                if (!cancelled) setIsLoadingProfile(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [lead?.id]);

    // ── Customer invoices (Accounting cross-module, read-only) ───────────────
    const [invoices, setInvoices] = useState<any[]>([]);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const customerId = lead?.core_partner_id || lead?.id;
        const load = async () => {
            if (!customerId) return;
            setIsLoadingInvoices(true);
            try {
                const data = await crmService.getCustomerInvoices(customerId);
                if (!cancelled) setInvoices(Array.isArray(data) ? data : []);
            } catch {
                if (!cancelled) setInvoices([]);
            } finally {
                if (!cancelled) setIsLoadingInvoices(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [lead?.core_partner_id, lead?.id]);

    const invoiceCount = invoices.length;
    const totalPurchaseValue = invoices.reduce(
        (sum, inv) => sum + (Number(inv?.total_amount) || 0),
        0,
    );
    const recentInvoices = [...invoices]
        .sort((a, b) => {
            const da = new Date(a?.issue_date || a?.created_at || 0).getTime();
            const db = new Date(b?.issue_date || b?.created_at || 0).getTime();
            return db - da;
        })
        .slice(0, 5);

    const beginEditProfile = () => {
        const billing = { ...emptyAddress(), ...(profile?.billing_address || {}) };
        const shipping = { ...emptyAddress(), ...(profile?.shipping_address || {}) };
        setDraft({
            business_name: profile?.business_name || '',
            legal_entity_name: profile?.legal_entity_name || '',
            gst_number: profile?.gst_number || '',
            gst_treatment: profile?.gst_treatment || '',
            place_of_supply: profile?.place_of_supply || '',
            pan_number: profile?.pan_number || '',
            vat_number: profile?.vat_number || '',
            vat_treatment: profile?.vat_treatment || '',
            tax_exempt_id: profile?.tax_exempt_id || '',
            business_type: profile?.business_type || '',
            billing_address: billing,
            shipping_address: shipping,
            payment_terms: profile?.payment_terms || '',
            customer_currency: profile?.customer_currency || bizSettings?.base_currency || '',
            preferred_tax_group: profile?.preferred_tax_group || '',
            internal_notes: profile?.internal_notes || '',
        });
        setShippingSame(addressIsEmpty(profile?.shipping_address));
        setIsEditingProfile(true);
    };

    const setDraftField = (patch: Partial<BusinessProfileShape>) => setDraft(prev => ({ ...prev, ...patch }));
    const setDraftBilling = (patch: Partial<AddressShape>) =>
        setDraft(prev => ({ ...prev, billing_address: { ...(prev.billing_address || {}), ...patch } }));
    const setDraftShipping = (patch: Partial<AddressShape>) =>
        setDraft(prev => ({ ...prev, shipping_address: { ...(prev.shipping_address || {}), ...patch } }));

    const handleSaveProfile = async () => {
        setIsSavingProfile(true);
        try {
            const payload: BusinessProfileShape = {
                business_name: draft.business_name?.trim() || undefined,
                legal_entity_name: draft.legal_entity_name?.trim() || undefined,
                gst_number: draft.gst_number?.trim() || undefined,
                gst_treatment: draft.gst_treatment || undefined,
                place_of_supply: draft.place_of_supply?.trim() || undefined,
                pan_number: draft.pan_number?.trim() || undefined,
                vat_number: draft.vat_number?.trim() || undefined,
                vat_treatment: draft.vat_treatment || undefined,
                tax_exempt_id: draft.tax_exempt_id?.trim() || undefined,
                business_type: draft.business_type?.trim() || undefined,
                billing_address: draft.billing_address || emptyAddress(),
                shipping_address: shippingSame
                    ? (draft.billing_address || emptyAddress())
                    : (draft.shipping_address || emptyAddress()),
                payment_terms: draft.payment_terms || undefined,
                customer_currency: draft.customer_currency?.trim() || undefined,
                preferred_tax_group: draft.preferred_tax_group?.trim() || undefined,
                internal_notes: draft.internal_notes?.trim() || undefined,
            };
            const updated = await crmService.updateCustomerBusinessProfile(lead.id, payload);
            setProfile(updated || payload);
            setIsEditingProfile(false);
            showToast('Business profile saved', 'success');
        } catch (err: any) {
            showToast(err?.response?.data?.message || err?.message || 'Failed to save business profile', 'error');
        } finally {
            setIsSavingProfile(false);
        }
    };

    // ── Tax field renderers (regime-aware) ───────────────────────────────────

    const renderTaxView = () => {
        if (taxRegime === 'gst') return (
            <>
                {([
                    ['GST Treatment', profile?.gst_treatment ? (GST_TREATMENT_LABELS[profile.gst_treatment] || profile.gst_treatment) : ''],
                    ['GST Number', profile?.gst_number],
                    ['Place of Supply', profile?.place_of_supply],
                    ['PAN Number', profile?.pan_number],
                ] as [string, string | undefined][]).map(([label, value]) => (
                    <div key={label} className="flex items-start gap-3">
                        <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
                        <span className="text-xs text-slate-200 break-words">{value || '—'}</span>
                    </div>
                ))}
            </>
        );
        if (taxRegime === 'vat') return (
            <>
                {([
                    ['VAT Treatment', profile?.vat_treatment ? (VAT_TREATMENT_LABELS[profile.vat_treatment] || profile.vat_treatment) : ''],
                    ['VAT Number', profile?.vat_number],
                ] as [string, string | undefined][]).map(([label, value]) => (
                    <div key={label} className="flex items-start gap-3">
                        <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
                        <span className="text-xs text-slate-200 break-words">{value || '—'}</span>
                    </div>
                ))}
            </>
        );
        if (taxRegime === 'us') return (
            <div className="flex items-start gap-3">
                <span className="text-xs text-slate-500 w-28 shrink-0">Tax Exempt ID</span>
                <span className="text-xs text-slate-200 break-words">{profile?.tax_exempt_id || '—'}</span>
            </div>
        );
        return null;
    };

    const renderTaxEdit = () => {
        if (taxRegime === 'gst') return (
            <>
                <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">GST Treatment</label>
                    <select value={draft.gst_treatment || ''} onChange={e => setDraftField({ gst_treatment: e.target.value })} className={FIELD_CLS}>
                        <option value="">Select…</option>
                        {GST_TREATMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">GST Number</label>
                    <input value={draft.gst_number || ''} onChange={e => setDraftField({ gst_number: e.target.value.toUpperCase() })} placeholder="29ABCDE1234F1Z5" className={`${FIELD_CLS} font-mono`} />
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Place of Supply</label>
                    <input value={draft.place_of_supply || ''} onChange={e => setDraftField({ place_of_supply: e.target.value })} className={FIELD_CLS} />
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">PAN Number</label>
                    <input value={draft.pan_number || ''} onChange={e => setDraftField({ pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" className={`${FIELD_CLS} font-mono`} />
                </div>
            </>
        );
        if (taxRegime === 'vat') return (
            <>
                <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">VAT Treatment</label>
                    <select value={draft.vat_treatment || ''} onChange={e => setDraftField({ vat_treatment: e.target.value })} className={FIELD_CLS}>
                        <option value="">Select…</option>
                        {VAT_TREATMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">VAT Number</label>
                    <input value={draft.vat_number || ''} onChange={e => setDraftField({ vat_number: e.target.value.toUpperCase() })} placeholder="e.g. GB123456789" className={`${FIELD_CLS} font-mono`} />
                </div>
            </>
        );
        if (taxRegime === 'us') return (
            <div className="col-span-2">
                <label className="text-[11px] text-slate-500 mb-1 block">Tax Exempt ID / EIN</label>
                <input value={draft.tax_exempt_id || ''} onChange={e => setDraftField({ tax_exempt_id: e.target.value })} placeholder="e.g. 12-3456789" className={FIELD_CLS} />
            </div>
        );
        return null;
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
                <Building2 size={16} className="text-emerald-400" />
                Customer Details
            </h3>

            {/* Category Badge */}
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-24">Category</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border ${
                    lead.customer_category === 'b2b'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                }`}>
                    {(lead.customer_category || 'b2c').toUpperCase()}
                </span>
            </div>

            {/* Acquisition Source */}
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-24">Source</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Tag size={11} />
                    {ACQUISITION_SOURCE_LABELS[lead.acquisition_source] || lead.acquisition_source || lead.channel || '-'}
                </span>
            </div>

            {/* Referred By */}
            {lead.referred_by && (
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-24 flex items-center gap-1">
                        <Users size={11} /> Referred By
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {partners.find(p => p.id === lead.referred_by)?.company_name || lead.referred_by}
                    </span>
                </div>
            )}

            {/* First Order */}
            {lead.first_order_id && (
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-24">First Order</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                        <ShoppingCart size={11} />
                        {lead.first_order_id.substring(0, 8)}...
                    </span>
                </div>
            )}

            {/* Tax ID & Credit Limit — B2B only */}
            {lead.customer_category === 'b2b' && (
                <>
                    {/* Tax ID */}
                    <div className="border-t border-slate-800 pt-4">
                        <label className="text-xs text-slate-500 mb-2 block flex items-center gap-1.5">
                            <Shield size={12} /> Tax ID (GST / VAT / TIN)
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={taxIdInput}
                                    onChange={(e) => { setTaxIdInput(e.target.value.toUpperCase()); setTaxError(null); }}
                                    placeholder="e.g. 29ABCDE1234F1Z5"
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                />
                                {lead.tax_id_verified && (
                                    <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                                )}
                            </div>
                            <button
                                onClick={handleValidateTaxId}
                                disabled={isValidatingTax || !taxIdInput.trim()}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                {isValidatingTax ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                                Validate
                            </button>
                        </div>
                        {taxError && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400">
                                <AlertCircle size={12} /> {taxError}
                            </div>
                        )}
                        {lead.tax_id_verified && lead.tax_id_verified_at && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                                <CheckCircle2 size={12} /> Verified on {parseUtcDate(lead.tax_id_verified_at).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    {/* Credit Limit */}
                    <div className="border-t border-slate-800 pt-4">
                        <label className="text-xs text-slate-500 mb-2 block flex items-center gap-1.5">
                            <CreditCard size={12} /> Credit Limit
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={creditLimitInput}
                                onChange={(e) => setCreditLimitInput(e.target.value)}
                                min="0"
                                step="1000"
                                className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                            <button
                                onClick={handleSaveCreditLimit}
                                disabled={isSavingCredit}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-50 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                {isSavingCredit ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                                Save
                            </button>
                        </div>
                        {parseFloat(lead.credit_balance) > 0 && (
                            <div className="mt-2 text-xs text-slate-400">
                                Current balance: {formatters.formatCurrency(parseFloat(lead.credit_balance))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Request Signature */}
            {isSignEnabled && (
            <div className="border-t border-slate-800 pt-4">
                <button
                    type="button"
                    onClick={() => setSignOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                >
                    <FileSignature size={14} /> Request Signature
                </button>
                {signOpen && (
                    <SignRequestModal
                        onClose={() => setSignOpen(false)}
                        prefillName={lead?.contact_name ?? ''}
                        prefillEmail={lead?.contact_email ?? ''}
                        sourceModel="crm.customer"
                        sourceId={lead?.id ?? ''}
                    />
                )}
            </div>
            )}

            {/* ─── Business Information ────────────────────────────────────────── */}
            <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <Building2 size={12} className="text-emerald-400" /> Business Information
                    </span>
                    {!isEditingProfile ? (
                        <button
                            onClick={beginEditProfile}
                            disabled={isLoadingProfile}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <Pencil size={12} /> Edit
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsEditingProfile(false)}
                                disabled={isSavingProfile}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                <X size={12} /> Cancel
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                disabled={isSavingProfile}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-slate-50 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                {isSavingProfile ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                            </button>
                        </div>
                    )}
                </div>

                {isLoadingProfile ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 size={12} className="animate-spin" /> Loading profile…
                    </div>
                ) : !isEditingProfile ? (
                    /* ── View mode ── */
                    <div className="space-y-2">
                        {([
                            ['Business Name', profile?.business_name],
                            ['Legal Entity', profile?.legal_entity_name],
                            ['Business Type', profile?.business_type],
                        ] as [string, string | undefined][]).map(([label, value]) => (
                            <div key={label} className="flex items-start gap-3">
                                <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
                                <span className="text-xs text-slate-200 break-words">{value || '—'}</span>
                            </div>
                        ))}
                        {renderTaxView()}
                        <div className="flex items-start gap-3 pt-1">
                            <span className="text-xs text-slate-500 w-28 shrink-0 flex items-center gap-1"><MapPin size={11} /> Billing</span>
                            <span className="text-xs text-slate-200 break-words">{formatAddress(profile?.billing_address)}</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-xs text-slate-500 w-28 shrink-0 flex items-center gap-1"><MapPin size={11} /> Shipping</span>
                            <span className="text-xs text-slate-200 break-words">
                                {addressIsEmpty(profile?.shipping_address) ? 'Same as billing' : formatAddress(profile?.shipping_address)}
                            </span>
                        </div>
                    </div>
                ) : (
                    /* ── Edit mode ── */
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                                <label className="text-[11px] text-slate-500 mb-1 block">Business Name</label>
                                <input value={draft.business_name || ''} onChange={e => setDraftField({ business_name: e.target.value })} className={FIELD_CLS} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[11px] text-slate-500 mb-1 block">Legal Entity Name</label>
                                <input value={draft.legal_entity_name || ''} onChange={e => setDraftField({ legal_entity_name: e.target.value })} placeholder="Registered legal name (if different)" className={FIELD_CLS} />
                            </div>
                            {renderTaxEdit()}
                            <div className="col-span-2">
                                <label className="text-[11px] text-slate-500 mb-1 block">Business Type</label>
                                <input value={draft.business_type || ''} onChange={e => setDraftField({ business_type: e.target.value })} placeholder="e.g. Private Limited" className={FIELD_CLS} />
                            </div>
                        </div>

                        {/* Billing Address */}
                        <div>
                            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1"><MapPin size={11} /> Billing Address</div>
                            <div className="grid grid-cols-2 gap-2">
                                <input value={draft.billing_address?.street || ''} onChange={e => setDraftBilling({ street: e.target.value })} placeholder="Address Line 1" className={`col-span-2 ${FIELD_CLS}`} />
                                <input value={draft.billing_address?.street2 || ''} onChange={e => setDraftBilling({ street2: e.target.value })} placeholder="Address Line 2" className={`col-span-2 ${FIELD_CLS}`} />
                                <input value={draft.billing_address?.city || ''} onChange={e => setDraftBilling({ city: e.target.value })} placeholder="City" className={FIELD_CLS} />
                                <input value={draft.billing_address?.state || ''} onChange={e => setDraftBilling({ state: e.target.value })} placeholder="State / Province" className={FIELD_CLS} />
                                <input value={draft.billing_address?.postal_code || ''} onChange={e => setDraftBilling({ postal_code: e.target.value })} placeholder="Postal Code" className={FIELD_CLS} />
                                <input value={draft.billing_address?.country || ''} onChange={e => setDraftBilling({ country: e.target.value })} placeholder="Country" className={FIELD_CLS} />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-slate-400">
                            <input type="checkbox" checked={shippingSame} onChange={e => setShippingSame(e.target.checked)} className="rounded border-slate-700 bg-slate-950" />
                            Shipping same as Billing
                        </label>

                        {!shippingSame && (
                            <div>
                                <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1"><MapPin size={11} /> Shipping Address</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input value={draft.shipping_address?.street || ''} onChange={e => setDraftShipping({ street: e.target.value })} placeholder="Address Line 1" className={`col-span-2 ${FIELD_CLS}`} />
                                    <input value={draft.shipping_address?.street2 || ''} onChange={e => setDraftShipping({ street2: e.target.value })} placeholder="Address Line 2" className={`col-span-2 ${FIELD_CLS}`} />
                                    <input value={draft.shipping_address?.city || ''} onChange={e => setDraftShipping({ city: e.target.value })} placeholder="City" className={FIELD_CLS} />
                                    <input value={draft.shipping_address?.state || ''} onChange={e => setDraftShipping({ state: e.target.value })} placeholder="State / Province" className={FIELD_CLS} />
                                    <input value={draft.shipping_address?.postal_code || ''} onChange={e => setDraftShipping({ postal_code: e.target.value })} placeholder="Postal Code" className={FIELD_CLS} />
                                    <input value={draft.shipping_address?.country || ''} onChange={e => setDraftShipping({ country: e.target.value })} placeholder="Country" className={FIELD_CLS} />
                                </div>
                            </div>
                        )}

                        {/* Accounting Preferences */}
                        <div className="border-t border-slate-800/60 pt-3">
                            <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1">
                                <DollarSign size={11} /> Accounting Preferences
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[11px] text-slate-500 mb-1 block">Payment Terms</label>
                                    <select value={draft.payment_terms || ''} onChange={e => setDraftField({ payment_terms: e.target.value })} className={FIELD_CLS}>
                                        <option value="">Select…</option>
                                        {PAYMENT_TERMS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] text-slate-500 mb-1 block">Customer Currency</label>
                                    <input value={draft.customer_currency || ''} onChange={e => setDraftField({ customer_currency: e.target.value.toUpperCase() })} placeholder={bizSettings?.base_currency || 'e.g. USD'} className={`${FIELD_CLS} font-mono`} maxLength={3} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[11px] text-slate-500 mb-1 block">Preferred Tax Group</label>
                                    <input value={draft.preferred_tax_group || ''} onChange={e => setDraftField({ preferred_tax_group: e.target.value })} placeholder="e.g. Standard GST 18%" className={FIELD_CLS} />
                                </div>
                            </div>
                        </div>

                        {/* Internal Notes */}
                        <div className="border-t border-slate-800/60 pt-3">
                            <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1">
                                <FileText size={11} /> Internal Notes
                            </div>
                            <textarea
                                value={draft.internal_notes || ''}
                                onChange={e => setDraftField({ internal_notes: e.target.value })}
                                placeholder="Notes visible only to staff (sales, accounts, support)…"
                                rows={3}
                                className={`${FIELD_CLS} resize-none`}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Accounting Information (view mode) ─────────────────────────── */}
            {!isEditingProfile && (profile?.payment_terms || profile?.customer_currency || profile?.preferred_tax_group || profile?.internal_notes) && (
                <div className="border-t border-slate-800 pt-4 space-y-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                        <DollarSign size={12} className="text-blue-400" /> Accounting
                    </span>
                    {([
                        ['Payment Terms', profile?.payment_terms ? (PAYMENT_TERMS_LABELS[profile.payment_terms] || profile.payment_terms) : ''],
                        ['Currency', profile?.customer_currency],
                        ['Tax Group', profile?.preferred_tax_group],
                    ] as [string, string | undefined][]).map(([label, value]) => value ? (
                        <div key={label} className="flex items-start gap-3">
                            <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
                            <span className="text-xs text-slate-200 break-words">{value}</span>
                        </div>
                    ) : null)}
                    {profile?.internal_notes && (
                        <div className="flex items-start gap-3">
                            <span className="text-xs text-slate-500 w-28 shrink-0 flex items-center gap-1"><FileText size={11} /> Notes</span>
                            <span className="text-xs text-slate-300 break-words italic">{profile.internal_notes}</span>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Invoices (Accounting cross-module, read-only) ──────────────── */}
            <div className="border-t border-slate-800 pt-4">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider mb-3">
                    <FileText size={12} className="text-amber-400" /> Invoices
                </span>

                {isLoadingInvoices ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 size={12} className="animate-spin" /> Loading invoices…
                    </div>
                ) : invoiceCount === 0 ? (
                    <div className="text-xs text-slate-500">No invoices for this customer yet.</div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                                <div className="text-[11px] text-slate-500">Invoice Count</div>
                                <div className="text-lg font-semibold text-slate-100">{invoiceCount}</div>
                            </div>
                            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                                <div className="text-[11px] text-slate-500">Total Purchase Value</div>
                                <div className="text-lg font-semibold text-emerald-400">{formatters.formatCurrency(totalPurchaseValue)}</div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Recent Invoices</div>
                            {recentInvoices.map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between gap-2 bg-slate-950/40 border border-slate-800/60 rounded-lg px-3 py-2">
                                    <div className="min-w-0">
                                        <div className="text-xs text-slate-200 font-mono truncate">{inv.invoice_number || inv.id?.substring(0, 8)}</div>
                                        <div className="text-[11px] text-slate-500">
                                            {inv.issue_date ? parseUtcDate(inv.issue_date).toLocaleDateString() : '—'}
                                            {inv.status ? <span className="ml-2 capitalize">{inv.status}</span> : null}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-200 shrink-0">{formatters.formatCurrency(Number(inv.total_amount) || 0)}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CustomerDetailsPanel;
