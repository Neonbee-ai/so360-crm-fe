import React, { useState, useEffect } from 'react';
import { Building2, CreditCard, Shield, CheckCircle2, AlertCircle, Loader2, Tag, ShoppingCart, Users, MapPin, Pencil, Save, X } from 'lucide-react';
import { crmService } from '../services/crmService';
import { useCRMFormatters } from '../utils/formatters';

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
    gst_number?: string;
    gst_treatment?: string;
    place_of_supply?: string;
    business_type?: string;
    pan_number?: string;
    billing_address?: AddressShape | null;
    shipping_address?: AddressShape | null;
}

const GST_TREATMENT_OPTIONS: { label: string; value: string }[] = [
    { label: 'Registered Business', value: 'registered_business' },
    { label: 'Unregistered Business', value: 'unregistered_business' },
    { label: 'Consumer', value: 'consumer' },
    { label: 'Composition Dealer', value: 'composition_dealer' },
    { label: 'SEZ', value: 'sez' },
    { label: 'SEZ Developer', value: 'sez_developer' },
    { label: 'Overseas', value: 'overseas' },
    { label: 'Government Body', value: 'government_body' },
];

const GST_TREATMENT_LABELS: Record<string, string> = Object.fromEntries(
    GST_TREATMENT_OPTIONS.map(o => [o.value, o.label]),
);

const emptyAddress = (): AddressShape => ({ street: '', street2: '', city: '', state: '', postal_code: '', country: '' });

const addressIsEmpty = (a?: AddressShape | null): boolean =>
    !a || !(a.street || a.street2 || a.city || a.state || a.postal_code || a.country);

const formatAddress = (a?: AddressShape | null): string => {
    if (addressIsEmpty(a)) return '—';
    return [a!.street, a!.street2, a!.city, a!.state, a!.postal_code, a!.country].filter(Boolean).join(', ');
};

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

const CustomerDetailsPanel: React.FC<CustomerDetailsPanelProps> = ({ lead, onUpdate, showToast, partners = [] }) => {
    const formatters = useCRMFormatters();
    const [taxIdInput, setTaxIdInput] = useState(lead.tax_id || '');
    const [creditLimitInput, setCreditLimitInput] = useState(String(lead.credit_limit || 0));
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

    // ─── Business Profile (canonical Core partners row, shared with Accounting) ───
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

    const beginEditProfile = () => {
        const billing = { ...emptyAddress(), ...(profile?.billing_address || {}) };
        const shipping = { ...emptyAddress(), ...(profile?.shipping_address || {}) };
        const sameAsBilling = addressIsEmpty(profile?.shipping_address);
        setDraft({
            business_name: profile?.business_name || '',
            gst_number: profile?.gst_number || '',
            gst_treatment: profile?.gst_treatment || '',
            place_of_supply: profile?.place_of_supply || '',
            business_type: profile?.business_type || '',
            pan_number: profile?.pan_number || '',
            billing_address: billing,
            shipping_address: shipping,
        });
        setShippingSame(sameAsBilling);
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
                gst_number: draft.gst_number?.trim() || undefined,
                gst_treatment: draft.gst_treatment || undefined,
                place_of_supply: draft.place_of_supply?.trim() || undefined,
                business_type: draft.business_type?.trim() || undefined,
                pan_number: draft.pan_number?.trim() || undefined,
                billing_address: draft.billing_address || emptyAddress(),
                shipping_address: shippingSame ? (draft.billing_address || emptyAddress()) : (draft.shipping_address || emptyAddress()),
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
                    {/* Tax ID Section */}
                    <div className="border-t border-slate-800 pt-4">
                        <label className="text-xs text-slate-500 mb-2 block flex items-center gap-1.5">
                            <Shield size={12} /> Tax ID (GST/VAT/TIN)
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
                                <CheckCircle2 size={12} /> Verified on {new Date(lead.tax_id_verified_at).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    {/* Credit Limit Section */}
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

            {/* ─── Business Information (canonical Core partners row) ─── */}
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
                    <div className="space-y-2">
                        {[
                            ['Business Name', profile?.business_name],
                            ['GST Treatment', profile?.gst_treatment ? (GST_TREATMENT_LABELS[profile.gst_treatment] || profile.gst_treatment) : ''],
                            ['GST Number', profile?.gst_number],
                            ['Place of Supply', profile?.place_of_supply],
                            ['PAN Number', profile?.pan_number],
                            ['Business Type', profile?.business_type],
                        ].map(([label, value]) => (
                            <div key={label as string} className="flex items-start gap-3">
                                <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
                                <span className="text-xs text-slate-200 break-words">{value || '—'}</span>
                            </div>
                        ))}
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
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                                <label className="text-[11px] text-slate-500 mb-1 block">Business Name</label>
                                <input value={draft.business_name || ''} onChange={e => setDraftField({ business_name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                            </div>
                            <div>
                                <label className="text-[11px] text-slate-500 mb-1 block">GST Treatment</label>
                                <select value={draft.gst_treatment || ''} onChange={e => setDraftField({ gst_treatment: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                                    <option value="">Select…</option>
                                    {GST_TREATMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] text-slate-500 mb-1 block">GST Number</label>
                                <input value={draft.gst_number || ''} onChange={e => setDraftField({ gst_number: e.target.value.toUpperCase() })} placeholder="29ABCDE1234F1Z5" className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                            </div>
                            <div>
                                <label className="text-[11px] text-slate-500 mb-1 block">Place of Supply</label>
                                <input value={draft.place_of_supply || ''} onChange={e => setDraftField({ place_of_supply: e.target.value })} className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                            </div>
                            <div>
                                <label className="text-[11px] text-slate-500 mb-1 block">PAN Number</label>
                                <input value={draft.pan_number || ''} onChange={e => setDraftField({ pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[11px] text-slate-500 mb-1 block">Business Type</label>
                                <input value={draft.business_type || ''} onChange={e => setDraftField({ business_type: e.target.value })} placeholder="e.g. Private Limited" className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1"><MapPin size={11} /> Billing Address</div>
                            <div className="grid grid-cols-2 gap-2">
                                <input value={draft.billing_address?.street || ''} onChange={e => setDraftBilling({ street: e.target.value })} placeholder="Address Line 1" className="col-span-2 bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                <input value={draft.billing_address?.street2 || ''} onChange={e => setDraftBilling({ street2: e.target.value })} placeholder="Address Line 2" className="col-span-2 bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                <input value={draft.billing_address?.city || ''} onChange={e => setDraftBilling({ city: e.target.value })} placeholder="City" className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                <input value={draft.billing_address?.state || ''} onChange={e => setDraftBilling({ state: e.target.value })} placeholder="State" className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                <input value={draft.billing_address?.postal_code || ''} onChange={e => setDraftBilling({ postal_code: e.target.value })} placeholder="PIN Code" className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                <input value={draft.billing_address?.country || ''} onChange={e => setDraftBilling({ country: e.target.value })} placeholder="Country" className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
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
                                    <input value={draft.shipping_address?.street || ''} onChange={e => setDraftShipping({ street: e.target.value })} placeholder="Address Line 1" className="col-span-2 bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                    <input value={draft.shipping_address?.street2 || ''} onChange={e => setDraftShipping({ street2: e.target.value })} placeholder="Address Line 2" className="col-span-2 bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                    <input value={draft.shipping_address?.city || ''} onChange={e => setDraftShipping({ city: e.target.value })} placeholder="City" className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                    <input value={draft.shipping_address?.state || ''} onChange={e => setDraftShipping({ state: e.target.value })} placeholder="State" className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                    <input value={draft.shipping_address?.postal_code || ''} onChange={e => setDraftShipping({ postal_code: e.target.value })} placeholder="PIN Code" className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                    <input value={draft.shipping_address?.country || ''} onChange={e => setDraftShipping({ country: e.target.value })} placeholder="Country" className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerDetailsPanel;
