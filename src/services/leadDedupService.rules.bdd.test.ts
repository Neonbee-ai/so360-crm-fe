import { describe, it, expect } from 'vitest';
import { parseRuleDuplicate } from './leadDedupService';

const err = (body: any, status = 409) => ({ status, body });

describe('Given a duplicate-rule rejection', () => {
    describe('When parsed', () => {
        it('Then a warn phone hit is overridable and names the field', () => {
            const r = parseRuleDuplicate(err({ code: 'DUPLICATE_PHONE', action: 'warn', can_override: true, existing_id: 'l1', existing: { id: 'l1', name: 'Acme', owner_name: 'Priya' } }));
            expect(r).toMatchObject({ id: 'l1', name: 'Acme', owner_name: 'Priya', action: 'warn', canOverride: true, matchedOn: 'phone number' });
        });
        it('Then a block company hit is not overridable, with fallbacks for missing detail', () => {
            const r = parseRuleDuplicate(err({ code: 'DUPLICATE_COMPANY', action: 'block', existing_id: 'l2' }));
            expect(r).toMatchObject({ id: 'l2', name: 'Existing lead', owner_name: null, action: 'block', canOverride: false, matchedOn: 'company name' });
        });
        it('Then the id and name can come from the existing object', () => {
            const r = parseRuleDuplicate(err({ code: 'DUPLICATE_COMPANY', existing: { id: 'l3', company_name: 'Beta' } }));
            expect(r).toMatchObject({ id: 'l3', name: 'Beta', action: 'warn' });
        });
    });
    describe('When the error is something else', () => {
        it('Then it returns null', () => {
            expect(parseRuleDuplicate(null)).toBeNull();
            expect(parseRuleDuplicate(err({ code: 'DUPLICATE_EMAIL', existing_id: 'x' }))).toBeNull();
            expect(parseRuleDuplicate(err({ code: 'DUPLICATE_PHONE', existing_id: 'x' }, 400))).toBeNull();
            expect(parseRuleDuplicate(err({ code: 'DUPLICATE_PHONE' }))).toBeNull();
            expect(parseRuleDuplicate({ body: { code: 'DUPLICATE_PHONE', existing_id: 'x' } })).not.toBeNull();
        });
    });
});
