/**
 * Shared text-field rules for CRM lead/contact forms.
 *
 * QA filed a run of values the forms accepted without a murmur — company
 * `8798798798798&^%$$*jyfutd`, first name `%^&)_5454hiugi`, city `&)&)_*`,
 * pin `98789kgjftd?^&(`. None of them are storable data, and all of them reach
 * search, invoices and mail merges downstream.
 *
 * Every rule here is deliberately shaped as "allow the real-world formats,
 * reject the noise" rather than a strict whitelist, so legitimate values keep
 * working: `AT&T`, `Johnson & Johnson`, `ABC Pvt. Ltd.`, `7-Eleven`, `H&M`,
 * `O'Connor`, `Jean-Luc`, `Mary Jane`, `Aix-en-Provence`.
 *
 * The backend mirrors these rules (so360-crm-be `dto/lead-field-rules.ts`) so a
 * direct API call cannot store what the form refuses.
 */

import { validatePostalCode } from './postalCodeRules';

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const COMPANY_MIN = 2;
export const COMPANY_MAX = 120;
export const ADDRESS_MIN = 5;
export const ADDRESS_MAX = 200;
export const CITY_MIN = 2;
export const CITY_MAX = 80;

/**
 * Personal names: letters plus the joiners real names use. No digits.
 * `\p{M}` is required alongside `\p{L}` or Indic and Arabic scripts break —
 * Malayalam "സുനിൽ" is letters carrying combining marks, not letters alone.
 */
const NAME_ALLOWED = /^[\p{L}][\p{L}\p{M}\s'’.-]*$/u;
/** Companies may carry digits and business punctuation. */
const COMPANY_ALLOWED = /^[\p{L}\p{M}\p{N}\s&'’.,()+/-]+$/u;
/** Addresses additionally need `#` and `/` for unit and plot numbers. */
const ADDRESS_ALLOWED = /^[\p{L}\p{M}\p{N}\s#&'’.,()/-]+$/u;
/** Cities read like names but may be multi-word and hyphenated. */
const CITY_ALLOWED = /^[\p{L}][\p{L}\p{M}\s'’.-]*$/u;

const HAS_LETTER = /\p{L}/u;
/** Three or more of the same punctuation mark in a row is keyboard mashing. */
const REPEATED_PUNCTUATION = /([&.,'’()+/#-])\1{2,}/u;

export const INVALID_FIRST_NAME_MESSAGE = 'Please enter a valid first name.';
export const INVALID_LAST_NAME_MESSAGE = 'Please enter a valid last name.';
export const INVALID_COMPANY_MESSAGE = 'Please enter a valid company name.';
export const INVALID_ADDRESS_MESSAGE = 'Please enter a valid address.';
export const INVALID_CITY_MESSAGE = 'Please enter a valid city.';

function check(
    value: string,
    pattern: RegExp,
    min: number,
    max: number,
    message: string,
): string | null {
    const trimmed = value.trim();
    if (trimmed.length < min || trimmed.length > max) return message;
    if (!pattern.test(trimmed)) return message;
    // A value has to say something: at least one letter, and not a run of the
    // same symbol standing in for one ("&&&&&&", "@@@###").
    if (!HAS_LETTER.test(trimmed)) return message;
    if (REPEATED_PUNCTUATION.test(trimmed)) return message;
    return null;
}

/** `null` when acceptable. Empty is allowed — first name is required elsewhere. */
export function validateFirstName(value: string): string | null {
    if (!value.trim()) return null;
    return check(value, NAME_ALLOWED, NAME_MIN, NAME_MAX, INVALID_FIRST_NAME_MESSAGE);
}

export function validateFirstNameRequired(value: string): string | null {
    if (!value.trim()) return 'First Name is required.';
    return validateFirstName(value);
}

export function validateLastName(value: string): string | null {
    if (!value.trim()) return null;
    return check(value, NAME_ALLOWED, NAME_MIN, NAME_MAX, INVALID_LAST_NAME_MESSAGE);
}

export function validateCompanyName(value: string): string | null {
    if (!value.trim()) return null;
    return check(value, COMPANY_ALLOWED, COMPANY_MIN, COMPANY_MAX, INVALID_COMPANY_MESSAGE);
}

export function validateAddress(value: string): string | null {
    if (!value.trim()) return null;
    return check(value, ADDRESS_ALLOWED, ADDRESS_MIN, ADDRESS_MAX, INVALID_ADDRESS_MESSAGE);
}

export function validateCity(value: string): string | null {
    if (!value.trim()) return null;
    return check(value, CITY_ALLOWED, CITY_MIN, CITY_MAX, INVALID_CITY_MESSAGE);
}

/**
 * Postal code, judged against the record's own country rather than a fixed
 * 6-digit Indian PIN. See `postalCodeRules.ts` for the table and the fallback
 * applied when the country is unknown.
 */
export function validatePinCode(value: string, country?: string | null): string | null {
    return validatePostalCode(value, country);
}
