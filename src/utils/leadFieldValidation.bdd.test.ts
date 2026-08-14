import { describe, it, expect } from 'vitest';
import {
    validateFirstName,
    validateFirstNameRequired,
    validateLastName,
    validateCompanyName,
    validateAddress,
    validateCity,
    validatePinCode,
    INVALID_FIRST_NAME_MESSAGE,
    INVALID_LAST_NAME_MESSAGE,
    INVALID_COMPANY_MESSAGE,
    INVALID_ADDRESS_MESSAGE,
    INVALID_CITY_MESSAGE,
} from './leadFieldValidation';

// ─── Company name ─────────────────────────────────────────────────────────
describe('validateCompanyName', () => {
    describe('Given a legitimate company name', () => {
        it.each([
            'AT&T',
            'Johnson & Johnson',
            'ABC Pvt. Ltd.',
            '7-Eleven',
            'H&M',
            "O'Reilly Media",
            'Acme Corp',
            'Tata Consultancy Services (TCS)',
            'Maersk A/S',
        ])('When the value is "%s" / Then it is accepted', (value) => {
            expect(validateCompanyName(value)).toBeNull();
        });
    });

    describe('Given the values QA filed', () => {
        it('When the value is 8798798798798&^%$$*jyfutd / Then it is rejected', () => {
            expect(validateCompanyName('8798798798798&^%$$*jyfutd')).toBe(INVALID_COMPANY_MESSAGE);
        });

        it.each(['&&&&&&', '$$$$$', '@@@###'])(
            'When the value is repeated punctuation "%s" / Then it is rejected',
            (value) => {
                expect(validateCompanyName(value)).toBe(INVALID_COMPANY_MESSAGE);
            },
        );
    });

    describe('Given a value with no letters at all', () => {
        it('When the value is digits only / Then it is rejected', () => {
            expect(validateCompanyName('8798798798798')).toBe(INVALID_COMPANY_MESSAGE);
        });
    });

    describe('Given length boundaries', () => {
        it('When the value is a single character / Then it is rejected', () => {
            expect(validateCompanyName('A')).toBe(INVALID_COMPANY_MESSAGE);
        });

        it('When the value exceeds 120 characters / Then it is rejected', () => {
            expect(validateCompanyName('A'.repeat(121))).toBe(INVALID_COMPANY_MESSAGE);
        });

        it('When the value is exactly 120 characters / Then it is accepted', () => {
            expect(validateCompanyName('A'.repeat(120))).toBeNull();
        });
    });

    describe('Given the field is left empty', () => {
        it('When the value is blank / Then it is accepted (company is optional)', () => {
            expect(validateCompanyName('')).toBeNull();
            expect(validateCompanyName('   ')).toBeNull();
        });
    });
});

// ─── First / last name ────────────────────────────────────────────────────
describe('validateFirstName / validateLastName', () => {
    describe('Given a legitimate personal name', () => {
        it.each(['John', 'Mary Jane', "O'Connor", 'Jean-Luc', 'Renée', 'St. John', 'സുനിൽ'])(
            'When the value is "%s" / Then it is accepted as a first name',
            (value) => {
                expect(validateFirstName(value)).toBeNull();
            },
        );

        it.each(['Doe', "O'Connor", 'van der Berg', 'Smith-Jones'])(
            'When the value is "%s" / Then it is accepted as a last name',
            (value) => {
                expect(validateLastName(value)).toBeNull();
            },
        );
    });

    describe('Given the values QA filed', () => {
        it('When first name is %^&)_5454hiugi / Then it is rejected', () => {
            expect(validateFirstName('%^&)_5454hiugi')).toBe(INVALID_FIRST_NAME_MESSAGE);
        });

        it('When last name is 49878)&)*_knhj / Then it is rejected', () => {
            expect(validateLastName('49878)&)*_knhj')).toBe(INVALID_LAST_NAME_MESSAGE);
        });
    });

    describe('Given a name containing digits', () => {
        it('When the value mixes letters and digits / Then it is rejected', () => {
            expect(validateFirstName('John3')).toBe(INVALID_FIRST_NAME_MESSAGE);
        });
    });

    describe('Given length boundaries', () => {
        it('When the value is a single letter / Then it is rejected', () => {
            expect(validateFirstName('J')).toBe(INVALID_FIRST_NAME_MESSAGE);
        });

        it('When the value exceeds 60 characters / Then it is rejected', () => {
            expect(validateFirstName('A'.repeat(61))).toBe(INVALID_FIRST_NAME_MESSAGE);
        });
    });
});

describe('validateFirstNameRequired', () => {
    it('Given a blank value / When validated / Then it reports the field is required', () => {
        expect(validateFirstNameRequired('')).toBe('First Name is required.');
        expect(validateFirstNameRequired('  ')).toBe('First Name is required.');
    });

    it('Given an invalid value / When validated / Then it reports the format message', () => {
        expect(validateFirstNameRequired('%^&)_5454hiugi')).toBe(INVALID_FIRST_NAME_MESSAGE);
    });

    it('Given a valid value / When validated / Then it is accepted', () => {
        expect(validateFirstNameRequired('John')).toBeNull();
    });
});

// ─── Address ──────────────────────────────────────────────────────────────
describe('validateAddress', () => {
    describe('Given a real-world address', () => {
        it.each([
            '12 Main Street',
            '#4/2, 3rd Cross, Indiranagar',
            'Flat 3-B, Silver Oaks Apts.',
            'P.O. Box 1234',
            'Plot No. 7/A (Near Metro)',
        ])('When the value is "%s" / Then it is accepted', (value) => {
            expect(validateAddress(value)).toBeNull();
        });
    });

    describe('Given the value QA filed', () => {
        it('When the value is (^()_)+ / Then it is rejected', () => {
            expect(validateAddress('(^()_)+')).toBe(INVALID_ADDRESS_MESSAGE);
        });
    });

    describe('Given length boundaries', () => {
        it('When the value is shorter than 5 characters / Then it is rejected', () => {
            expect(validateAddress('12 A')).toBe(INVALID_ADDRESS_MESSAGE);
        });

        it('When the value exceeds 200 characters / Then it is rejected', () => {
            expect(validateAddress('A'.repeat(201))).toBe(INVALID_ADDRESS_MESSAGE);
        });
    });

    it('Given a blank value / When validated / Then it is accepted (address is optional)', () => {
        expect(validateAddress('')).toBeNull();
    });
});

// ─── City ─────────────────────────────────────────────────────────────────
describe('validateCity', () => {
    describe('Given a real city name', () => {
        it.each(['Bangalore', 'New Delhi', 'Aix-en-Provence', "Coeur d'Alene", 'St. Louis'])(
            'When the value is "%s" / Then it is accepted',
            (value) => {
                expect(validateCity(value)).toBeNull();
            },
        );
    });

    describe('Given the value QA filed', () => {
        it('When the value is &)&)_* / Then it is rejected', () => {
            expect(validateCity('&)&)_*')).toBe(INVALID_CITY_MESSAGE);
        });
    });

    describe('Given a numeric or symbol-only value', () => {
        it('When the value is digits only / Then it is rejected', () => {
            expect(validateCity('560001')).toBe(INVALID_CITY_MESSAGE);
        });

        it('When the value mixes a city with digits / Then it is rejected', () => {
            expect(validateCity('Bangalore 560001')).toBe(INVALID_CITY_MESSAGE);
        });
    });

    it('Given a blank value / When validated / Then it is accepted (city is optional)', () => {
        expect(validateCity('')).toBeNull();
    });
});

// ─── Postal code (country-aware) ──────────────────────────────────────────
//
// `validatePinCode` now delegates to the country table in postalCodeRules.ts;
// these cover the delegation itself. The per-country formats are exercised in
// postalCodeRules.bdd.test.ts.
describe('validatePinCode', () => {
    const IN_MESSAGE = 'Please enter a valid 6-digit PIN Code.';

    describe('Given an Indian lead', () => {
        it('When the PIN is 6 digits / Then it is accepted', () => {
            expect(validatePinCode('560001', 'IN')).toBeNull();
        });

        it('When the value is the one QA filed / Then it is rejected', () => {
            expect(validatePinCode('98789kgjftd?^&(', 'IN')).toBe(IN_MESSAGE);
        });

        it.each(['56000', '5600011', '56000A', '560-01', '56 001'])(
            'When the value is "%s" / Then it is rejected',
            (value) => {
                expect(validatePinCode(value, 'IN')).toBe(IN_MESSAGE);
            },
        );

        it('When a valid PIN is padded with spaces / Then it is accepted', () => {
            expect(validatePinCode('  560001  ', 'IN')).toBeNull();
        });
    });

    describe('Given a lead in another country', () => {
        it('When a US lead carries a 5-digit ZIP / Then it is accepted', () => {
            expect(validatePinCode('94105', 'US')).toBeNull();
        });

        it('When a US lead carries an Indian 6-digit PIN / Then it is rejected', () => {
            expect(validatePinCode('560001', 'US')).toBe('Please enter a valid ZIP Code.');
        });

        it('When a UK lead carries an alphanumeric postcode / Then it is accepted', () => {
            expect(validatePinCode('SW1A 1AA', 'GB')).toBeNull();
        });
    });

    describe('Given no country is known', () => {
        it('When the value is blank / Then it is accepted (postal code is optional)', () => {
            expect(validatePinCode('')).toBeNull();
        });

        it('When the value is a plausible code / Then the permissive fallback accepts it', () => {
            expect(validatePinCode('560001')).toBeNull();
            expect(validatePinCode('SW1A 1AA')).toBeNull();
        });

        it('When the value is the garbage QA filed / Then it is still rejected', () => {
            expect(validatePinCode('98789kgjftd?^&(')).toBe('Please enter a valid Postal Code.');
        });
    });
});
