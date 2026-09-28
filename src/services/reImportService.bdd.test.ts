import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({
    corePost: vi.fn(),
    invGet: vi.fn(),
    invPost: vi.fn(),
}));

vi.mock('./crmService', () => ({
    crmCoreClient: { post: (...a: unknown[]) => api.corePost(...a) },
    crmInventoryClient: {
        get: (...a: unknown[]) => api.invGet(...a),
        post: (...a: unknown[]) => api.invPost(...a),
        getOrgId: () => 'org-1',
    },
}));

import {
    CLIENT_FIELDS, PROJECT_FIELDS, UNIT_FIELDS, UNITS_PER_CALL, InventoryCategory, UnitImportRow,
    importClients, importProjects, importUnits, listCategories, prepareClientRows, prepareProjects,
    prepareUnitRows, sheetRow, unitPrice,
} from './reImportService';

beforeEach(() => {
    api.corePost.mockReset();
    api.invGet.mockReset();
    api.invPost.mockReset();
});

describe('Given the importer field lists', () => {
    it('Then clients need a name, projects a project, and units a project and unit number', () => {
        const required = (fields: typeof CLIENT_FIELDS) => fields.filter((f) => f.required).map((f) => f.key);
        expect(required(CLIENT_FIELDS)).toEqual(['name']);
        expect(required(PROJECT_FIELDS)).toEqual(['project']);
        expect(required(UNIT_FIELDS)).toEqual(['project', 'unit_number']);
    });
    it('Then units offer every RFP unit field', () => {
        const keys = UNIT_FIELDS.map((f) => f.key);
        for (const k of ['bedrooms', 'bathrooms', 'built_up_area', 'plot_area', 'original_price', 'discount', 'final_price', 'currency', 'payment_plan', 'commission_percent', 'property_type']) {
            expect(keys).toContain(k);
        }
    });
    it('Then the first data row is sheet row 2', () => {
        expect(sheetRow(0)).toBe(2);
    });
});

// ── Clients ─────────────────────────────────────────────────────────────────

describe('Given existing-client rows', () => {
    it('When rows are checked, Then good rows are kept and each bad row names its problems', () => {
        const out = prepareClientRows([
            { name: 'Ali', email: 'ali@x.com' },
            { name: 'Sara', phone: '+971500000000' },
            { email: 'no-name@x.com' },
            { name: 'Nobody' },
            { name: 'Typo', email: 'not-an-email' },
            {},
        ]);
        expect(out.items).toEqual([
            { row: 2, data: { name: 'Ali', email: 'ali@x.com' } },
            { row: 3, data: { name: 'Sara', phone: '+971500000000' } },
        ]);
        expect(out.problems).toEqual([
            { row: 4, message: 'Name is missing' },
            { row: 5, message: 'Add an email or a phone' },
            { row: 6, message: '"not-an-email" is not an email address' },
            { row: 7, message: 'Name is missing; Add an email or a phone' },
        ]);
    });

    it('When they are imported, Then Core receives only the good rows and its row numbers map back to the sheet', async () => {
        api.corePost.mockResolvedValue({
            created: 1,
            updated: 1,
            invalid: [{ row: 2, errors: ['email is bad', 'x'] }],
            failed: [{ row: 1, error: 'partner create failed' }, { row: 9, error: 'out of range' }],
        });
        const prepared = { items: [{ row: 2, data: { name: 'A' } }, { row: 5, data: { name: 'B' } }], problems: [] };
        const r = await importClients(prepared);
        expect(api.corePost).toHaveBeenCalledWith('/v1/channel/import/customers/commit', { rows: [{ name: 'A' }, { name: 'B' }] });
        expect(r).toEqual({
            created: 1,
            updated: 1,
            skipped: 0,
            problems: [
                { row: 5, message: 'email is bad; x' },
                { row: 2, message: 'partner create failed' },
                { row: 9, message: 'out of range' },
            ],
        });
    });

    it('When Core returns an empty body, Then nothing is counted', async () => {
        api.corePost.mockResolvedValue(null);
        await expect(importClients({ items: [], problems: [] })).resolves.toEqual({ created: 0, updated: 0, skipped: 0, problems: [] });
    });

    it('When Core refuses the call, Then the error reaches the caller', async () => {
        api.corePost.mockRejectedValue(new Error('rows must contain at most 5000 elements'));
        await expect(importClients({ items: [], problems: [] })).rejects.toThrow('at most 5000');
    });
});

// ── Projects ────────────────────────────────────────────────────────────────

describe('Given project rows', () => {
    it('When rows share a project name in any case, Then they group into one project with distinct towers', () => {
        const { projects, problems } = prepareProjects([
            { project: 'Palm Vista', tower: 'A' },
            { project: 'palm vista', tower: 'B', city: 'Dubai', project_status: 'Under Construction', commission_percent: '2.5%' },
            { project: 'PALM VISTA', tower: 'a', country: 'UAE' },
            { project: 'Marina Heights' },
        ]);
        expect(problems).toEqual([]);
        expect(projects).toEqual([
            {
                name: 'Palm Vista',
                row: 2,
                metadata: { city: 'Dubai', project_status: 'under_construction', commission_percent: 2.5 },
                towers: [{ name: 'A', row: 2 }, { name: 'B', row: 3 }],
            },
            { name: 'Marina Heights', row: 5, metadata: {}, towers: [] },
        ]);
    });

    it('When a row carries every metadata field, Then all are kept in the backend shape', () => {
        const { projects } = prepareProjects([{
            project: 'P', project_code: 'PV-1', city: 'Dubai', country: 'UAE', payment_plan: '60/40',
            description: 'Sea view', handover: 'Q4 2027', project_status: 'on-hold',
            launch_date: '2026-01-15', completion_date: '2028-06-30', commission_percent: '3',
        }]);
        expect(projects[0].metadata).toEqual({
            project_code: 'PV-1', city: 'Dubai', country: 'UAE', payment_plan: '60/40', description: 'Sea view',
            handover: 'Q4 2027', project_status: 'on_hold', launch_date: '2026-01-15', completion_date: '2028-06-30',
            commission_percent: 3,
        });
    });

    it('When a row breaks an Inventory rule, Then the row is held back with every reason', () => {
        const { projects, problems } = prepareProjects([
            { tower: 'A' },
            { project: 'P', project_status: 'selling' },
            { project: 'P', launch_date: '15/01/2026', completion_date: '2026-02-30' },
            { project: 'P', launch_date: '2027-01-01', completion_date: '2026-01-01' },
            { project: 'P', commission_percent: '120' },
            { project: 'P', commission_percent: 'lots' },
            { project: 'P', commission_percent: '-1' },
        ]);
        expect(projects).toEqual([]);
        expect(problems).toEqual([
            { row: 2, message: 'Project is missing' },
            { row: 3, message: expect.stringMatching(/^Status must be one of planned, launched/) },
            { row: 4, message: 'Launch date must be YYYY-MM-DD; Completion date must be YYYY-MM-DD' },
            { row: 5, message: 'Completion date is before the launch date' },
            { row: 6, message: 'Commission % must be between 0 and 100' },
            { row: 7, message: 'Commission % must be between 0 and 100' },
            { row: 8, message: 'Commission % must be between 0 and 100' },
        ]);
    });
});

describe('Given the org categories in Inventory', () => {
    it('When listed, Then id, name and parent are kept (no parent → null)', async () => {
        api.invGet.mockResolvedValue({ categories: [{ id: 'c1', name: 'Palm', color: 'x' }, { id: 'c2', name: 'A', parent_id: 'c1' }] });
        await expect(listCategories()).resolves.toEqual([
            { id: 'c1', name: 'Palm', parent_id: null },
            { id: 'c2', name: 'A', parent_id: 'c1' },
        ]);
        expect(api.invGet).toHaveBeenCalledWith('/v1/inventory/settings/org-1');
    });
    it('When the settings have no categories, Then the list is empty', async () => {
        api.invGet.mockResolvedValue(null);
        await expect(listCategories()).resolves.toEqual([]);
    });
});

describe('Given projects to import', () => {
    it('When some projects and towers exist, Then only the missing ones are created, towers under their project', async () => {
        api.invGet.mockResolvedValue({ categories: [
            { id: 'p-old', name: 'Palm Vista', parent_id: null },
            { id: 't-a', name: 'A', parent_id: 'p-old' },
            { id: 'stray', name: 'Marina', parent_id: 'someone' },
        ] });
        let n = 0;
        api.invPost.mockImplementation(async () => ({ id: `new-${++n}` }));
        const r = await importProjects([
            { name: ' palm vista ', row: 2, metadata: { city: 'Dubai' }, towers: [{ name: 'a', row: 2 }, { name: 'B', row: 3 }] },
            { name: 'Marina', row: 4, metadata: { city: 'Dubai' }, towers: [{ name: 'T1', row: 4 }] },
            { name: 'Bare', row: 5, metadata: {}, towers: [] },
        ]);
        expect(api.invPost.mock.calls).toEqual([
            ['/v1/inventory/settings/org-1/categories', { name: 'B', parent_id: 'p-old' }],
            ['/v1/inventory/settings/org-1/categories', { name: 'Marina', metadata: { city: 'Dubai' } }],
            ['/v1/inventory/settings/org-1/categories', { name: 'T1', parent_id: 'new-2' }],
            ['/v1/inventory/settings/org-1/categories', { name: 'Bare' }],
        ]);
        expect(r).toEqual({ created: 4, updated: 0, skipped: 2, problems: [] });
    });

    it('When a project cannot be created, Then its towers are not tried and the row is reported', async () => {
        api.invGet.mockResolvedValue({ categories: [] });
        api.invPost.mockRejectedValueOnce(new Error('completion_date must not be before launch_date'));
        const r = await importProjects([{ name: 'Bad', row: 7, metadata: {}, towers: [{ name: 'A', row: 7 }] }]);
        expect(api.invPost).toHaveBeenCalledTimes(1);
        expect(r.problems).toEqual([{ row: 7, message: 'Project "Bad": completion_date must not be before launch_date' }]);
        expect(r.created).toBe(0);
    });

    it('When a tower cannot be created, Then the others still are and the tower row is reported', async () => {
        api.invGet.mockResolvedValue({ categories: [] });
        api.invPost
            .mockResolvedValueOnce({ id: 'p1' })
            .mockRejectedValueOnce('boom')
            .mockResolvedValueOnce(null);
        const r = await importProjects([{ name: 'P', row: 2, metadata: {}, towers: [{ name: 'A', row: 2 }, { name: 'B', row: 3 }] }]);
        expect(r.created).toBe(2);
        expect(r.problems).toEqual([{ row: 2, message: 'Tower "A": Request failed' }]);
    });

    it('When the error has no message, Then it reads "Request failed"', async () => {
        api.invGet.mockResolvedValue({ categories: [] });
        api.invPost.mockRejectedValueOnce(new Error(''));
        const r = await importProjects([{ name: 'P', row: 2, metadata: {}, towers: [] }]);
        expect(r.problems).toEqual([{ row: 2, message: 'Project "P": Request failed' }]);
    });
});

// ── Units ───────────────────────────────────────────────────────────────────

const CATS: InventoryCategory[] = [
    { id: 'p1', name: 'Palm Vista', parent_id: null },
    { id: 't1', name: 'Tower A', parent_id: 'p1' },
    { id: 'p2', name: 'Townhouses', parent_id: null },
];

describe('Given unit rows', () => {
    it('When a row is complete, Then numbers, text, currency and type are normalised and the price is the final price', () => {
        const out = prepareUnitRows([{
            project: 'palm vista', tower: 'tower a', unit_number: ' 1203 ', name: 'A-1203 Sea', sku: 'PV-A-1203',
            property_type: 'apartment', floor: '12', stack: '03', bedrooms: '2', bathrooms: '3', built_up_area: '1,250',
            plot_area: '0', area_sqft: '1250', view: 'Sea', facing: 'North', parking: '1', price_per_sqft: '1,600',
            original_price: 'AED 2,000,000', discount: '100,000', final_price: '1,900,000', currency: 'aed',
            payment_plan: '60/40', commission_percent: '2%',
        }], CATS);
        expect(out.problems).toEqual([]);
        expect(out.items).toEqual([{
            row: 2,
            data: {
                category_id: 't1',
                unit_number: '1203',
                name: 'A-1203 Sea',
                sku: 'PV-A-1203',
                price: 1900000,
                attributes: {
                    floor: 12, bedrooms: 2, bathrooms: 3, built_up_area: 1250, plot_area: 0, area_sqft: 1250, parking: 1,
                    price_per_sqft: 1600, original_price: 2000000, discount: 100000, final_price: 1900000, commission_percent: 2,
                    stack: '03', view: 'Sea', facing: 'North', payment_plan: '60/40', currency: 'AED', property_type: 'Apartment',
                },
            },
        }]);
    });

    it('When a row has no tower, no sku and no price, Then it goes under the project with the unit number as sku', () => {
        const out = prepareUnitRows([{ project: 'Townhouses', unit_number: 'TH-7' }], CATS);
        expect(out.items).toEqual([{ row: 2, data: { category_id: 'p2', unit_number: 'TH-7', sku: 'TH-7', attributes: {} } }]);
    });

    it('When a row has a tower but no sku, Then the sku is tower-unit', () => {
        const out = prepareUnitRows([{ project: 'Palm Vista', tower: 'Tower A', unit_number: '101' }], CATS);
        expect(out.items[0].data.sku).toBe('Tower A-101');
    });

    it('When a row breaks a rule, Then it is held back with every reason', () => {
        const long = 'x'.repeat(61);
        const out = prepareUnitRows([
            { project: 'Palm Vista' },
            { unit_number: '1' },
            { project: 'Nowhere', unit_number: '1' },
            { project: 'Palm Vista', tower: 'Tower Z', unit_number: '1' },
            { project: 'Palm Vista', unit_number: long, name: 'n'.repeat(256), sku: 's'.repeat(101) },
            { project: 'Palm Vista', unit_number: '1', bedrooms: 'two', discount: '-5', commission_percent: '150' },
            { project: 'Palm Vista', unit_number: '1', currency: 'Dirham', property_type: 'Castle' },
        ], CATS);
        expect(out.items).toEqual([]);
        expect(out.problems).toEqual([
            { row: 2, message: 'Unit number is missing' },
            { row: 3, message: 'Project is missing' },
            { row: 4, message: 'Project "Nowhere" does not exist yet' },
            { row: 5, message: 'Tower "Tower Z" does not exist in Palm Vista' },
            { row: 6, message: 'Unit number is longer than 60 characters; Name is longer than 255 characters; SKU is longer than 100 characters' },
            { row: 7, message: 'Bedrooms must be a number; Discount must be a number; Commission % must be between 0 and 100' },
            { row: 8, message: expect.stringMatching(/^Currency must be a 3-letter code such as AED; Property type must be one of Apartment, Villa/) },
        ]);
    });
});

describe('Given unit prices', () => {
    it('Then the final price wins', () => expect(unitPrice({ final_price: 5, original_price: 9, discount: 1 })).toBe(5));
    it('Then original less discount is next, never below zero', () => {
        expect(unitPrice({ original_price: 9, discount: 1 })).toBe(8);
        expect(unitPrice({ original_price: 1, discount: 9 })).toBe(0);
    });
    it('Then the original price alone is used', () => expect(unitPrice({ original_price: 9 })).toBe(9));
    it('Then no price is null', () => expect(unitPrice({ discount: 3 })).toBeNull());
});

const unit = (row: number): { row: number; data: UnitImportRow } =>
    ({ row, data: { category_id: 't1', unit_number: String(row), attributes: {} } });

describe('Given checked units to import', () => {
    it('When sent, Then Inventory gets the rows and skipped/error rows map back to the sheet', async () => {
        api.invPost.mockResolvedValue({
            created: 1,
            skipped: 1,
            skipped_rows: [{ row: 2, unit_number: '5', reason: 'already in this tower' }],
            errors: [{ row: 3, unit_number: '9', error: 'stock failed' }, { row: 99, unit_number: '?', error: 'x' }],
        });
        const r = await importUnits({ items: [unit(3), unit(5), unit(9)], problems: [] });
        expect(api.invPost).toHaveBeenCalledWith('/v1/inventory/property/org-1/units/import', { rows: [unit(3).data, unit(5).data, unit(9).data] });
        expect(r).toEqual({
            created: 1,
            updated: 0,
            skipped: 1,
            problems: [
                { row: 5, message: 'Unit 5 skipped: already in this tower' },
                { row: 9, message: 'Unit 9: stock failed' },
                { row: 99, message: 'Unit ?: x' },
            ],
        });
    });

    it('When there are more rows than one call takes, Then they are sent in chunks and totals add up', async () => {
        api.invPost.mockImplementation(async (_url: string, body: { rows: unknown[] }) => ({ created: body.rows.length }));
        const items = Array.from({ length: UNITS_PER_CALL + 1 }, (_, i) => unit(i + 2));
        const r = await importUnits({ items, problems: [] });
        expect(api.invPost).toHaveBeenCalledTimes(2);
        expect(api.invPost.mock.calls[1][1].rows).toHaveLength(1);
        expect(r.created).toBe(UNITS_PER_CALL + 1);
    });

    it('When Inventory stops part-way (quota), Then later chunks are not sent and the reason is reported', async () => {
        api.invPost.mockResolvedValue({ created: 3, aborted: 'Stopped at row 4 (unit 4): quota reached' });
        const items = Array.from({ length: UNITS_PER_CALL + 1 }, (_, i) => unit(i + 2));
        const r = await importUnits({ items, problems: [] });
        expect(api.invPost).toHaveBeenCalledTimes(1);
        expect(r.problems).toEqual([{ row: 0, message: 'Import stopped: Stopped at row 4 (unit 4): quota reached' }]);
    });

    it('When Inventory returns an empty body, Then nothing is counted', async () => {
        api.invPost.mockResolvedValue(undefined);
        await expect(importUnits({ items: [unit(2)], problems: [] })).resolves.toEqual({ created: 0, updated: 0, skipped: 0, problems: [] });
    });
});
