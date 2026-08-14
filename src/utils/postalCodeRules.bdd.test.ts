import { describe, it, expect } from 'vitest';
import {
    validatePostalCode,
    getPostalCodeRule,
    postalCodeMessage,
    countryOptions,
    POSTAL_CODE_RULES,
    FALLBACK_RULE,
    DEFAULT_COUNTRY,
} from './postalCodeRules';

describe('validatePostalCode', () => {
    // ─── Per-country formats ──────────────────────────────────────────────
    describe('Given a country with a fixed digit format', () => {
        it.each([
            ['IN', '560001'],
            ['SG', '018956'],
            ['DE', '10115'],
            ['AU', '2000'],
            ['ZA', '0002'],
            ['OM', '112'],
        ])('When a %s code "%s" is entered / Then it is accepted', (country, value) => {
            expect(validatePostalCode(value, country)).toBeNull();
        });

        it.each([
            ['IN', '56000', 'Please enter a valid 6-digit PIN Code.'],
            ['IN', '5600011', 'Please enter a valid 6-digit PIN Code.'],
            ['SG', '01895', 'Please enter a valid 6-digit Postal Code.'],
            ['DE', '1011', 'Please enter a valid 5-digit Postcode.'],
            ['AU', '20000', 'Please enter a valid 4-digit Postcode.'],
        ])('When a %s code "%s" has the wrong length / Then "%s" is returned', (country, value, message) => {
            expect(validatePostalCode(value, country)).toBe(message);
        });
    });

    describe('Given a country whose format is not plain digits', () => {
        it.each([
            ['US', '94105'],
            ['US', '94105-1804'],
            ['GB', 'SW1A 1AA'],
            ['GB', 'EC1A1BB'],
            ['CA', 'K1A 0B1'],
            ['CA', 'K1A0B1'],
            ['NL', '1012 AB'],
            ['JP', '100-0001'],
            ['BR', '01310-100'],
            ['IE', 'D02 AF30'],
            ['PL', '00-001'],
            ['SE', '111 20'],
        ])('When a %s code "%s" is entered / Then it is accepted', (country, value) => {
            expect(validatePostalCode(value, country)).toBeNull();
        });

        it('When a US ZIP is 6 digits / Then it is rejected', () => {
            expect(validatePostalCode('941050', 'US')).toBe('Please enter a valid ZIP Code.');
        });

        it('When a UK postcode is pure digits / Then it is rejected', () => {
            expect(validatePostalCode('560001', 'GB')).toBe('Please enter a valid Postcode.');
        });

        it('When a Canadian code omits a letter / Then it is rejected', () => {
            expect(validatePostalCode('11A 0B1', 'CA')).toBe('Please enter a valid Postal Code.');
        });
    });

    // ─── The cross-country regression this whole change exists for ────────
    describe('Given the same value judged against different countries', () => {
        it('When an Indian PIN is entered on a US lead / Then it is rejected', () => {
            expect(validatePostalCode('560001', 'IN')).toBeNull();
            expect(validatePostalCode('560001', 'US')).not.toBeNull();
        });

        it('When a UK postcode is entered on an Indian lead / Then it is rejected', () => {
            expect(validatePostalCode('SW1A 1AA', 'GB')).toBeNull();
            expect(validatePostalCode('SW1A 1AA', 'IN')).not.toBeNull();
        });
    });

    // ─── Countries with no postal system ──────────────────────────────────
    describe('Given a country with no postal-code system', () => {
        it.each(['AE', 'QA', 'HK'])(
            'When the country is %s / Then any value is accepted, including none',
            (country) => {
                expect(validatePostalCode('', country)).toBeNull();
                expect(validatePostalCode('PO Box 1234', country)).toBeNull();
            },
        );

        it('When the country is AE / Then the rule carries no pattern', () => {
            expect(getPostalCodeRule('AE').pattern).toBeNull();
        });
    });

    // ─── Unknown / absent country ─────────────────────────────────────────
    describe('Given a country outside the curated table', () => {
        it('When the code is unrecognised / Then the permissive fallback applies', () => {
            expect(validatePostalCode('560001', 'ZZ')).toBeNull();
            expect(validatePostalCode('SW1A 1AA', 'ZZ')).toBeNull();
        });

        it('When no country is supplied / Then the permissive fallback applies', () => {
            expect(validatePostalCode('12345')).toBeNull();
        });

        it('When the value is the garbage QA filed / Then the fallback still rejects it', () => {
            // An unrecognised country is not licence to accept anything at all.
            expect(validatePostalCode('98789kgjftd?^&(', 'ZZ')).toBe(
                'Please enter a valid Postal Code.',
            );
        });

        it.each(['&&&&&&', '@@@###', 'ABCDEF'])(
            'When the fallback sees "%s" with no digit / Then it is rejected',
            (value) => {
                expect(validatePostalCode(value, 'ZZ')).not.toBeNull();
            },
        );
    });

    // ─── Shared behaviour ─────────────────────────────────────────────────
    describe('Given an empty value', () => {
        it.each(['IN', 'US', 'GB', undefined])(
            'When the country is %s / Then blank is accepted (postal code is optional)',
            (country) => {
                expect(validatePostalCode('', country)).toBeNull();
                expect(validatePostalCode('   ', country)).toBeNull();
            },
        );
    });

    describe('Given surrounding whitespace', () => {
        it('When a valid code is padded / Then it is accepted', () => {
            expect(validatePostalCode('  560001  ', 'IN')).toBeNull();
        });
    });

    describe('Given a lowercase country code', () => {
        it('When "in" is supplied / Then it resolves to the same rule as "IN"', () => {
            expect(getPostalCodeRule('in').code).toBe('IN');
            expect(validatePostalCode('56000', 'in')).not.toBeNull();
        });
    });
});

describe('getPostalCodeRule / postalCodeMessage', () => {
    it('Given a fixed-digit country / When the message is built / Then it names the digit count', () => {
        expect(postalCodeMessage(getPostalCodeRule('IN'))).toBe(
            'Please enter a valid 6-digit PIN Code.',
        );
    });

    it('Given a variable-length country / When the message is built / Then it omits a digit count', () => {
        expect(postalCodeMessage(getPostalCodeRule('GB'))).toBe('Please enter a valid Postcode.');
    });

    it('Given an unknown country / When the rule is resolved / Then the fallback is returned', () => {
        expect(getPostalCodeRule('ZZ')).toBe(FALLBACK_RULE);
        expect(getPostalCodeRule(null)).toBe(FALLBACK_RULE);
    });
});

describe('countryOptions', () => {
    it('Given the selector is built / When rendered / Then the default country leads the list', () => {
        expect(countryOptions()[0]!.code).toBe(DEFAULT_COUNTRY);
    });

    it('Given the selector is built / When rendered / Then the remainder is alphabetical', () => {
        const rest = countryOptions().slice(1).map((c) => c.name);
        expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
    });

    it('Given the selector is built / When rendered / Then every rule is offered exactly once', () => {
        const codes = countryOptions().map((c) => c.code);
        expect(codes).toHaveLength(POSTAL_CODE_RULES.length);
        expect(new Set(codes).size).toBe(codes.length);
    });
});

describe('the rules table itself', () => {
    it('Given every rule / When inspected / Then codes are unique ISO alpha-2', () => {
        const codes = POSTAL_CODE_RULES.map((r) => r.code);
        expect(new Set(codes).size).toBe(codes.length);
        codes.forEach((c) => expect(c).toMatch(/^[A-Z]{2}$/));
    });

    it('Given every rule / When inspected / Then its own example passes its own pattern', () => {
        // Guards against a typo in the table shipping a placeholder the field
        // would immediately reject.
        POSTAL_CODE_RULES.filter((r) => r.pattern).forEach((r) => {
            expect(validatePostalCode(r.example, r.code)).toBeNull();
        });
    });

    it('Given every fixed-digit rule / When inspected / Then maxLength admits the full code', () => {
        POSTAL_CODE_RULES.filter((r) => r.digits).forEach((r) => {
            expect(r.maxLength).toBeGreaterThanOrEqual(r.digits!);
        });
    });

    it('Given every rule / When inspected / Then maxLength admits its own example', () => {
        POSTAL_CODE_RULES.forEach((r) => {
            if (r.pattern) expect(r.example.length).toBeLessThanOrEqual(r.maxLength);
        });
    });
});
