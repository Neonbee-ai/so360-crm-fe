import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ uploadMultipart: vi.fn() }));
vi.mock('./crmService', () => ({ crmApiClient: api }));

import {
    leadImportService,
    checkImportFile,
    checkMapping,
    compactMapping,
    describeImportError,
    MAX_IMPORT_BYTES,
    DUPLICATE_POLICIES,
    ACCEPTED_IMPORT_TYPES,
} from './leadImportService';

const fileOf = (name: string, size: number) => {
    const f = new File(['x'], name);
    Object.defineProperty(f, 'size', { value: size });
    return f;
};

beforeEach(() => vi.clearAllMocks());

describe('Given the lead import service', () => {
    describe('When a file is previewed', () => {
        it('Then it is posted alone to /leads/import/preview', async () => {
            const file = fileOf('leads.csv', 10);
            api.uploadMultipart.mockResolvedValueOnce({ headers: ['Name'] });
            expect(await leadImportService.preview(file)).toEqual({ headers: ['Name'] });
            expect(api.uploadMultipart).toHaveBeenCalledWith('/leads/import/preview', file);
        });
    });

    describe('When a file is imported', () => {
        it('Then the file is re-sent with the compacted mapping as JSON and the duplicate policy', async () => {
            const file = fileOf('leads.csv', 10);
            api.uploadMultipart.mockResolvedValueOnce({ created: 2 });
            await leadImportService.import(file, { Name: 'contact_name', Notes: null, Email: 'email' }, 'update');
            expect(api.uploadMultipart).toHaveBeenCalledWith('/leads/import', file, {
                mapping: JSON.stringify({ Name: 'contact_name', Email: 'email' }),
                duplicate_policy: 'update',
            });
        });
    });
});

describe('Given checkImportFile', () => {
    describe('When the file is missing, the wrong type, empty or too big', () => {
        it('Then a reason is returned for each, and null for a good file', () => {
            expect(checkImportFile(null)).toMatch(/choose/i);
            expect(checkImportFile(fileOf('leads.pdf', 10))).toMatch(/only \.csv and \.xlsx/i);
            expect(checkImportFile(fileOf('leads.csv', 0))).toMatch(/empty/i);
            expect(checkImportFile(fileOf('leads.xlsx', MAX_IMPORT_BYTES + 1))).toMatch(/10 MB/);
            expect(checkImportFile(fileOf('LEADS.XLSX', 100))).toBeNull();
        });
    });
});

describe('Given checkMapping', () => {
    describe('When a field is used twice', () => {
        it('Then it is rejected', () => {
            expect(checkMapping({ A: 'email', B: 'email', C: 'first_name' })).toMatch(/only one column/i);
        });
    });

    describe('When no name column is mapped', () => {
        it('Then it asks for First name or Full name', () => {
            expect(checkMapping({ A: 'email', B: null })).toMatch(/first name or full name/i);
        });
    });

    describe('When a name is mapped once', () => {
        it('Then it passes, whether first_name or contact_name', () => {
            expect(checkMapping({ A: 'first_name', B: null, C: '' })).toBeNull();
            expect(checkMapping({ A: 'contact_name' })).toBeNull();
        });
    });
});

describe('Given compactMapping', () => {
    it('Then unmapped headers are dropped', () => {
        expect(compactMapping({ A: 'email', B: null, C: '' })).toEqual({ A: 'email' });
    });
});

describe('Given describeImportError', () => {
    describe('When crm-be explained the failure', () => {
        it('Then its message is shown', () => {
            expect(describeImportError(new Error('Field is mapped more than once'), 'x')).toBe('Field is mapped more than once');
        });
    });

    describe('When only a status echo, route miss or 500 text came back', () => {
        it('Then the fallback is shown', () => {
            expect(describeImportError(new Error('Upload failed: 502'), 'fb')).toBe('fb');
            expect(describeImportError(new Error('Cannot POST /leads/import'), 'fb')).toBe('fb');
            expect(describeImportError(new Error('Internal server error'), 'fb')).toBe('fb');
            expect(describeImportError(undefined, 'fb')).toBe('fb');
        });
    });
});

describe('Given more describeImportError inputs', () => {
    describe('When the error has an empty message or is a plain object', () => {
        it('Then an empty message falls back and a plain {message} is shown', () => {
            expect(describeImportError(new Error(''), 'fb')).toBe('fb');
            expect(describeImportError(null, 'fb')).toBe('fb');
            expect(describeImportError({ message: 'Too many rows (max 5000)' }, 'fb')).toBe('Too many rows (max 5000)');
        });
    });
    describe('When the route-miss or 500 text differs only in case or verb', () => {
        it('Then it still falls back', () => {
            expect(describeImportError(new Error('cannot get /leads/import/preview'), 'fb')).toBe('fb');
            expect(describeImportError(new Error('Cannot DELETE /x'), 'fb')).toBe('fb');
            expect(describeImportError(new Error('INTERNAL SERVER ERROR'), 'fb')).toBe('fb');
        });
    });
    describe('When the message only looks like a status echo', () => {
        it('Then it is shown as-is', () => {
            expect(describeImportError(new Error('Upload failed: bad header'), 'fb')).toBe('Upload failed: bad header');
            expect(describeImportError(new Error('Cannotation'), 'fb')).toBe('Cannotation');
        });
    });
});

describe('Given the import catalogues and file boundaries', () => {
    it('Then the three duplicate policies and accepted types are exposed', () => {
        expect(DUPLICATE_POLICIES.map(p => p.value)).toEqual(['skip', 'update', 'create']);
        expect(ACCEPTED_IMPORT_TYPES).toBe('.csv,.xlsx');
        expect(MAX_IMPORT_BYTES).toBe(10 * 1024 * 1024);
    });
    it('Then a file of exactly 10 MB and undefined input are handled', () => {
        expect(checkImportFile(fileOf('leads.csv', MAX_IMPORT_BYTES))).toBeNull();
        expect(checkImportFile(undefined)).toMatch(/choose/i);
        expect(checkImportFile(fileOf('leads.csv.txt', 10))).toMatch(/only/i);
    });
    it('Then an empty mapping asks for a name and compacts to nothing', () => {
        expect(checkMapping({})).toMatch(/first name or full name/i);
        expect(compactMapping({})).toEqual({});
    });
});
