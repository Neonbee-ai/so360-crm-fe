const PHONE_REGEX = /^\+?[\d\s\-(). ]{7,20}$/;

export function validatePhone(value: string): string | null {
    if (!value) return null;
    if (!PHONE_REGEX.test(value)) return 'Enter a valid phone number (7–20 digits, + - ( ) allowed)';
    return null;
}
