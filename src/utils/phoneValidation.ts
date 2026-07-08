const PHONE_REGEX = /^\+?[\d\s\-(). ]{7,20}$/;

export function validatePhone(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!PHONE_REGEX.test(trimmed)) return 'Enter a valid phone number (7–20 digits, + - ( ) allowed)';
    return null;
}

export function validatePhoneRequired(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Primary Mobile Number is required.';
    if (!PHONE_REGEX.test(trimmed)) return 'Enter a valid phone number (7–20 digits, + - ( ) allowed)';
    return null;
}
