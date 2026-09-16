import { describe, it, expect } from 'vitest';
import {
    EMPTY_VALUE,
    isUuid,
    humanizeFieldLabel,
    formatFieldValue,
    visibleMetaEntries,
    resolveMetaLabel,
    UNNAMED_CUSTOM_FIELD,
    SYSTEM_META_KEYS,
} from './fieldPresentation';

/**
 * Regression cover for "Lead Quick Overview shows UUIDs and raw timestamps".
 *
 * The drawer used to iterate the raw `meta_data` JSONB bucket and render every
 * value with `String(val)`, so internal bookkeeping keys written by the merge
 * flow surfaced to users as "Merged Into  c4deff86-ba44-…" and
 * "Merged At  2026-07-31T14:05:12.625Z".
 */

const fakeFormatDate = (value: any, options: any = {}) =>
    options.hour ? `FMT_DATETIME(${value})` : `FMT_DATE(${value})`;

describe('Given isUuid', () => {
    it('When the value is a UUID / Then it is recognised', () => {
        expect(isUuid('c4deff86-ba44-43b0-9013-4d7965298514')).toBe(true);
    });

    it('When the value is ordinary text / Then it is not treated as an identifier', () => {
        expect(isUuid('Apple Inc')).toBe(false);
        expect(isUuid(42)).toBe(false);
    });
});

describe('Given humanizeFieldLabel', () => {
    it('When the key is snake_case / Then it becomes Title Case', () => {
        expect(humanizeFieldLabel('merged_into')).toBe('Merged Into');
        expect(humanizeFieldLabel('preferred_contact_method')).toBe('Preferred Contact Method');
    });
});

describe('Given formatFieldValue', () => {
    it('When the value is an unresolved UUID / Then the identifier is withheld, not displayed', () => {
        expect(formatFieldValue('c4deff86-ba44-43b0-9013-4d7965298514')).toBe(EMPTY_VALUE);
    });

    it('When the value is a UUID with a resolved lookup / Then the business name is shown', () => {
        const out = formatFieldValue('c4deff86-ba44-43b0-9013-4d7965298514', {
            lookups: { 'c4deff86-ba44-43b0-9013-4d7965298514': 'Apple Inc' },
        });
        expect(out).toBe('Apple Inc');
    });

    it('When the value is a raw ISO timestamp / Then it is formatted with date AND time', () => {
        expect(formatFieldValue('2026-07-31T14:05:12.625Z', { formatDate: fakeFormatDate }))
            .toBe('FMT_DATETIME(2026-07-31T14:05:12.625Z)');
    });

    it('When the value is a date-only string / Then it is formatted without a clock reading', () => {
        expect(formatFieldValue('2026-07-31', { formatDate: fakeFormatDate }))
            .toBe('FMT_DATE(2026-07-31)');
    });

    it('When the value is boolean / Then it renders as Yes or No', () => {
        expect(formatFieldValue(true)).toBe('Yes');
        expect(formatFieldValue(false)).toBe('No');
    });

    it('When the value is empty in any of its forms / Then the placeholder is used', () => {
        expect(formatFieldValue(null)).toBe(EMPTY_VALUE);
        expect(formatFieldValue(undefined)).toBe(EMPTY_VALUE);
        expect(formatFieldValue('')).toBe(EMPTY_VALUE);
        expect(formatFieldValue('   ')).toBe(EMPTY_VALUE);
        expect(formatFieldValue([])).toBe(EMPTY_VALUE);
    });

    it('When the value is a nested object / Then it never renders as "[object Object]"', () => {
        expect(formatFieldValue({ a: 1 })).toBe(EMPTY_VALUE);
    });

    it('When the value is an array / Then entries are joined readably', () => {
        expect(formatFieldValue(['enterprise', 'priority'])).toBe('enterprise, priority');
    });
});

describe('Given visibleMetaEntries', () => {
    const meta = {
        merged_into: 'c4deff86-ba44-43b0-9013-4d7965298514',
        merged_at: '2026-07-31T14:05:12.625Z',
        merged_by: 'a1b2c3d4-0000-4000-8000-000000000000',
        city: 'Kochi',
        industry: 'Retail',
        preferred_contact_method: 'Email',
        annual_revenue: 250000,
        blank_note: '',
    };

    it('When building the Additional Fields list / Then no system merge key leaks through', () => {
        const keys = visibleMetaEntries(meta, { formatDate: fakeFormatDate }).map((e) => e.key);
        expect(keys).not.toContain('merged_into');
        expect(keys).not.toContain('merged_at');
        expect(keys).not.toContain('merged_by');
    });

    it('When a key already has its own labelled row / Then it is not repeated here', () => {
        const keys = visibleMetaEntries(meta).map((e) => e.key);
        expect(keys).not.toContain('city');
        expect(keys).not.toContain('industry');
    });

    it('When a genuine user field is present / Then it appears with a humanized label', () => {
        const entries = visibleMetaEntries(meta);
        expect(entries).toContainEqual({
            key: 'preferred_contact_method',
            label: 'Preferred Contact Method',
            value: 'Email',
        });
    });

    it('When a value is blank / Then the row is dropped rather than shown as a bare dash', () => {
        const keys = visibleMetaEntries(meta).map((e) => e.key);
        expect(keys).not.toContain('blank_note');
    });

    it('When no rendered value survives / Then no UUID is present anywhere in the output', () => {
        const values = visibleMetaEntries(meta, { formatDate: fakeFormatDate }).map((e) => e.value);
        expect(values.some((v) => isUuid(v))).toBe(false);
    });

    it('When meta_data is missing / Then it returns an empty list instead of throwing', () => {
        expect(visibleMetaEntries(null)).toEqual([]);
        expect(visibleMetaEntries(undefined)).toEqual([]);
    });

    it('Given the system key registry / Then the merge pair is covered', () => {
        expect(SYSTEM_META_KEYS.has('merged_into')).toBe(true);
        expect(SYSTEM_META_KEYS.has('merged_at')).toBe(true);
    });
});

/**
 * The reported defect: the Lead quick-view listed an Additional Field labelled
 * "0A0AEFF5 5AD0 431B 8EB8 5717E5117826". Custom-field values are stored keyed
 * by the *definition id*, so humanizing the key turned a database identifier
 * into what looked like a business field name.
 */
describe('Given custom field values are listed under Additional Fields', () => {
    const DEF_ID = '0a0aeff5-5ad0-431b-8eb8-5717e5117826';
    const OTHER_ID = 'b1111111-2222-3333-4444-555555555555';

    it('Given a definition for the key / When listed / Then the configured label is shown', () => {
        const entries = visibleMetaEntries(
            { [DEF_ID]: 'Faiz' },
            { customFieldDefs: [{ id: DEF_ID, label: 'Reference Person' }] },
        );
        expect(entries).toEqual([{ key: DEF_ID, label: 'Reference Person', value: 'Faiz' }]);
    });

    it('Given a definition that names the field via `name` / When listed / Then that is used', () => {
        const entries = visibleMetaEntries(
            { [DEF_ID]: 'Faiz' },
            { customFieldDefs: [{ id: DEF_ID, name: 'Reference Person' }] },
        );
        expect(entries[0].label).toBe('Reference Person');
    });

    it('Given no definition for a UUID key / When listed / Then a readable fallback is shown, never the id', () => {
        const entries = visibleMetaEntries({ [OTHER_ID]: 'Faiz' }, { customFieldDefs: [] });
        expect(entries[0].label).toBe(UNNAMED_CUSTOM_FIELD);
        expect(entries[0].label).not.toContain('0A0AEFF5');
        expect(entries[0].label).not.toMatch(/[0-9a-f]{8}/i);
    });

    it('Given a definition with a blank label / When listed / Then the fallback is used rather than an empty name', () => {
        const entries = visibleMetaEntries(
            { [DEF_ID]: 'Faiz' },
            { customFieldDefs: [{ id: DEF_ID, label: '   ' }] },
        );
        expect(entries[0].label).toBe(UNNAMED_CUSTOM_FIELD);
    });

    it('Given an ordinary named key / When listed / Then it is humanized as before', () => {
        const entries = visibleMetaEntries({ reference_person: 'Faiz' }, { customFieldDefs: [] });
        expect(entries[0].label).toBe('Reference Person');
    });

    it('Given definitions are not loaded yet / When listed / Then no identifier leaks in the meantime', () => {
        const entries = visibleMetaEntries({ [DEF_ID]: 'Faiz' });
        expect(entries[0].label).toBe(UNNAMED_CUSTOM_FIELD);
    });

    it('Given the value / When listed / Then it is untouched by the label fix', () => {
        const entries = visibleMetaEntries(
            { [DEF_ID]: 'Faiz' },
            { customFieldDefs: [{ id: DEF_ID, label: 'Reference Person' }] },
        );
        expect(entries[0].value).toBe('Faiz');
    });
});

describe('Given resolveMetaLabel', () => {
    it('Given a plain key / When resolved / Then it is title-cased', () => {
        expect(resolveMetaLabel('preferred_contact_time')).toBe('Preferred Contact Time');
    });

    it('Given a UUID key with no definitions / When resolved / Then the fallback is returned', () => {
        expect(resolveMetaLabel('0a0aeff5-5ad0-431b-8eb8-5717e5117826')).toBe(UNNAMED_CUSTOM_FIELD);
    });
});
