import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { partnersApi, settingsApi, crmService } from '../services/crmService';
import { ListPageTemplate, Pagination, Button, DataTable, SearchInput, TextField, Select, type DataTableColumn, type FilterValues, type ListFilterConfig } from '@so360/design-system';
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
                            <TextField name="first_name" label="First Name" required value={form.first_name}
                                onChange={e => { setForm(f => ({ ...f, first_name: e.target.value })); setFieldErrors(p => ({ ...p, first_name: validateFirstNameRequired(e.target.value) })); }}
                                onBlur={e => setFieldErrors(p => ({ ...p, first_name: validateFirstNameRequired(e.target.value) }))}
                                error={fieldErrors.first_name || undefined} placeholder="Dhanooj" />
                            <TextField name="last_name" label="Last Name" required value={form.last_name}
                                onChange={e => { setForm(f => ({ ...f, last_name: e.target.value })); setFieldErrors(p => ({ ...p, last_name: validateLastName(e.target.value) })); }}
                                onBlur={e => setFieldErrors(p => ({ ...p, last_name: validateLastName(e.target.value) }))}
                                error={fieldErrors.last_name || undefined} placeholder="B S" />
                        </div>

                        {/* Company Name */}
                        <TextField name="company_name" label="Company Name" value={form.company_name}
                            onChange={e => { setForm(f => ({ ...f, company_name: e.target.value })); setFieldErrors(p => ({ ...p, company_name: validateCompanyName(e.target.value) })); }}
                            onBlur={e => setFieldErrors(p => ({ ...p, company_name: validateCompanyName(e.target.value) }))}
                            error={fieldErrors.company_name || undefined} placeholder="Moonhive Pvt Ltd" />

                        {/* Partner Type */}
                        <Select name="partner_type" label="Partner Type" required value={form.partner_type}
                            onChange={e => setForm(f => ({ ...f, partner_type: e.target.value }))}
                            options={[{ value: '', label: 'Select type...' }, ...partnerTypes.map(pt => ({ value: pt.value, label: pt.label }))]} />

                        {/* Architect Grading + Commission Rate */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <Select name="grading" label="Architect Grading" value={form.grading}
                                onChange={e => setForm(f => ({ ...f, grading: e.target.value }))}
                                options={[
                                    { value: '', label: 'Select grading...' },
                                    { value: 'low', label: 'Low' },
                                    { value: 'mid', label: 'Mid' },
                                    { value: 'high', label: 'High' },
                                ]} />
                            <TextField name="commission_rate" label="Royalty Rate (%)" type="number" min="0" max="100" step="0.5"
                                value={form.commission_rate}
                                onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                                placeholder="0" />
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
                            <TextField name="email" label="Email" type="email" value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="email@example.com" />
                            <TextField name="phone" label="Phone" type="tel" value={form.phone} maxLength={20}
                                onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setPhoneError(validatePhone(e.target.value)); }}
                                error={phoneError || undefined} placeholder="+91 98765 43210" />
                        </div>

                        {/* Alt Phone */}
                        <TextField name="alt_phone" label="Alt. Phone" type="tel" value={form.alt_phone} maxLength={20}
                            onChange={e => { setForm(f => ({ ...f, alt_phone: e.target.value })); setAltPhoneError(validatePhone(e.target.value)); }}
                            error={altPhoneError || undefined} placeholder="+91 98765 43211" />

                        {/* Address */}
                        <TextField name="address" label="Address" value={form.address}
                            onChange={e => { setForm(f => ({ ...f, address: e.target.value })); setFieldErrors(p => ({ ...p, address: validateAddress(e.target.value) })); }}
                            onBlur={e => setFieldErrors(p => ({ ...p, address: validateAddress(e.target.value) }))}
                            error={fieldErrors.address || undefined} placeholder="Street / area" />

                        {/* Country */}
                        <Select name="country" label="Country" value={form.country}
                            onChange={e => { const country = e.target.value; setForm(f => ({ ...f, country })); setFieldErrors(p => ({ ...p, pin_code: validatePostalCode(form.pin_code, country) })); }}
                            options={countryOptions().map(c => ({ value: c.code, label: c.name }))} />

                        {/* City + Pin Code */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <TextField name="city" label="City" value={form.city}
                                onChange={e => { setForm(f => ({ ...f, city: e.target.value })); setFieldErrors(p => ({ ...p, city: validateCity(e.target.value) })); }}
                                onBlur={e => setFieldErrors(p => ({ ...p, city: validateCity(e.target.value) }))}
                                error={fieldErrors.city || undefined} placeholder="Bangalore" />
                            <TextField name="pin_code"
                                label={`${postalRule.label}${postalRule.digits ? ` (${form.pin_code.replace(/\D/g, '').length}/${postalRule.digits} digits)` : ''}${!postalRule.pattern ? ` (not used in ${postalRule.name})` : ''}`}
                                inputMode={postalRule.numericOnly ? 'numeric' : 'text'} maxLength={postalRule.maxLength} value={form.pin_code}
                                onChange={e => { const v = postalRule.numericOnly ? e.target.value.replace(/\D/g, '').slice(0, postalRule.maxLength) : e.target.value; setForm(f => ({ ...f, pin_code: v })); setFieldErrors(p => ({ ...p, pin_code: validatePostalCode(v, form.country) })); }}
                                onBlur={e => setFieldErrors(p => ({ ...p, pin_code: validatePostalCode(e.target.value, form.country) }))}
                                error={fieldErrors.pin_code || undefined} placeholder={postalRule.example} />
                        </div>

                        {/* Relationship Manager */}
                        <Select name="owner_person_id" label="Relationship Manager" value={form.owner_person_id}
                            onChange={e => setForm(f => ({ ...f, owner_person_id: e.target.value }))}
                            options={[{ value: '', label: '— Assign RM —' }, ...users.map(u => ({ value: u.id, label: u.full_name }))]} />

                        {/* POC Primary + Secondary */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <TextField name="poc_primary" label="1st POC" value={form.poc_primary}
                                onChange={e => setForm(f => ({ ...f, poc_primary: e.target.value }))}
                                placeholder="Primary contact" />
                            <TextField name="poc_secondary" label="2nd POC" value={form.poc_secondary}
                                onChange={e => setForm(f => ({ ...f, poc_secondary: e.target.value }))}
                                placeholder="Secondary contact" />
                        </div>

                        {/* Customers Connected + Value of Purchase */}
                        <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                            <TextField name="customers_connected" label="Customers Connected" type="number" min="0" step="1" value={form.customers_connected}
                                onChange={e => setForm(f => ({ ...f, customers_connected: e.target.value }))}
                                placeholder="0" />
                            <TextField name="value_of_purchase" label="Value of Purchase" type="number" min="0" step="0.01" value={form.value_of_purchase}
                                onChange={e => setForm(f => ({ ...f, value_of_purchase: e.target.value }))}
                                placeholder="0" />
                        </div>

                        {/* Total Purchase Till Date */}
                        <TextField name="total_purchase_till_date" label="Total Purchase Till Date" type="number" min="0" step="0.01" value={form.total_purchase_till_date}
                            onChange={e => setForm(f => ({ ...f, total_purchase_till_date: e.target.value }))}
                            placeholder="0" />

                        {/* Custom Fields */}
                        {customFieldDefs.length > 0 && (
                            <div className="pt-4 border-t border-line space-y-4">
                                <p className="text-xs font-semibold text-fg-muted">Additional Details</p>
                                <div className="grid grid-cols-1 wc-medium:grid-cols-2 gap-nb-3">
                                    {customFieldDefs.map(field => (
                                        field.field_type === 'SELECT' ? (
                                            <Select key={field.id} name={`custom_${field.id}`} label={field.label} required={!!field.is_required}
                                                value={form.custom_fields[field.id] || ''}
                                                onChange={e => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [field.id]: e.target.value } }))}
                                                options={[{ value: '', label: '— Select —' }, ...(field.options || []).map((opt: string) => ({ value: opt, label: opt }))]} />
                                        ) : (
                                            <TextField key={field.id} name={`custom_${field.id}`} label={field.label} required={!!field.is_required}
                                                type={field.field_type === 'NUMBER' ? 'number' : field.field_type === 'DATE' ? 'date' : 'text'}
                                                value={form.custom_fields[field.id] || ''}
                                                onChange={e => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [field.id]: e.target.value } }))} />
                                        )
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

    const columns: DataTableColumn<any>[] = [
        {
            key: 'contact_name', header: 'Name', sortable: true,
            render: (p: any) => (
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-fg">{p.contact_name}</span>
                    {p.email && <span className="text-xs text-fg-muted">{p.email}</span>}
                </div>
            ),
        },
        {
            key: 'partner_type', header: 'Type', sortable: true,
            render: (p: any) => (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-info/10 text-info border-info/20">
                    {getPartnerTypeLabel(p.partner_type)}
                </span>
            ),
        },
        {
            key: 'grading', header: 'Grading', sortable: true,
            render: (p: any) => <GradingBadge grading={p.grading} />,
        },
        {
            key: 'total_deals', header: 'Deals', sortable: true, align: 'right',
            render: (p: any) => (
                <span className="text-fg-subtle text-sm font-medium">{p.total_deals || 0}</span>
            ),
        },
        {
            key: 'total_deal_value', header: 'Deal Value', sortable: true, align: 'right',
            render: (p: any) => (
                <span className="text-fg-subtle text-sm font-mono">
                    {formatters.formatCurrency(p.total_deal_value || 0)}
                </span>
            ),
        },
        {
            key: 'pending_commission', header: 'Royalty Pending', align: 'right',
            render: (p: any) => (
                <span className={`text-sm font-medium font-mono ${(p.pending_commission || 0) > 0 ? 'text-warning' : 'text-fg-muted'}`}>
                    {formatters.formatCurrency(p.pending_commission || 0)}
                </span>
            ),
        },
        {
            key: 'commission_rate', header: 'Royalty Rate', align: 'right',
            render: (p: any) => (
                <span className="text-fg-subtle text-sm font-mono">{p.commission_rate ? `${p.commission_rate}%` : '-'}</span>
            ),
        },
    ];

    const filterConfig: ListFilterConfig = {
        fields: [
            { key: 'type', label: 'Type', type: 'select', quick: true, options: partnerTypes.map((pt: any) => ({ value: pt.value, label: pt.label, count: partners.filter((p: any) => p.partner_type === pt.value).length })) },
        ],
        values: (typeFilter !== 'All' ? { type: typeFilter } : {}) as FilterValues,
        onChange: (next: FilterValues) => setTypeFilter((next.type as string) || 'All'),
        onClear: () => { setSearchTerm(''); setTypeFilter('All'); },
    };

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
            search={
                <SearchInput
                    placeholder="Search partners by name, email..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                />
            }
            filterConfig={filterConfig}
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
            <DataTable
                name="partners"
                data-testid="partners-table"
                rows={paginatedPartners}
                rowKey={(p: any) => p.id}
                columns={columns}
                loading={isLoading}
                onRowClick={(p: any) => navigate(`../partners/${p.id}`)}
                getRowProps={(p: any) => ({ 'data-testid': `partner-row-${p.id}` })}
                sortKey={sortField ?? undefined}
                sortDir={sortDirection ?? undefined}
                onSortChange={(key: string, dir: 'asc' | 'desc') => { setSortField(key as SortField); setSortDirection(dir); }}
                emptyState={error || 'No partners found. Add a partner to get started.'}
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
