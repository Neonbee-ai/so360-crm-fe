import { describe, it, expect } from 'vitest';
import {
    validatePhone,
    validatePhoneRequired,
    isValidPhone,
    phoneDigitCount,
    INVALID_PHONE_MESSAGE,
    PHONE_TOO_LONG_MESSAGE,
} from './phoneValidation';

describe('validatePhone', () => {

    // ─── Empty / absent values ────────────────────────────────────────────
    describe('Given an empty or absent value', () => {
        it('When value is an empty string / Then returns null (field is optional)', () => {
            expect(validatePhone('')).toBeNull();
        });

        it('When value is whitespace only / Then returns null (treated as empty)', () => {
            expect(validatePhone('   ')).toBeNull();
        });
    });

    // ─── Valid phone formats ──────────────────────────────────────────────
    describe('Given a valid phone number', () => {
        it('When value is a 10-digit local number / Then returns null', () => {
            expect(validatePhone('9876543210')).toBeNull();
        });

        it('When value is a full Indian mobile with +91 / Then returns null', () => {
            expect(validatePhone('+91 9876543210')).toBeNull();
        });

        it('When value uses parentheses and dashes (US format) / Then returns null', () => {
            expect(validatePhone('+1 (555) 123-4567')).toBeNull();
        });

        it('When value is at the 7-digit minimum / Then returns null', () => {
            expect(validatePhone('1234567')).toBeNull();
        });

        it('When value is at the 15-digit E.164 maximum / Then returns null', () => {
            expect(validatePhone('+123456789012345')).toBeNull();
        });

        it('When value contains spaces between digit groups / Then returns null', () => {
            expect(validatePhone('+44 20 7946 0958')).toBeNull();
        });

        it('When value contains dots as separators / Then returns null', () => {
            expect(validatePhone('98765.43210')).toBeNull();
        });

        it('When a valid number is padded with spaces / Then returns null', () => {
            expect(validatePhone('  +91 9876543210  ')).toBeNull();
        });
    });

    // ─── Invalid: contains letters or symbols ─────────────────────────────
    describe('Given a phone value with unsupported characters', () => {
        it('When value mixes digits and letters / Then returns the standard message', () => {
            expect(validatePhone('78201245555555id')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When value is the Alt. Phone QA filed (/*8097*^*%(^lm) / Then it is rejected', () => {
            expect(validatePhone('/*8097*^*%(^lm')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When value is purely alphabetic / Then returns the standard message', () => {
            expect(validatePhone('abcdefgh')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When value contains an @ symbol / Then returns the standard message', () => {
            expect(validatePhone('+91@9876543')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When a + appears anywhere but the front / Then returns the standard message', () => {
            expect(validatePhone('987+6543210')).toBe(INVALID_PHONE_MESSAGE);
        });
    });

    // ─── Invalid: digit count ─────────────────────────────────────────────
    describe('Given a phone value with the wrong number of digits', () => {
        it('When fewer than 7 digits / Then returns the standard message', () => {
            expect(validatePhone('12345')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When a single digit / Then returns the standard message', () => {
            expect(validatePhone('9')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When more than 15 digits / Then reports the length ceiling', () => {
            expect(validatePhone('+1234567890123456')).toBe(PHONE_TOO_LONG_MESSAGE);
        });

        it('When the value QA filed (+9151313165449849, 16 digits) / Then it is rejected', () => {
            // The old character-window rule counted 17 characters and let this through.
            expect(validatePhone('+9151313165449849')).toBe(PHONE_TOO_LONG_MESSAGE);
        });

        it('When separators pad a too-long number / Then digits still decide', () => {
            expect(validatePhone('+1 (234) 567-890 123 456')).toBe(PHONE_TOO_LONG_MESSAGE);
        });
    });

    // ─── The +91 subscriber rule ──────────────────────────────────────────
    describe('Given a value that declares the +91 country code', () => {
        it('When the value QA filed (+9154579) / Then it is rejected as too short for +91', () => {
            // 7 digits total passes a bare E.164 check, which is why this slipped
            // through; declaring +91 means 10 subscriber digits are required.
            expect(validatePhone('+9154579')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When +91 is followed by 9 subscriber digits / Then it is rejected', () => {
            expect(validatePhone('+91 987654321')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When +91 is followed by 11 subscriber digits / Then it is rejected', () => {
            expect(validatePhone('+91 98765432101')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When the subscriber number starts below 6 / Then it is rejected', () => {
            expect(validatePhone('+91 5876543210')).toBe(INVALID_PHONE_MESSAGE);
        });

        it.each(['6', '7', '8', '9'])(
            'When the subscriber number starts with %s / Then it is accepted',
            (lead) => {
                expect(validatePhone(`+91 ${lead}876543210`)).toBeNull();
            },
        );

        it('When +91 is written with separators / Then the digits still resolve', () => {
            expect(validatePhone('+91-98765-43210')).toBeNull();
        });
    });

    // ─── Other country codes keep the general rule ────────────────────────
    describe('Given a non-Indian country code', () => {
        it('When +1 is followed by 7 digits / Then it is accepted', () => {
            expect(validatePhone('+1 5551234')).toBeNull();
        });
    });
});

// ─── validatePhoneRequired ────────────────────────────────────────────────
describe('validatePhoneRequired', () => {

    describe('Given an empty or absent value', () => {
        it('When value is an empty string / Then returns the required message', () => {
            expect(validatePhoneRequired('')).toBe('Primary Mobile Number is required.');
        });

        it('When value is whitespace only / Then returns the required message', () => {
            expect(validatePhoneRequired('   ')).toBe('Primary Mobile Number is required.');
        });

        it('When a field label is supplied / Then the message names that field', () => {
            expect(validatePhoneRequired('', 'Phone')).toBe('Phone is required.');
        });
    });

    describe('Given a valid phone number', () => {
        it('When value is a 10-digit local number / Then returns null', () => {
            expect(validatePhoneRequired('9876543210')).toBeNull();
        });

        it('When value is a full +91 mobile / Then returns null', () => {
            expect(validatePhoneRequired('+91 9876543210')).toBeNull();
        });
    });

    describe('Given an invalid phone number', () => {
        it('When value contains letters / Then returns the format message', () => {
            expect(validatePhoneRequired('abc12345')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When value is too short / Then returns the format message', () => {
            expect(validatePhoneRequired('123')).toBe(INVALID_PHONE_MESSAGE);
        });

        it('When value is too long / Then returns the length message', () => {
            expect(validatePhoneRequired('+1234567890123456')).toBe(PHONE_TOO_LONG_MESSAGE);
        });
    });
});

// ─── Helpers ──────────────────────────────────────────────────────────────
describe('isValidPhone / phoneDigitCount', () => {
    it('Given a valid number / When checked / Then isValidPhone is true', () => {
        expect(isValidPhone('+91 9876543210')).toBe(true);
    });

    it('Given an invalid number / When checked / Then isValidPhone is false', () => {
        expect(isValidPhone('+9154579')).toBe(false);
    });

    it('Given a formatted number / When counted / Then only digits are counted', () => {
        expect(phoneDigitCount('+1 (555) 123-4567')).toBe(11);
    });
});
