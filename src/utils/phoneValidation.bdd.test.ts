import { describe, it, expect } from 'vitest';
import { validatePhone } from './phoneValidation';

describe('validatePhone', () => {

    // ─── Empty / absent values ────────────────────────────────────────────
    describe('Given an empty or absent value', () => {
        it('When value is an empty string / Then returns null (field is optional)', () => {
            expect(validatePhone('')).toBeNull();
        });
    });

    // ─── Valid phone formats ──────────────────────────────────────────────
    describe('Given a valid phone number', () => {
        it('When value is a 10-digit local number / Then returns null', () => {
            expect(validatePhone('9876543210')).toBeNull();
        });

        it('When value has a leading + country code / Then returns null', () => {
            expect(validatePhone('+91 9876543210')).toBeNull();
        });

        it('When value uses parentheses and dashes (US format) / Then returns null', () => {
            expect(validatePhone('+1 (555) 123-4567')).toBeNull();
        });

        it('When value is at the minimum length of 7 digits / Then returns null', () => {
            expect(validatePhone('1234567')).toBeNull();
        });

        it('When value is at the maximum allowed length / Then returns null', () => {
            // 20 digit-chars after optional '+': "+1234567890123456789" = '+' + 19 chars → total 20 with the +
            expect(validatePhone('+1234567890123456789')).toBeNull();
        });

        it('When value contains spaces between digit groups / Then returns null', () => {
            expect(validatePhone('+44 20 7946 0958')).toBeNull();
        });

        it('When value contains dots as separators / Then returns null', () => {
            expect(validatePhone('98765.43210')).toBeNull();
        });
    });

    // ─── Invalid: contains letters ────────────────────────────────────────
    describe('Given a phone value with non-numeric characters', () => {
        it('When value mixes digits and letters / Then returns an error message', () => {
            expect(validatePhone('78201245555555id')).not.toBeNull();
        });

        it('When value is purely alphabetic / Then returns an error message', () => {
            expect(validatePhone('abcdefgh')).not.toBeNull();
        });

        it('When value contains an @ symbol / Then returns an error message', () => {
            expect(validatePhone('+91@9876543')).not.toBeNull();
        });
    });

    // ─── Invalid: too short ───────────────────────────────────────────────
    describe('Given a phone value that is too short', () => {
        it('When value has fewer than 7 valid characters / Then returns an error message', () => {
            expect(validatePhone('12345')).not.toBeNull();
        });

        it('When value is a single digit / Then returns an error message', () => {
            expect(validatePhone('9')).not.toBeNull();
        });
    });

    // ─── Invalid: too long ────────────────────────────────────────────────
    describe('Given a phone value that is too long', () => {
        it('When value exceeds 20 allowed characters / Then returns an error message', () => {
            // 21 digit characters after '+' → too long
            expect(validatePhone('+123456789012345678901')).not.toBeNull();
        });

        it('When value is excessively long with mixed digits and letters / Then returns an error message', () => {
            expect(validatePhone('78201245555555555555id')).not.toBeNull();
        });
    });

    // ─── Error message content ────────────────────────────────────────────
    describe('Given an invalid phone value', () => {
        it('When an error is returned / Then the message guides the user on format', () => {
            const msg = validatePhone('bad!!phone');
            expect(msg).toContain('7');
            expect(msg).toContain('20');
        });
    });
});
