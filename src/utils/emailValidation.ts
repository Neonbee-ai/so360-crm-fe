/**
 * Shared email-format rule for every CRM form.
 *
 * `<input type="email">` alone was doing this job, and it accepted values no
 * mail server would: `user@gmail` has no dot in the domain, and the browser's
 * own complaint ("Please enter a part following '@'") arrived as a native popup
 * that looked nothing like the rest of the app's inline errors.
 *
 * Requires a local part, an `@`, and a dotted domain with a ≥2-letter TLD:
 *
 *   fddhfgijb@         → invalid
 *   fddhfgijb          → invalid
 *   @gmail.com         → invalid
 *   fddhfgijb@gmail    → invalid
 *   fddhfgijb@gmail.com → valid
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

/** The one message every surface shows for a malformed address. */
export const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';

export function isValidEmail(value: string): boolean {
    return EMAIL_REGEX.test(value.trim());
}

/** `null` when acceptable — an empty optional field included. */
export function validateEmail(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return isValidEmail(trimmed) ? null : INVALID_EMAIL_MESSAGE;
}

/** As `validateEmail`, but a blank value is itself an error. */
export function validateEmailRequired(value: string, fieldLabel = 'Contact Email'): string | null {
    const trimmed = value.trim();
    if (!trimmed) return `${fieldLabel} is required.`;
    return isValidEmail(trimmed) ? null : INVALID_EMAIL_MESSAGE;
}
