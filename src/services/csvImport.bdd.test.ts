import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    MAX_CSV_BYTES, MAX_CSV_ROWS, applyMapping, checkCsvFile, checkFieldMapping, normaliseHeader,
    parseCsv, readFileText, splitCsv, suggestMapping, toNumber, ImportField,
} from './csvImport';

const fileOf = (name: string, size: number) => {
    const f = new File(['x'], name);
    Object.defineProperty(f, 'size', { value: size });
    return f;
};

describe('Given a file picked for a CSV import', () => {
    it('When nothing was picked, Then it asks for a .csv file', () => {
        expect(checkCsvFile(null)).toBe('Choose a .csv file.');
        expect(checkCsvFile(undefined)).toBe('Choose a .csv file.');
    });
    it('When it is not a .csv, Then it says to save the sheet as CSV', () => {
        expect(checkCsvFile(fileOf('units.xlsx', 10))).toMatch(/Save the sheet as CSV/);
    });
    it('When it is empty, Then it says so', () => {
        expect(checkCsvFile(fileOf('units.csv', 0))).toBe('The file is empty.');
    });
    it('When it is over 5 MB, Then it is refused', () => {
        expect(checkCsvFile(fileOf('units.csv', MAX_CSV_BYTES + 1))).toBe('The file is larger than 5 MB.');
    });
    it('When it is a small .CSV (any case), Then it is accepted', () => {
        expect(checkCsvFile(fileOf('UNITS.CSV', MAX_CSV_BYTES))).toBeNull();
    });
});

describe('Given CSV text', () => {
    it('When fields are quoted with commas, newlines and doubled quotes, Then each cell is kept whole', () => {
        const text = 'name,notes\r\n"Tower A, Phase 1","line1\nline2 ""quoted"""\r\n';
        expect(splitCsv(text)).toEqual([['name', 'notes'], ['Tower A, Phase 1', 'line1\nline2 "quoted"']]);
    });
    it('When it starts with a BOM and has blank lines, Then the BOM and blank lines are dropped', () => {
        expect(splitCsv('﻿a,b\n\n1,2\n , \n')).toEqual([['a', 'b'], ['1', '2']]);
    });
    it('When the last line has no newline, Then it is still read', () => {
        expect(splitCsv('a\r1')).toEqual([['a'], ['1']]);
    });
    it('When the last line ends in an empty cell, Then the empty cell is kept', () => {
        expect(splitCsv('a,b\n1,')).toEqual([['a', 'b'], ['1', '']]);
    });
});

describe('Given CSV text to parse', () => {
    it('When it is valid, Then rows are keyed by trimmed header and short rows are padded', () => {
        expect(parseCsv(' Name , Email\nAli, ali@x.com \nSara')).toEqual({
            headers: ['Name', 'Email'],
            rows: [{ Name: 'Ali', Email: 'ali@x.com' }, { Name: 'Sara', Email: '' }],
        });
    });
    it('When it is blank, Then there is no header row', () => {
        expect(() => parseCsv('\n\n')).toThrow('The file has no header row.');
    });
    it('When a header is blank, Then every column needs one', () => {
        expect(() => parseCsv('a,,c\n1,2,3')).toThrow('Every column needs a header.');
    });
    it('When two headers match ignoring case, Then it is refused', () => {
        expect(() => parseCsv('Email,email\n1,2')).toThrow('Two columns have the same header.');
    });
    it('When there are only headers, Then it says there are no rows', () => {
        expect(() => parseCsv('a,b\n')).toThrow('The file has headers but no rows.');
    });
    it('When there are more than 2000 rows, Then it names the count and the limit', () => {
        const text = `a\n${Array.from({ length: MAX_CSV_ROWS + 1 }, (_, i) => i).join('\n')}`;
        expect(() => parseCsv(text)).toThrow(`The file has ${MAX_CSV_ROWS + 1} rows; the limit is ${MAX_CSV_ROWS}.`);
    });
});

describe('Given a File to read', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('When it reads, Then its text is returned', async () => {
        await expect(readFileText(new File(['a,b\n1,2'], 'x.csv'))).resolves.toBe('a,b\n1,2');
    });
    it('When the reader yields no result, Then it resolves to an empty string', async () => {
        class NullReader {
            result: unknown = null;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            readAsText() { this.onload?.(); }
        }
        vi.stubGlobal('FileReader', NullReader);
        await expect(readFileText(new File(['x'], 'x.csv'))).resolves.toBe('');
    });
    it('When the reader fails, Then it rejects with a readable message', async () => {
        class FailingReader {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            readAsText() { this.onerror?.(); }
        }
        vi.stubGlobal('FileReader', FailingReader);
        await expect(readFileText(new File(['x'], 'x.csv'))).rejects.toThrow('Could not read the file.');
    });
});

const FIELDS: ImportField[] = [
    { key: 'unit_number', label: 'Unit number', required: true, aliases: ['unit no'] },
    { key: 'built_up_area', label: 'Built-up area', aliases: ['bua'] },
    { key: 'project', label: 'Project', required: true },
];

describe('Given sheet headers and importer fields', () => {
    it('When headers are spelled differently, Then they are normalised', () => {
        expect(normaliseHeader('  Built-up Area (sqft) ')).toBe('built_up_area_sqft');
    });
    it('When headers match a key, label or alias, Then a mapping is suggested and each field is used once', () => {
        expect(suggestMapping(['Unit No', 'unit_number', 'BUA', 'Notes', 'PROJECT'], FIELDS)).toEqual({
            'Unit No': 'unit_number',
            unit_number: null,
            BUA: 'built_up_area',
            Notes: null,
            PROJECT: 'project',
        });
    });
    it('When a field has no aliases, Then its key and label still match', () => {
        expect(suggestMapping(['Project'], [{ key: 'project', label: 'Project' }])).toEqual({ Project: 'project' });
    });
});

describe('Given a column mapping', () => {
    it('When two columns map to one field, Then it is refused', () => {
        expect(checkFieldMapping({ a: 'project', b: 'project' }, FIELDS)).toBe('Each field can be mapped to only one column.');
    });
    it('When required fields are unmapped, Then it names them', () => {
        expect(checkFieldMapping({ a: 'built_up_area', b: null }, FIELDS)).toBe('Map a column to Unit number, Project.');
    });
    it('When every required field is mapped once, Then it is accepted', () => {
        expect(checkFieldMapping({ a: 'unit_number', b: 'project', c: null }, FIELDS)).toBeNull();
    });
    it('When applied, Then rows are keyed by field and blanks and unmapped columns are dropped', () => {
        const rows = [{ U: '101', P: 'Palm', X: 'ignore', B: '' }];
        expect(applyMapping(rows, { U: 'unit_number', P: 'project', X: null, B: 'built_up_area', Missing: 'x' }))
            .toEqual([{ unit_number: '101', project: 'Palm' }]);
    });
});

describe('Given a cell holding a number', () => {
    it.each([
        ['1,250.50', 1250.5],
        ['AED 1,250', 1250],
        ['12%', 12],
        ['-3', -3],
        ['$9', 9],
    ])('When it is "%s", Then it reads as %s', (raw, n) => {
        expect(toNumber(raw)).toBe(n);
    });
    it('When it is blank or missing, Then it is null', () => {
        expect(toNumber('  ')).toBeNull();
        expect(toNumber(undefined)).toBeNull();
    });
    it('When it is not a number, Then it is NaN', () => {
        expect(toNumber('twelve')).toBeNaN();
        expect(toNumber('1.2.3')).toBeNaN();
    });
});
