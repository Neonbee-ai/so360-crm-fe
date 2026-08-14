/**
 * Shared phone-format rule for every CRM form.
 *
 * The previous rule was a single character-class regex counting *characters*,
 * not digits, over a 7–20 window. That let both of the values QA filed through:
 *
 *   +9154579            → 7 chars, so it passed; only 5 subscriber digits
 *   +9151313165449849   → 17 chars, so it passed; 16 digits, longer than E.164
 *
 * Counting digits (and applying the +91 subscriber-length rule when the value
 * declares that country code) rejects both while still accepting the spacing,
 * dashes and parentheses people paste from address books.
 */

/** Characters a phone number may be written with. Anything else is a hard no. */
const ALLOWED_CHARS = /^[+\d\s().-]+$/;

/** E.164 caps a full number at 15 digits; 7 is the shortest national number. */
export const MIN_PHONE_DIGITS = 7;
export const MAX_PHONE_DIGITS = 15;

/** The one message every surface shows for a malformed number. */
export const INVALID_PHONE_MESSAGE = 'Please enter a valid phone number.';
export const PHONE_TOO_LONG_MESSAGE = `Phone number cannot exceed ${MAX_PHONE_DIGITS} digits.`;

/** Digits only — the unit every length rule below is expressed in. */
export function phoneDigitCount(value: string): number {
    return (value.match(/\d/g) || []).length;
}

function checkFormat(trimmed: string): string | null {
    if (!ALLOWED_CHARS.test(trimmed)) return INVALID_PHONE_MESSAGE;
    // A '+' is a country-code marker, so it is only meaningful in front.
    if (trimmed.slice(1).includes('+')) return INVALID_PHONE_MESSAGE;

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length > MAX_PHONE_DIGITS) return PHONE_TOO_LONG_MESSAGE;

    // When the writer commits to +91, hold them to a real Indian mobile:
    // 10 subscriber digits opening with 6–9. Without this, "+9154579" reads
    // as a legal 7-digit international number and slips through.
    if (trimmed.startsWith('+91')) {
        const subscriber = digits.slice(2);
        if (subscriber.length !== 10 || !/^[6-9]/.test(subscriber)) {
            return INVALID_PHONE_MESSAGE;
        }
        return null;
    }

    if (digits.length < MIN_PHONE_DIGITS) return INVALID_PHONE_MESSAGE;
    return null;
}

export function isValidPhone(value: string): boolean {
    return checkFormat(value.trim()) === null;
}

/** `null` when acceptable — an empty optional field included. */
export function validatePhone(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return checkFormat(trimmed);
}

/** As `validatePhone`, but a blank value is itself an error. */
export function validatePhoneRequired(
    value: string,
    fieldLabel = 'Primary Mobile Number',
): string | null {
    const trimmed = value.trim();
    if (!trimmed) return `${fieldLabel} is required.`;
    return checkFormat(trimmed);
}
