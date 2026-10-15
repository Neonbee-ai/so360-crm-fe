import React, { useState, useEffect, useRef } from 'react';
import { Button, TextField, Select, Checkbox, NumberInput, DatePicker, Grid, GridItem } from '@so360/design-system';
import { Modal } from '../common/Modal';
import { PartnerSearchDropdown } from '../common/PartnerSearchDropdown';
import { crmService, settingsApi } from '../../services/crmService';
import { AlertCircle } from 'lucide-react';
import { CustomFieldDefinition, User, Lead, SourceTypeOption } from '../../types/crm';
import { useNotify, useActivity, useIdentity } from '@so360/shell-context';
import {
    validatePhone,
    validatePhoneRequired,
    phoneDigitCount,
    MIN_PHONE_DIGITS,
    MAX_PHONE_DIGITS,
} from '../../utils/phoneValidation';
import { validateEmail, validateEmailRequired } from '../../utils/emailValidation';
import {
    validateAddress,
    validateCity,
    validateCompanyName,
    validateFirstNameRequired,
    validateLastName,
    validatePinCode,
} from '../../utils/leadFieldValidation';
import {
    getPostalCodeRule,
    countryOptions,
    validatePostalCode,
    DEFAULT_COUNTRY,
} from '../../utils/postalCodeRules';
import { describeApiError } from '../../utils/apiErrorMessage';
import { isWonLeadStage } from '../../utils/leadStages';
import { parseDuplicateLead, type DuplicateLeadInfo } from '../../services/leadDedupService';
import { DuplicateLeadWarning } from './DuplicateLeadWarning';

/**
 * One rule per field, so the blur handler, the submit guard and the
 * enable/disable state on Create Lead all read from the same place. Before
 * this, only phone and email were checked and everything else — company,
 * names, address, city, PIN — reached the database unexamined.
 *
 * Built per country because the postal-code rule is the one field whose
 * definition of "valid" depends on another answer on the form.
 */
const buildFieldValidators = (
    country: string,
): Record<string, (value: string) => string | null> => ({
    company_name: validateCompanyName,
    first_name: validateFirstNameRequired,
    last_name: validateLastName,
    contact_email: (v) => validateEmailRequired(v),
    phone: (v) => validatePhoneRequired(v),
    alt_phone: validatePhone,
    address: validateAddress,
    city: validateCity,
    pin_code: (v) => validatePostalCode(v, country),
});

type FieldErrors = Partial<Record<string, string | null>>;

/**
 * Digits typed against the allowed range, so the limit is visible before the
 * user hits it rather than only as an error afterwards. Declaring +91 pins the
 * expectation to a single number, since that path allows exactly 10 subscriber
 * digits — showing "7–15" there would be misleading.
 */
const phoneCountLabel = (value: string): string => {
    const typed = phoneDigitCount(value);
    if (value.trim().startsWith('+91')) return `${typed}/12 digits`;
    return `${typed}/${MIN_PHONE_DIGITS}–${MAX_PHONE_DIGITS} digits`;
};

interface CreateLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    existingLeads: string[]; // List of company names to detect duplicates
}

export const CreateLeadModal = ({ isOpen, onClose, onSuccess, existingLeads }: CreateLeadModalProps) => {
    const { emitNotification } = useNotify();
    const { recordActivity } = useActivity();
    const { user: currentUser } = useIdentity();
    const [formData, setFormData] = useState({
        company_name: '',
        first_name: '',
        last_name: '',
        contact_email: '',
        phone: '',
        alt_phone: '',
        address: '',
        city: '',
        pin_code: '',
        // Postal-code rules differ by country, so the record carries its own
        // rather than inheriting a platform-wide assumption. `leads.country`
        // already existed as a column; nothing was writing to it.
        country: DEFAULT_COUNTRY,
        source: '',
        status: 'New' as any,
        owner_id: '',
        referred_by: '',
        custom_fields: {} as Record<string, any>
    });

    const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
    const [leadStages, setLeadStages] = useState<{ id: string, name: string }[]>([]);
    const [sourceTypes, setSourceTypes] = useState<SourceTypeOption[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [partners, setPartners] = useState<Lead[]>([]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const [settings, fetchedUsers, fetchedPartners, fetchedSourceTypes] = await Promise.all([
                    crmService.getSettings(),
                    crmService.getUsers(),
                    crmService.getPartners(),
                    settingsApi.sourceTypes.getAll().catch(() => [] as any[]),
                ]);
                setCustomFieldDefs(settings.lead_custom_fields);
                // A new lead can't start out already won. Picking "Converted"
                // here saved a lead that looked converted but was never made a
                // customer; won/converted is reached by moving an existing lead.
                setLeadStages(settings.lead_stages.filter(stage => !isWonLeadStage(stage.name)));
                setSourceTypes(fetchedSourceTypes);
                setUsers(fetchedUsers);
                setPartners(fetchedPartners);
                setFormData(prev => ({
                    ...prev,
                    ...(settings.lead_stages.length > 0 && !prev.status ? { status: settings.lead_stages[0].name } : {}),
                    ...(fetchedSourceTypes.length > 0 && !prev.source ? { source: fetchedSourceTypes[0].value } : {}),
                    owner_id: prev.owner_id || currentUser?.id || fetchedUsers[0]?.id || '',
                }));
            } catch (error) {
                console.error('Failed to fetch lead settings', error);
            }
        };
        if (isOpen) {
            setErrors({});
            setError(null);
            setExistingRecord(null);
            setDuplicateLead(null);
            fetchSettings();
        }
    }, [isOpen]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** A 409 from the backend: the address already belongs to this record. */
    const [existingRecord, setExistingRecord] = useState<{ id: string; type: string | null } | null>(null);
    const [duplicateLead, setDuplicateLead] = useState<DuplicateLeadInfo | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

    const phoneError = errors.phone || null;
    const emailError = errors.contact_email || null;

    const postalRule = getPostalCodeRule(formData.country);
    const fieldValidators = React.useMemo(
        () => buildFieldValidators(formData.country),
        [formData.country],
    );

    /** Re-run a field's rule and store the result. */
    const validateField = (name: string, value: string) => {
        const message = fieldValidators[name]?.(value) ?? null;
        setErrors(prev => ({ ...prev, [name]: message }));
        return message;
    };

    /**
     * Typing should clear a standing error the moment the value becomes valid,
     * but must not start nagging a field the user has not finished yet.
     */
    const handleChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => (prev[name] ? { ...prev, [name]: fieldValidators[name]?.(value) ?? null } : prev));
    };

    const missingRequiredCustomField = customFieldDefs.some(
        f => f.required && !String(formData.custom_fields[f.id] ?? '').trim(),
    );

    /**
     * Create Lead stays disabled until every mandatory field holds a valid
     * value and no optional field is currently invalid — so the button state
     * itself tells the user whether the form is ready.
     */
    const isFormValid =
        Object.keys(fieldValidators).every(
            name => !fieldValidators[name]((formData as any)[name] || ''),
        ) && !missingRequiredCustomField;

    const isDuplicate = existingLeads.some(
        name => name && (name as string).toLowerCase() === (formData.company_name || '').toLowerCase() && (formData.company_name || '').length > 0
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setDuplicateLead(null);

        // Format errors are caught here too, not only on blur: a value pasted
        // and submitted without ever leaving the field must still be checked.
        // Every field is re-run so the user sees the full set of corrections at
        // once, and focus lands on the first one that needs attention.
        const nextErrors: FieldErrors = {};
        for (const name of Object.keys(fieldValidators)) {
            nextErrors[name] = fieldValidators[name]((formData as any)[name] || '');
        }
        setErrors(nextErrors);

        const firstInvalid = Object.keys(fieldValidators).find(name => nextErrors[name]);
        if (firstInvalid) {
            fieldRefs.current[firstInvalid]?.focus();
            return;
        }

        setIsSubmitting(true);

        try {
            const newLead = await crmService.createLead({
                ...formData,
                phone: formData.phone.trim(),
                activities: [],
                notes: [],
                owner_id: formData.owner_id,
                referred_by: formData.referred_by || undefined,
            } as any);
            // Fire-and-forget notification + activity
            recordActivity({ eventType: 'lead.created', eventCategory: 'crm', description: `Created lead "${formData.company_name}"`, resourceType: 'lead', resourceId: newLead?.id }).catch(() => {});
            onSuccess();
            onClose();
        } catch (err) {
            // A6: a DUPLICATE_LEAD rejection gets its own actionable warning
            // (Open existing / Cancel) instead of the generic error banner.
            const dup = parseDuplicateLead(err);
            if (dup) {
                setExistingRecord(null);
                setDuplicateLead(dup);
                return;
            }
            const body = (err as { body?: { code?: string; existing_id?: string; existing_type?: string | null } })?.body;
            setExistingRecord(
                body?.code === 'DUPLICATE_EMAIL' && body.existing_id
                    ? { id: body.existing_id, type: body.existing_type ?? null }
                    : null,
            );
            // A rejection the backend explains (a 4xx: validation, duplicate,
            // quota, permission) carries a message worth showing verbatim.
            // Flattening every one of those into "Failed to create lead" was
            // exactly what left users with nothing to act on. Genuine
            // server-side faults keep a generic, honest message.
            setError(
                describeApiError(
                    err,
                    "We couldn't create the lead due to a server error. Please try again.",
                ),
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitDisabled = isSubmitting || !isFormValid;
    return (
        isOpen ? (
        <Modal
            isOpen
            onClose={onClose}
            title="Create New Lead"
            size="4xl"
            dismissible={!isSubmitting}
            data-testid="create-lead-form-page"
            footer={(
                <div data-slot="footer" className="contents">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button
                        type="submit"
                        form="create-lead-form"
                        // Disabled — not hidden — until the form is complete and
                        // valid: the button stays visible so users can see the
                        // action exists, and Cancel is always reachable.
                        disabled={submitDisabled}
                        aria-disabled={submitDisabled}
                        title={!isFormValid ? 'Complete all required fields with valid values to create the lead' : undefined}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Lead'}
                    </Button>
                </div>
            )}
        >
            <form id="create-lead-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-nb-4">
                {([
                        {
                            id: 'contact',
                            title: 'Contact',
                            content: (
                                <>
                                <GridItem span="full"><div className="space-y-3">
                                                {isDuplicate && (
                                                    <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm">
                                                        <AlertCircle size={18} className="shrink-0" />
                                                        <p>Potential duplicate detected. A lead with this company name already exists.</p>
                                                    </div>
                                                )}

                                                {duplicateLead && (
                                                    <DuplicateLeadWarning duplicate={duplicateLead} onCancel={onClose} />
                                                )}

                                                {error && (
                                                    <div className="flex items-start gap-3 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm" role="alert">
                                                        <AlertCircle size={18} className="shrink-0" />
                                                        <div>
                                                            <p>{error}</p>
                                                            {existingRecord && (
                                                                <a
                                                                    href={`/crm/${existingRecord.type === 'customer' ? 'customers' : 'leads'}/${existingRecord.id}`}
                                                                    className="underline text-danger hover:underline"
                                                                    data-testid="open-existing-record"
                                                                >
                                                                    Open the existing {existingRecord.type || 'record'} →
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                </div></GridItem>
                                                <GridItem span={{ md: 4, lg: 6 }}><TextField
                                                    name="company_name"
                                                    label="Company Name"
                                                    ref={(el: HTMLInputElement | null) => { fieldRefs.current.company_name = el; }}
                                                    type="text"
                                                    value={formData.company_name}
                                                    onChange={(e) => handleChange('company_name', e.target.value)}
                                                    onBlur={(e) => validateField('company_name', e.target.value)}
                                                    placeholder="e.g. Acme Corp"
                                                    error={errors.company_name || undefined}
                                                /></GridItem>

                                                <div className="contents">
                                                    <GridItem span={{ md: 4, lg: 6 }}><TextField
                                                        name="first_name"
                                                        label="First Name"
                                                        required
                                                        ref={(el: HTMLInputElement | null) => { fieldRefs.current.first_name = el; }}
                                                        type="text"
                                                        value={formData.first_name}
                                                        onChange={(e) => handleChange('first_name', e.target.value)}
                                                        onBlur={(e) => validateField('first_name', e.target.value)}
                                                        placeholder="e.g. John"
                                                        error={errors.first_name || undefined}
                                                    /></GridItem>
                                                    <GridItem span={{ md: 4, lg: 6 }}><TextField
                                                        name="last_name"
                                                        label="Last Name"
                                                        ref={(el: HTMLInputElement | null) => { fieldRefs.current.last_name = el; }}
                                                        type="text"
                                                        value={formData.last_name}
                                                        onChange={(e) => handleChange('last_name', e.target.value)}
                                                        onBlur={(e) => validateField('last_name', e.target.value)}
                                                        placeholder="e.g. Doe"
                                                        error={errors.last_name || undefined}
                                                    /></GridItem>
                                                </div>

                                                <div className="contents">
                                                    {/* `type="text"` deliberately: the browser's own popup
                                                        ("Please enter a part following '@'") pre-empted the
                                                        inline message and looked nothing like the rest of
                                                        the form. Validation is the app's job here. */}
                                                    <GridItem span={{ md: 4, lg: 6 }}><TextField
                                                        name="contact_email"
                                                        label="Contact Email"
                                                        required
                                                        ref={(el: HTMLInputElement | null) => { fieldRefs.current.contact_email = el; }}
                                                        type="text"
                                                        inputMode="email"
                                                        autoComplete="email"
                                                        value={formData.contact_email}
                                                        onChange={(e) => handleChange('contact_email', e.target.value)}
                                                        // Blur is the point the value is "finished", so an
                                                        // empty optional-looking field is reported as a format
                                                        // problem only once it holds something.
                                                        onBlur={(e) => setErrors(prev => ({ ...prev, contact_email: validateEmail(e.target.value) }))}
                                                        placeholder="name@company.com"
                                                        error={emailError || undefined}
                                                    /></GridItem>
                                                    <GridItem span={{ md: 4, lg: 6 }}><TextField
                                                        name="phone"
                                                        label="Phone"
                                                        required
                                                        hint={phoneCountLabel(formData.phone) || undefined}
                                                        ref={(el: HTMLInputElement | null) => { fieldRefs.current.phone = el; }}
                                                        type="tel"
                                                        value={formData.phone}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFormData(prev => ({ ...prev, phone: val }));
                                                            setErrors(prev => ({ ...prev, phone: val.trim() ? validatePhone(val) : null }));
                                                        }}
                                                        onBlur={(e) => validateField('phone', e.target.value)}
                                                        placeholder="+91 98765 43210"
                                                        error={phoneError || undefined}
                                                    /></GridItem>
                                                </div>

                                                <div className="contents">
                                                    <GridItem span={{ md: 4, lg: 6 }}><TextField
                                                        name="alt_phone"
                                                        label="Alt. Phone"
                                                        hint={phoneCountLabel(formData.alt_phone) || undefined}
                                                        ref={(el: HTMLInputElement | null) => { fieldRefs.current.alt_phone = el; }}
                                                        type="tel"
                                                        value={formData.alt_phone}
                                                        onChange={(e) => handleChange('alt_phone', e.target.value)}
                                                        onBlur={(e) => validateField('alt_phone', e.target.value)}
                                                        placeholder="+91 98765 43211"
                                                        error={errors.alt_phone || undefined}
                                                    /></GridItem>
                                                </div>
                                </>
                            ),
                        },
                        {
                            id: 'address',
                            title: 'Address',
                            content: (
                                <>
                                    <GridItem span="full"><div>
                                        <TextField
                                            name="address"
                                            label="Address"
                                            ref={(el: HTMLInputElement | null) => { fieldRefs.current.address = el; }}
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) => handleChange('address', e.target.value)}
                                            onBlur={(e) => validateField('address', e.target.value)}
                                            placeholder="Street / area"
                                            error={errors.address || undefined}
                                        />
                                    </div></GridItem>

                                    <GridItem span={{ md: 4, lg: 6 }}><Select
                                        name="country"
                                        label="Country"
                                        value={formData.country}
                                        // Changing country changes what a valid postal code is,
                                        // so a standing error has to be re-judged against the
                                        // new rule rather than left over from the old one.
                                        onChange={(e) => {
                                            const country = e.target.value;
                                            setFormData(prev => ({ ...prev, country }));
                                            setErrors(prev => ({ ...prev, pin_code: validatePostalCode(formData.pin_code, country) }));
                                        }}
                                        options={countryOptions().map(c => ({ value: c.code, label: c.name }))}
                                    /></GridItem>

                                    <div className="contents">
                                        <GridItem span={{ md: 4, lg: 6 }}><TextField
                                            name="city"
                                            label="City"
                                            ref={(el: HTMLInputElement | null) => { fieldRefs.current.city = el; }}
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => handleChange('city', e.target.value)}
                                            onBlur={(e) => validateField('city', e.target.value)}
                                            placeholder="Bangalore"
                                            error={errors.city || undefined}
                                        /></GridItem>
                                        <GridItem span={{ md: 4, lg: 6 }}><TextField
                                            name="pin_code"
                                            label={postalRule.label}
                                            hint={[
                                                postalRule.digits ? `${formData.pin_code.replace(/\D/g, '').length}/${postalRule.digits} digits` : '',
                                                !postalRule.pattern ? `not used in ${postalRule.name}` : '',
                                            ].filter(Boolean).join(' · ') || undefined}
                                            ref={(el: HTMLInputElement | null) => { fieldRefs.current.pin_code = el; }}
                                            type="text"
                                            inputMode={postalRule.numericOnly ? 'numeric' : 'text'}
                                            maxLength={postalRule.maxLength}
                                            value={formData.pin_code}
                                            // Where the country's format is digits-only, a letter is
                                            // never intended — drop it at the keystroke rather than
                                            // reporting it back. Alphanumeric formats (UK, Canada)
                                            // must be left alone.
                                            onChange={(e) => handleChange(
                                                'pin_code',
                                                postalRule.numericOnly
                                                    ? e.target.value.replace(/\D/g, '').slice(0, postalRule.maxLength)
                                                    : e.target.value,
                                            )}
                                            onBlur={(e) => validateField('pin_code', e.target.value)}
                                            placeholder={postalRule.example}
                                            error={errors.pin_code || undefined}
                                        /></GridItem>
                                    </div>
                                </>
                            ),
                        },
                        {
                            id: 'assignment',
                            title: 'Assignment',
                            content: (
                                <>
                                    <div className="contents">
                                        <GridItem span={{ md: 4, lg: 6 }}><Select
                                            name="source"
                                            label="Lead Source"
                                            value={formData.source}
                                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                            options={[{ value: '', label: '— Select source —' }, ...sourceTypes.map(opt => ({ value: opt.value, label: opt.label }))]}
                                        /></GridItem>
                                        <GridItem span={{ md: 4, lg: 6 }}><Select
                                            name="status"
                                            label="Lead Stage"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            options={leadStages.map(stage => ({ value: stage.name, label: stage.name }))}
                                        /></GridItem>
                                    </div>

                                    <GridItem span={{ md: 4, lg: 6 }}><div className="space-y-1.5">
                                        <label className="text-sm font-medium text-fg-subtle">Referred By</label>
                                        <PartnerSearchDropdown
                                            partners={partners}
                                            value={formData.referred_by}
                                            onChange={(id) => setFormData({ ...formData, referred_by: id })}
                                            placeholder="Search and select partner..."
                                        />
                                    </div></GridItem>

                                    <GridItem span={{ md: 4, lg: 6 }}><Select
                                        name="owner_id"
                                        label="Owner"
                                        value={formData.owner_id}
                                        onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                                        options={users.length === 0
                                            ? [{ value: '', label: 'Loading...' }]
                                            : users.map(u => ({ value: u.id, label: u.full_name }))}
                                    /></GridItem>
                                </>
                            ),
                        },
                        ...(customFieldDefs.length > 0
                            ? [{
                                id: 'custom',
                                title: 'Additional Details',
                                content: (
                                    <>
                                        <div className="contents">
                                            {customFieldDefs.map(field => {
                                                const cell = ((): React.ReactNode => {
                                                const setCustom = (v: unknown) => setFormData({
                                                    ...formData,
                                                    custom_fields: { ...formData.custom_fields, [field.id]: v },
                                                });
                                                const fname = `custom_${field.id}`;
                                                if (field.type === 'boolean') {
                                                    return (
                                                        <div key={field.id} className="flex items-center">
                                                            <Checkbox
                                                                name={fname}
                                                                label={field.label}
                                                                checked={formData.custom_fields[field.id] || false}
                                                                onChange={(e) => setCustom(e.target.checked)}
                                                            />
                                                        </div>
                                                    );
                                                }
                                                if (field.type === 'SELECT' || field.field_type === 'SELECT') {
                                                    return (
                                                        <Select
                                                            key={field.id}
                                                            name={fname}
                                                            label={field.label}
                                                            required={field.required}
                                                            value={formData.custom_fields[field.id] || ''}
                                                            onChange={(e) => setCustom(e.target.value)}
                                                            options={[{ value: '', label: '— Select —' }, ...(field.options || []).map((opt: string) => ({ value: opt, label: opt }))]}
                                                        />
                                                    );
                                                }
                                                if (field.type === 'number' || field.field_type === 'NUMBER') {
                                                    const raw = formData.custom_fields[field.id];
                                                    return (
                                                        <NumberInput
                                                            key={field.id}
                                                            name={fname}
                                                            label={field.label}
                                                            required={field.required}
                                                            value={raw === undefined || raw === '' || raw === null ? null : Number(raw)}
                                                            onChange={(v) => setCustom(v === null ? '' : String(v))}
                                                        />
                                                    );
                                                }
                                                if (field.type === 'date' || field.field_type === 'DATE') {
                                                    return (
                                                        <DatePicker
                                                            key={field.id}
                                                            name={fname}
                                                            label={field.label}
                                                            required={field.required}
                                                            value={formData.custom_fields[field.id] || ''}
                                                            onChange={(v) => setCustom(v)}
                                                        />
                                                    );
                                                }
                                                return (
                                                    <TextField
                                                        key={field.id}
                                                        name={fname}
                                                        label={field.label}
                                                        required={field.required}
                                                        type="text"
                                                        value={formData.custom_fields[field.id] || ''}
                                                        onChange={(e) => setCustom(e.target.value)}
                                                    />
                                                );
                                                })();
                                                return <GridItem key={field.id} span={{ md: 4, lg: 6 }}>{cell}</GridItem>;
                                            })}
                                        </div>
                                    </>
                                ),
                            }]
                            : []),
                ] as Array<{ id: string; title: string; content: React.ReactNode }>).map((sec) => (
                    <section key={sec.id} aria-labelledby={`form-section-${sec.id}`} data-slot="section" data-section-id={sec.id} className="flex flex-col gap-nb-3">
                        <h2 id={`form-section-${sec.id}`} className="text-sm font-semibold text-fg">{sec.title}</h2>
                        <Grid gap="md">{sec.content}</Grid>
                    </section>
                ))}
            </form>
        </Modal>
        ) : null
    );
};
