/**
 * Country-aware postal-code rules.
 *
 * The first pass at this hard-coded India's 6-digit PIN, which was right for
 * the tenants the forms were built around and wrong for everyone else — a UAE
 * lead has no postal code at all, a US ZIP is 5 (or 5+4), and a UK postcode is
 * alphanumeric. The rule now comes from the record's own country, so a lead
 * outside the org's home country still validates correctly.
 *
 * `so360-crm-be/src/modules/leads/dto/postal-code-rules.ts` mirrors this table
 * so the API cannot store what the form refuses. Keep the two in step.
 */

export interface PostalCodeRule {
    /** ISO 3166-1 alpha-2. */
    code: string;
    /** Display name in the country selector. */
    name: string;
    /** What this country calls it — drives the field label and the message. */
    label: string;
    /**
     * `null` for countries with no postal-code system at all. A value there is
     * not an error (some addresses carry a PO box), it is simply unconstrained.
     */
    pattern: RegExp | null;
    /**
     * Fixed digit count where the country has one. Drives the `n/N` counter,
     * `maxLength`, and the "N-digit" wording in the message. Absent for
     * alphanumeric or variable-length formats.
     */
    digits?: number;
    /** Hard input cap, generous enough for separators. */
    maxLength: number;
    /** Shown as the field placeholder. */
    example: string;
    /** Whether non-digits should be stripped as the user types. */
    numericOnly: boolean;
}

const rule = (
    code: string,
    name: string,
    label: string,
    pattern: RegExp | null,
    example: string,
    opts: { digits?: number; maxLength?: number; numericOnly?: boolean } = {},
): PostalCodeRule => ({
    code,
    name,
    label,
    pattern,
    example,
    digits: opts.digits,
    maxLength: opts.maxLength ?? (opts.digits ? opts.digits : 12),
    numericOnly: opts.numericOnly ?? opts.digits !== undefined,
});

const digitsRule = (code: string, name: string, label: string, n: number, example: string) =>
    rule(code, name, label, new RegExp(`^\\d{${n}}$`), example, { digits: n });

/**
 * Curated rather than exhaustive: the markets the platform actually sells into,
 * plus a permissive fallback for everywhere else. Adding a country is a one-line
 * change here and in the backend mirror.
 */
export const POSTAL_CODE_RULES: PostalCodeRule[] = [
    digitsRule('IN', 'India', 'PIN Code', 6, '560001'),

    // Gulf — several have no postal system at all.
    rule('AE', 'United Arab Emirates', 'Postal Code', null, 'Not used'),
    rule('QA', 'Qatar', 'Postal Code', null, 'Not used'),
    rule('HK', 'Hong Kong', 'Postal Code', null, 'Not used'),
    digitsRule('SA', 'Saudi Arabia', 'Postal Code', 5, '11564'),
    digitsRule('KW', 'Kuwait', 'Postal Code', 5, '13001'),
    digitsRule('OM', 'Oman', 'Postal Code', 3, '112'),
    rule('BH', 'Bahrain', 'Postal Code', /^\d{3,4}$/, '1216', { maxLength: 4, numericOnly: true }),

    // Americas
    rule('US', 'United States', 'ZIP Code', /^\d{5}(-\d{4})?$/, '94105', { maxLength: 10 }),
    rule('CA', 'Canada', 'Postal Code', /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, 'K1A 0B1', { maxLength: 7 }),
    rule('BR', 'Brazil', 'CEP', /^\d{5}-?\d{3}$/, '01310-100', { maxLength: 9 }),
    digitsRule('MX', 'Mexico', 'Postal Code', 5, '06600'),

    // Europe
    rule('GB', 'United Kingdom', 'Postcode', /^[A-Za-z]{1,2}\d[A-Za-z\d]?[ ]?\d[A-Za-z]{2}$/, 'SW1A 1AA', { maxLength: 8 }),
    rule('IE', 'Ireland', 'Eircode', /^[A-Za-z]\d{2}[ ]?[A-Za-z\d]{4}$/, 'D02 AF30', { maxLength: 8 }),
    digitsRule('DE', 'Germany', 'Postcode', 5, '10115'),
    digitsRule('FR', 'France', 'Postcode', 5, '75001'),
    digitsRule('ES', 'Spain', 'Postcode', 5, '28001'),
    digitsRule('IT', 'Italy', 'Postcode', 5, '00184'),
    rule('NL', 'Netherlands', 'Postcode', /^\d{4}[ ]?[A-Za-z]{2}$/, '1012 AB', { maxLength: 7 }),
    digitsRule('CH', 'Switzerland', 'Postcode', 4, '8001'),
    rule('PL', 'Poland', 'Postcode', /^\d{2}-?\d{3}$/, '00-001', { maxLength: 6 }),
    rule('SE', 'Sweden', 'Postcode', /^\d{3}[ ]?\d{2}$/, '111 20', { maxLength: 6 }),
    digitsRule('RU', 'Russia', 'Postal Code', 6, '101000'),
    digitsRule('TR', 'Türkiye', 'Postal Code', 5, '34000'),

    // Asia-Pacific
    digitsRule('SG', 'Singapore', 'Postal Code', 6, '018956'),
    digitsRule('MY', 'Malaysia', 'Postcode', 5, '50000'),
    rule('AU', 'Australia', 'Postcode', /^\d{4}$/, '2000', { digits: 4 }),
    rule('NZ', 'New Zealand', 'Postcode', /^\d{4}$/, '6011', { digits: 4 }),
    rule('JP', 'Japan', 'Postal Code', /^\d{3}-?\d{4}$/, '100-0001', { maxLength: 8 }),
    digitsRule('CN', 'China', 'Postal Code', 6, '100000'),
    digitsRule('KR', 'South Korea', 'Postal Code', 5, '04524'),
    digitsRule('TH', 'Thailand', 'Postal Code', 5, '10200'),
    digitsRule('VN', 'Vietnam', 'Postal Code', 6, '100000'),
    digitsRule('ID', 'Indonesia', 'Postal Code', 5, '10110'),
    digitsRule('PH', 'Philippines', 'ZIP Code', 4, '1000'),
    digitsRule('LK', 'Sri Lanka', 'Postal Code', 5, '00100'),
    digitsRule('BD', 'Bangladesh', 'Postal Code', 4, '1000'),
    digitsRule('NP', 'Nepal', 'Postal Code', 5, '44600'),
    digitsRule('PK', 'Pakistan', 'Postal Code', 5, '44000'),

    // Africa
    digitsRule('ZA', 'South Africa', 'Postal Code', 4, '0002'),
    digitsRule('KE', 'Kenya', 'Postal Code', 5, '00100'),
    digitsRule('NG', 'Nigeria', 'Postal Code', 6, '100001'),
    digitsRule('EG', 'Egypt', 'Postal Code', 5, '11511'),
];

/** The country the CRM forms have always implicitly assumed. */
export const DEFAULT_COUNTRY = 'IN';

const RULES_BY_CODE = new Map(POSTAL_CODE_RULES.map((r) => [r.code, r]));

/**
 * Anything outside the curated table. Deliberately loose — an unrecognised
 * country is not licence to reject a real address, only to reject the noise QA
 * filed (`98789kgjftd?^&(`). Requires a digit so a symbol run cannot pass.
 */
export const FALLBACK_RULE: PostalCodeRule = {
    code: '',
    name: 'Other',
    label: 'Postal Code',
    pattern: /^(?=.*\d)[A-Za-z\d][A-Za-z\d -]{1,11}$/,
    maxLength: 12,
    example: '560001',
    numericOnly: false,
};

export function getPostalCodeRule(country?: string | null): PostalCodeRule {
    if (!country) return FALLBACK_RULE;
    return RULES_BY_CODE.get(country.trim().toUpperCase()) ?? FALLBACK_RULE;
}

/** "Please enter a valid 6-digit PIN Code." / "…a valid Postcode." */
export function postalCodeMessage(rule: PostalCodeRule): string {
    return rule.digits
        ? `Please enter a valid ${rule.digits}-digit ${rule.label}.`
        : `Please enter a valid ${rule.label}.`;
}

/**
 * `null` when acceptable — an empty field included, and any value at all for a
 * country with no postal system.
 */
export function validatePostalCode(value: string, country?: string | null): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const rule = getPostalCodeRule(country);
    if (!rule.pattern) return null;
    return rule.pattern.test(trimmed) ? null : postalCodeMessage(rule);
}

/** Country names for a selector, alphabetical, with the default pinned first. */
export function countryOptions(): Array<{ code: string; name: string }> {
    const rest = POSTAL_CODE_RULES.filter((r) => r.code !== DEFAULT_COUNTRY)
        .map((r) => ({ code: r.code, name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const dflt = RULES_BY_CODE.get(DEFAULT_COUNTRY)!;
    return [{ code: dflt.code, name: dflt.name }, ...rest];
}
