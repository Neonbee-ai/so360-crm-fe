import { describe, it, expect } from 'vitest';
import {
    INVALID_EMAIL_MESSAGE,
    isValidEmail,
    validateEmail,
    validateEmailRequired,
} from './emailValidation';

/**
 * The reported defect: `fddhfgijb@` was accepted by the form and only stopped
 * by the browser's own popup, with wording ("Please enter a part following
 * '@'") that matched nothing else in the app.
 */
describe('Given an email address is checked', () => {
    describe('Given a well-formed address', () => {
        it.each([
            'fddhfgijb@gmail.com',
            'user@company.com',
            'first.last@sub.domain.co.uk',
            'user+tag@example.io',
        ])('Given %s / When checked / Then it is accepted', (value) => {
            expect(isValidEmail(value)).toBe(true);
            expect(validateEmail(value)).toBeNull();
            expect(validateEmailRequired(value)).toBeNull();
        });

        it('Given surrounding whitespace / When checked / Then it is still accepted', () => {
            expect(validateEmail('  user@company.com  ')).toBeNull();
        });
    });

    describe('Given a malformed address', () => {
        it.each([
            ['fddhfgijb@', 'no domain at all'],
            ['fddhfgijb', 'no @ at all'],
            ['@gmail.com', 'no local part'],
            ['fddhfgijb@gmail', 'domain with no dot or TLD'],
            ['user@domain.c', 'one-letter TLD'],
            ['user name@domain.com', 'whitespace in the local part'],
            ['user@@domain.com', 'two @ signs'],
        ])('Given %s (%s) / When checked / Then it is rejected with the app message', (value) => {
            expect(isValidEmail(value)).toBe(false);
            expect(validateEmail(value)).toBe(INVALID_EMAIL_MESSAGE);
        });
    });

    describe('Given a blank value', () => {
        it('When the field is optional / Then it is accepted', () => {
            expect(validateEmail('')).toBeNull();
            expect(validateEmail('   ')).toBeNull();
        });

        it('When the field is mandatory / Then a required message names the field', () => {
            expect(validateEmailRequired('')).toBe('Contact Email is required.');
            expect(validateEmailRequired('   ', 'Billing Email')).toBe('Billing Email is required.');
        });
    });
});
