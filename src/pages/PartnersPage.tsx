import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { partnersApi, settingsApi, crmService } from '../services/crmService';
import { ListPageTemplate, Pagination, Button } from '@so360/design-system';
import { Table } from '../components/common/Table';
import { PartnerStatusOverview } from '../components/partners/PartnerStatusOverview';
import { usePersistedState, useListScrollRestore } from '../hooks/useListViewState';
import { validatePhone } from '../utils/phoneValidation';
import {
    validateFirstNameRequired,
    validateLastName,
    validateCompanyName,
    validateAddress,
    validateCity,
} from '../utils/leadFieldValidation';
import {
    getPostalCodeRule,
    countryOptions,
    validatePostalCode,
    DEFAULT_COUNTRY,
} from '../utils/postalCodeRules';
import { useBusinessSettings } from '@so360/shell-context';
import { useFormatters } from '@so360/formatters';
import type { CustomFieldDefinition } from '../types/crm';
import { Modal } from '../components/common/Modal';

type SortField = 'contact_name' | 'partner_type' | 'grading' | 'total_deals' | 'total_deal_value';
type SortDirection = 'asc' | 'desc' | null;

const GRADING_CONFIG: Record<string, { label: string; color: string }> = {
    low:  { label: 'Low',  color: 'bg-fg-muted/10 text-fg-subtle border-line' },
    mid:  { label: 'Mid',  color: 'bg-info/10 text-info border-info/20' },
    high: { label: 'High', color: 'bg-success/10 text-success border-success/20' },
};

const AREA_OPTIONS = ['South India', 'North India', 'Central India', 'East India', 'West India'];

interface CreatePartnerModalProps {
    partnerTypes: any[];
    onClose: () => void;
    onCreated: () => void;
}

const CreatePartnerModal = ({ partnerTypes, onClose, onCreated }: CreatePartnerModalProps) => {
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        company_name: '',
        email: '',
        phone: '',
        alt_phone: '',
        address: '',
        city: '',
        pin_code: '',
        // Postal-code rules are country-specific; partners share the leads
        // table, so this lands on the same `country` column.
        country: DEFAULT_COUNTRY,
        partner_type: '',
        grading: '',
        area_served: [] as string[],
        commission_rate: '',
        owner_person_id: '',
        poc_primary: '',
        poc_secondary: '',
        customers_connected: '',
        value_of_purchase: '',
        total_purchase_till_date: '',
        custom_fields: {} as Record<string, any>,
    });
    const [users, setUsers] = useState<any[]>([]);
    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [altPhoneError, setAltPhoneError] = useState<string | null>(null);
    // Partners carry the same name/company/address/city/PIN fields as leads and
    // fed the same downstream search, invoices and mail merges, so they get the
    // same rules rather than a second, looser standard.
    const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

    const postalRule = getPostalCodeRule(form.country);

    useEffect(() => {
        Promise.all([
            crmService.getUsers().catch(() => []),
            settingsApi.customFields.getAll({ entity_type: 'PARTNER' }).catch(() => []),
        ]).then(([u, defs]) => {
            setUsers(u);
            setCustomFieldDefs(defs);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.first_name.trim() || !form.last_name.trim() || !form.partner_type) {
            setError('First name, last name, and partner type are required.');
            return;
        }
        const pErr = validatePhone(form.phone);
        const apErr = validatePhone(form.alt_phone);
        setPhoneError(pErr);
        setAltPhoneError(apErr);
        const nextFieldErrors = {
            first_name: validateFirstNameRequired(form.first_name),
            last_name: validateLastName(form.last_name),
            company_name: validateCompanyName(form.company_name),
            address: validateAddress(form.address),
            city: validateCity(form.city),
            pin_code: validatePostalCode(form.pin_code, form.country),
        };
        setFieldErrors(nextFieldErrors);
        if (pErr || apErr || Object.values(nextFieldErrors).some(Boolean)) return;
        setSaving(true);
        setError(null);
        try {
            await partnersApi.create({
                first_name: form.first_name,
                last_name: form.last_name,
                company_name: form.company_name || undefined,
                email: form.email || undefined,
                phone: form.phone || undefined,
                alt_phone: form.alt_phone || undefined,
                address: form.address || undefined,
                city: form.city || undefined,
                pin_code: form.pin_code || undefined,
                country: form.country || undefined,
                partner_type: form.partner_type,
                grading: form.grading || undefined,
                area_served: form.area_served.length ? form.area_served : undefined,
                commission_rate: form.commission_rate ? parseFloat(form.commission_rate) : 0,
                owner_person_id: form.owner_person_id || undefined,
                poc_primary: form.poc_primary || undefined,
                poc_secondary: form.poc_secondary || undefined,
                customers_connected: form.customers_connected ? parseInt(form.customers_connected, 10) : undefined,
                value_of_purchase: form.value_of_purchase ? parseFloat(form.value_of_purchase) : undefined,
                total_purchase_till_date: form.total_purchase_till_date ? parseFloat(form.total_purchase_till_date) : undefined,
                meta_data: Object.keys(form.custom_fields).length ? form.custom_fields : undefined,
            });
            onCreated();
        } catch (err: any) {
            setError(err.message || 'Failed to create partner');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = 'w-full bg-bg border border-line rounded-nb px-nb-3 py-nb-2 text-sm text-fg focus:outline-none focus:ring-2 ring-focus';
    const labelCls = 'text-xs text-fg-subtle mb-1 block';

    return (
        <Modal
            isOpen
            onClose={onClose}
            title="Add Partner"
            size="lg"
            dismissible={!saving}
            data-testid="create-partner-modal"
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="submit" form="create-partner-form" variant="primary" disabled={saving}>
                        {saving ? 'Creating...' : 'Create Partner'}
                    </Button>
                </>
            }
        >
                <form id="create-partner-form" onSubmit={handleSubmit}>
                    {error && <p className="text-danger text-sm mb-3">{error}</p>}
                    <div className="space-y-4">

                        {/* First Name + Last Name */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <div>
                                <label className={labelCls}>First Name *</label>
                                <input type="text" required value={form.first_name}
                                    onChange={e => { setForm(f => ({ ...f, first_name: e.target.value })); setFieldErrors(p => ({ ...p, first_name: validateFirstNameRequired(e.target.value) })); }}
                                    onBlur={e => setFieldErrors(p => ({ ...p, first_name: validateFirstNameRequired(e.target.value) }))}
                                    aria-invalid={!!fieldErrors.first_name}
                                    className={inputCls} placeholder="Dhanooj" />
                                {fieldErrors.first_name && <p className="text-danger text-xs mt-1">{fieldErrors.first_name}</p>}
                            </div>
                            <div>
                                <label className={labelCls}>Last Name *</label>
                                <input type="text" required value={form.last_name}
                                    onChange={e => { setForm(f => ({ ...f, last_name: e.target.value })); setFieldErrors(p => ({ ...p, last_name: validateLastName(e.target.value) })); }}
                                    onBlur={e => setFieldErrors(p => ({ ...p, last_name: validateLastName(e.target.value) }))}
                                    aria-invalid={!!fieldErrors.last_name}
                                    className={inputCls} placeholder="B S" />
                                {fieldErrors.last_name && <p className="text-danger text-xs mt-1">{fieldErrors.last_name}</p>}
                            </div>
                        </div>

                        {/* Company Name */}
                        <div>
                            <label className={labelCls}>Company Name</label>
                            <input type="text" value={form.company_name}
                                onChange={e => { setForm(f => ({ ...f, company_name: e.target.value })); setFieldErrors(p => ({ ...p, company_name: validateCompanyName(e.target.value) })); }}
                                onBlur={e => setFieldErrors(p => ({ ...p, company_name: validateCompanyName(e.target.value) }))}
                                aria-invalid={!!fieldErrors.company_name}
                                className={inputCls} placeholder="Moonhive Pvt Ltd" />
                            {fieldErrors.company_name && <p className="text-danger text-xs mt-1">{fieldErrors.company_name}</p>}
                        </div>

                        {/* Partner Type */}
                        <div>
                            <label className={labelCls}>Partner Type *</label>
                            <select required value={form.partner_type}
                                onChange={e => setForm(f => ({ ...f, partner_type: e.target.value }))}
                                className={inputCls}>
                                <option value="">Select type...</option>
                                {partnerTypes.map(pt => (
                                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Architect Grading + Commission Rate */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <div>
                                <label className={labelCls}>Architect Grading</label>
                                <select value={form.grading}
                                    onChange={e => setForm(f => ({ ...f, grading: e.target.value }))}
                                    className={inputCls}>
                                    <option value="">Select grading...</option>
                                    <option value="low">Low</option>
                                    <option value="mid">Mid</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Royalty Rate (%)</label>
                                <input type="number" min="0" max="100" step="0.5"
                                    value={form.commission_rate}
                                    onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                                    className={inputCls} placeholder="0" />
                            </div>
                        </div>

                        {/* Area Served */}
                        <div>
                            <label className={labelCls}>Area Served</label>
                            <div className="flex flex-wrap gap-2">
                                {AREA_OPTIONS.map(area => {
                                    const selected = form.area_served.includes(area);
                                    return (
                                        <button
                                            key={area}
                                            type="button"
                                            onClick={() => setForm(f => ({
                                                ...f,
                                                area_served: selected
                                                    ? f.area_served.filter(a => a !== area)
                                                    : [...f.area_served, area],
                                            }))}
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

                        {/* Email + Phone */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <div>
                                <label className={labelCls}>Email</label>
                                <input type="email" value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className={inputCls} placeholder="email@example.com" />
                            </div>
                            <div>
                                <label className={labelCls}>Phone</label>
                                <input type="tel" value={form.phone} maxLength={20}
                                    onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setPhoneError(validatePhone(e.target.value)); }}
                                    className={`${inputCls}${phoneError ? ' border-danger/60 focus:ring-danger/50' : ''}`} placeholder="+91 98765 43210" />
                                {phoneError && <p className="text-danger text-xs mt-1">{phoneError}</p>}
                            </div>
                        </div>

                        {/* Alt Phone */}
                        <div>
                            <label className={labelCls}>Alt. Phone</label>
                            <input type="tel" value={form.alt_phone} maxLength={20}
                                onChange={e => { setForm(f => ({ ...f, alt_phone: e.target.value })); setAltPhoneError(validatePhone(e.target.value)); }}
                                className={`${inputCls}${altPhoneError ? ' border-danger/60 focus:ring-danger/50' : ''}`} placeholder="+91 98765 43211" />
                            {altPhoneError && <p className="text-danger text-xs mt-1">{altPhoneError}</p>}
                        </div>

                        {/* Address */}
                        <div>
                            <label className={labelCls}>Address</label>
                            <input type="text" value={form.address}
                                onChange={e => { setForm(f => ({ ...f, address: e.target.value })); setFieldErrors(p => ({ ...p, address: validateAddress(e.target.value) })); }}
                                onBlur={e => setFieldErrors(p => ({ ...p, address: validateAddress(e.target.value) }))}
                                aria-invalid={!!fieldErrors.address}
                                className={inputCls} placeholder="Street / area" />
                            {fieldErrors.address && <p className="text-danger text-xs mt-1">{fieldErrors.address}</p>}
                        </div>

                        {/* Country */}
                        <div>
                            <label className={labelCls}>Country</label>
                            <select value={form.country}
                                onChange={e => { const country = e.target.value; setForm(f => ({ ...f, country })); setFieldErrors(p => ({ ...p, pin_code: validatePostalCode(form.pin_code, country) })); }}
                                className={inputCls}>
                                {countryOptions().map(c => (
                                    <option key={c.code} value={c.code}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* City + Pin Code */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <div>
                                <label className={labelCls}>City</label>
                                <input type="text" value={form.city}
                                    onChange={e => { setForm(f => ({ ...f, city: e.target.value })); setFieldErrors(p => ({ ...p, city: validateCity(e.target.value) })); }}
                                    onBlur={e => setFieldErrors(p => ({ ...p, city: validateCity(e.target.value) }))}
                                    aria-invalid={!!fieldErrors.city}
                                    className={inputCls} placeholder="Bangalore" />
                                {fieldErrors.city && <p className="text-danger text-xs mt-1">{fieldErrors.city}</p>}
                            </div>
                            <div>
                                <label className={labelCls}>
                                    {postalRule.label}
                                    {postalRule.digits && (
                                        <span className="ml-2 text-xs font-normal text-fg-muted normal-case">
                                            {form.pin_code.replace(/\D/g, '').length}/{postalRule.digits} digits
                                        </span>
                                    )}
                                    {!postalRule.pattern && (
                                        <span className="ml-2 text-xs font-normal text-fg-muted normal-case">not used in {postalRule.name}</span>
                                    )}
                                </label>
                                <input type="text" inputMode={postalRule.numericOnly ? 'numeric' : 'text'} maxLength={postalRule.maxLength} value={form.pin_code}
                                    onChange={e => { const v = postalRule.numericOnly ? e.target.value.replace(/\D/g, '').slice(0, postalRule.maxLength) : e.target.value; setForm(f => ({ ...f, pin_code: v })); setFieldErrors(p => ({ ...p, pin_code: validatePostalCode(v, form.country) })); }}
                                    onBlur={e => setFieldErrors(p => ({ ...p, pin_code: validatePostalCode(e.target.value, form.country) }))}
                                    aria-invalid={!!fieldErrors.pin_code}
                                    className={inputCls} placeholder={postalRule.example} />
                                {fieldErrors.pin_code && <p className="text-danger text-xs mt-1">{fieldErrors.pin_code}</p>}
                            </div>
                        </div>

                        {/* Relationship Manager */}
                        <div>
                            <label className={labelCls}>Relationship Manager</label>
                            <select value={form.owner_person_id}
                                onChange={e => setForm(f => ({ ...f, owner_person_id: e.target.value }))}
                                className={inputCls}>
                                <option value="">— Assign RM —</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* POC Primary + Secondary */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <div>
                                <label className={labelCls}>1st POC</label>
                                <input type="text" value={form.poc_primary}
                                    onChange={e => setForm(f => ({ ...f, poc_primary: e.target.value }))}
                                    className={inputCls} placeholder="Primary contact" />
                            </div>
                            <div>
                                <label className={labelCls}>2nd POC</label>
                                <input type="text" value={form.poc_secondary}
                                    onChange={e => setForm(f => ({ ...f, poc_secondary: e.target.value }))}
                                    className={inputCls} placeholder="Secondary contact" />
                            </div>
                        </div>

                        {/* Customers Connected + Value of Purchase */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <div>
                                <label className={labelCls}>Customers Connected</label>
                                <input type="number" min="0" step="1" value={form.customers_connected}
                                    onChange={e => setForm(f => ({ ...f, customers_connected: e.target.value }))}
                                    className={inputCls} placeholder="0" />
                            </div>
                            <div>
                                <label className={labelCls}>Value of Purchase</label>
                                <input type="number" min="0" step="0.01" value={form.value_of_purchase}
                                    onChange={e => setForm(f => ({ ...f, value_of_purchase: e.target.value }))}
                                    className={inputCls} placeholder="0" />
                            </div>
                        </div>

                        {/* Total Purchase Till Date */}
                        <div>
                            <label className={labelCls}>Total Purchase Till Date</label>
                            <input type="number" min="0" step="0.01" value={form.total_purchase_till_date}
                                onChange={e => setForm(f => ({ ...f, total_purchase_till_date: e.target.value }))}
                                className={inputCls} placeholder="0" />
                        </div>

                        {/* Custom Fields */}
                        {customFieldDefs.length > 0 && (
                            <div className="pt-4 border-t border-line space-y-4">
                                <p className="text-xs font-semibold text-fg-muted">Additional Details</p>
                                <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                                    {customFieldDefs.map(field => (
                                        <div key={field.id} className="space-y-1">
                                            <label className={labelCls}>{field.label}{field.is_required ? ' *' : ''}</label>
                                            {field.field_type === 'SELECT' ? (
                                                <select required={field.is_required}
                                                    value={form.custom_fields[field.id] || ''}
                                                    onChange={e => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [field.id]: e.target.value } }))}
                                                    className={inputCls}>
                                                    <option value="">— Select —</option>
                                                    {(field.options || []).map((opt: string) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    required={field.is_required}
                                                    type={field.field_type === 'NUMBER' ? 'number' : field.field_type === 'DATE' ? 'date' : 'text'}
                                                    value={form.custom_fields[field.id] || ''}
                                                    onChange={e => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [field.id]: e.target.value } }))}
                                                    className={inputCls} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </form>
        </Modal>
    );
};

const PartnersPage = () => {
    const navigate = useNavigate();
    const [partners, setPartners] = useState<any[]>([]);
    const [partnerTypes, setPartnerTypes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // View state survives a trip to a partner's detail page and back.
    const [searchTerm, setSearchTerm] = usePersistedState('partners.search', '');
    const [typeFilter, setTypeFilter] = usePersistedState('partners.type', 'All');
    const [sortField, setSortField] = usePersistedState<SortField | null>('partners.sortField', 'contact_name');
    const [sortDirection, setSortDirection] = usePersistedState<SortDirection>('partners.sortDirection', 'asc');
    const [currentPage, setCurrentPage] = usePersistedState('partners.page', 1);
    const [pageSize] = useState(20);

    const listAnchorRef = useRef<HTMLDivElement>(null);
    useListScrollRestore('partners', listAnchorRef, !isLoading);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const { settings } = useBusinessSettings();
    const formatters = useFormatters({
        currency: settings?.base_currency || 'USD',
        locale: settings?.document_language || 'en-US',
        timezone: settings?.timezone || 'UTC',
    });

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
        if (sortField !== field) return <ChevronsUpDown size={14} className="text-fg-muted" />;
        if (sortDirection === 'asc') return <ChevronUp size={14} className="text-primary" />;
        if (sortDirection === 'desc') return <ChevronDown size={14} className="text-primary" />;
        return <ChevronsUpDown size={14} className="text-fg-muted" />;
    };

    const SortableHeader = ({ label, field, align }: { label: string; field: SortField; align?: 'left' | 'right' }) => (
        <button
            onClick={() => toggleSort(field)}
            className={`flex items-center gap-1 hover:text-fg transition-colors cursor-pointer ${align === 'right' ? 'ml-auto' : ''}`}
        >
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
        if (!grading) return <span className="text-fg-muted text-sm">-</span>;
        const config = GRADING_CONFIG[grading] || GRADING_CONFIG.low;
        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                {config.label}
            </span>
        );
    };

    const getPartnerTypeLabel = (value: string) => {
        const found = partnerTypes.find(pt => pt.value === value);
        return found?.label || value || '-';
    };

    const columns = [
        {
            header: <SortableHeader label="Name" field="contact_name" />,
            accessor: (p: any) => (
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-fg">{p.contact_name}</span>
                    {p.email && <span className="text-xs text-fg-muted">{p.email}</span>}
                </div>
            ),
        },
        {
            header: <SortableHeader label="Type" field="partner_type" />,
            accessor: (p: any) => (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-info/10 text-info border-info/20">
                    {getPartnerTypeLabel(p.partner_type)}
                </span>
            ),
        },
        {
            header: <SortableHeader label="Grading" field="grading" />,
            accessor: (p: any) => <GradingBadge grading={p.grading} />,
        },
        {
            header: <SortableHeader label="Deals" field="total_deals" align="right" />,
            accessor: (p: any) => (
                <span className="text-fg-subtle text-sm font-medium">{p.total_deals || 0}</span>
            ),
            className: 'text-right',
        },
        {
            header: <SortableHeader label="Deal Value" field="total_deal_value" align="right" />,
            accessor: (p: any) => (
                <span className="text-fg-subtle text-sm font-mono">
                    {formatters.formatCurrency(p.total_deal_value || 0)}
                </span>
            ),
            className: 'text-right',
        },
        {
            header: 'Royalty Pending',
            accessor: (p: any) => (
                <span className={`text-sm font-medium font-mono ${(p.pending_commission || 0) > 0 ? 'text-warning' : 'text-fg-muted'}`}>
                    {formatters.formatCurrency(p.pending_commission || 0)}
                </span>
            ),
            className: 'text-right',
        },
        {
            header: 'Royalty Rate',
            accessor: (p: any) => (
                <span className="text-fg-subtle text-sm font-mono">{p.commission_rate ? `${p.commission_rate}%` : '-'}</span>
            ),
            className: 'text-right',
        },
    ];

    return (
        <ListPageTemplate
            title="Partners"
            description="Referral agents, resellers, and dealers who bring in deals"
            primaryAction={
                <Button onClick={() => setShowCreateModal(true)}>
                    <Plus size={16} />
                    Add Partner
                </Button>
            }
            kpis={<PartnerStatusOverview partners={partners} partnerTypes={partnerTypes} />}
            search={
                <div className="relative w-full wc-medium:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={16} />
                    <input
                        type="text"
                        placeholder="Search partners by name, email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-nb-control-md w-full rounded-nb border border-line bg-surface pl-10 pr-4 text-nb-body text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
            }
            filters={
                <>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="h-nb-control-md bg-surface border border-line text-fg px-3 rounded-nb text-sm focus:outline-none focus:border-primary"
                >
                    <option value="All">All Types</option>
                    {partnerTypes.map(pt => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                </select>
                {(searchTerm || typeFilter !== 'All') && (
                    <button onClick={() => { setSearchTerm(''); setTypeFilter('All'); }} className="h-nb-control-md px-3 rounded-nb text-xs text-fg-muted hover:text-fg hover:bg-surface-raised">
                        Clear Filters
                    </button>
                )}
                </>
            }
            pagination={filteredPartners.length > 0 ? (
                <Pagination
                    currentPage={currentPage}
                    totalPages={Math.max(1, totalPages)}
                    totalItems={filteredPartners.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    showPageSizeSelector={false}
                />
            ) : undefined}
        >
            <div ref={listAnchorRef}>
            <Table
                data={paginatedPartners}
                columns={columns}
                isLoading={isLoading}
                onRowClick={p => navigate(`../partners/${p.id}`)}
                emptyMessage={error || 'No partners found. Add a partner to get started.'}
            />

            </div>

            {showCreateModal && (
                <CreatePartnerModal
                    partnerTypes={partnerTypes}
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => { setShowCreateModal(false); fetchData(); }}
                />
            )}
        </ListPageTemplate>
    );
};

export default PartnersPage;
