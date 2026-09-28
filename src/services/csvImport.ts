/**
 * Client-side CSV reading for the record importers that take JSON rows
 * (existing clients → Core, projects → Inventory categories, units →
 * Inventory bulk-import commit). Leads keep their server-side parser in
 * crm-be, which also reads .xlsx.
 *
 * RFC 4180: comma separated, "quoted" fields may hold commas, newlines and
 * doubled quotes (""), CRLF or LF line endings, an optional UTF-8 BOM.
 * Blank lines are dropped. The first row is the header row.
 */

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 2000;
export const ACCEPTED_CSV_TYPES = '.csv';

export interface ParsedCsv {
    headers: string[];
    /** header → cell text (trimmed); a short row leaves the rest as ''. */
    rows: Record<string, string>[];
}

/** One mappable target field of an importer. */
export interface ImportField {
    key: string;
    label: string;
    required?: boolean;
    /** Extra header spellings recognised when suggesting a mapping. */
    aliases?: string[];
}

/** Why this file cannot be read as CSV, or null. */
export function checkCsvFile(file: File | null | undefined): string | null {
    if (!file) return 'Choose a .csv file.';
    if (!/\.csv$/i.test(file.name)) return 'Only .csv files can be imported here. Save the sheet as CSV first.';
    if (file.size === 0) return 'The file is empty.';
    if (file.size > MAX_CSV_BYTES) return 'The file is larger than 5 MB.';
    return null;
}

/** Splits CSV text into records of raw cells. */
export function splitCsv(text: string): string[][] {
    const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const records: string[][] = [];
    let record: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (quoted) {
            if (ch === '"') {
                if (src[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
            } else {
                cell += ch;
            }
            continue;
        }
        if (ch === '"') { quoted = true; continue; }
        if (ch === ',') { record.push(cell); cell = ''; continue; }
        if (ch === '\r' || ch === '\n') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            record.push(cell);
            records.push(record);
            record = [];
            cell = '';
            continue;
        }
        cell += ch;
    }
    if (cell !== '' || record.length > 0) {
        record.push(cell);
        records.push(record);
    }
    return records.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Parses CSV text; throws a readable Error for a file with no data rows. */
export function parseCsv(text: string): ParsedCsv {
    const records = splitCsv(text);
    if (records.length === 0) throw new Error('The file has no header row.');
    const headers = records[0].map((h) => h.trim());
    if (headers.some((h) => h === '')) throw new Error('Every column needs a header.');
    if (new Set(headers.map((h) => h.toLowerCase())).size !== headers.length) {
        throw new Error('Two columns have the same header.');
    }
    const body = records.slice(1);
    if (body.length === 0) throw new Error('The file has headers but no rows.');
    if (body.length > MAX_CSV_ROWS) throw new Error(`The file has ${body.length} rows; the limit is ${MAX_CSV_ROWS}.`);
    const rows = body.map((cells) =>
        Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()])),
    );
    return { headers, rows };
}

/** Reads a File as text (FileReader keeps it working in every browser and jsdom). */
export function readFileText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.readAsText(file);
    });
}

/** "Built-up Area (sqft)" → "built_up_area_sqft" */
export function normaliseHeader(header: string): string {
    return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** header → field key (or null), matching the key, label and aliases. Each field is used once. */
export function suggestMapping(headers: string[], fields: ImportField[]): Record<string, string | null> {
    const used = new Set<string>();
    const mapping: Record<string, string | null> = {};
    for (const header of headers) {
        const norm = normaliseHeader(header);
        const match = fields.find((f) =>
            !used.has(f.key) &&
            [f.key, f.label, ...(f.aliases ?? [])].some((name) => normaliseHeader(name) === norm),
        );
        mapping[header] = match ? match.key : null;
        if (match) used.add(match.key);
    }
    return mapping;
}

/** Why the mapping cannot be used, or null: each field once, every required field mapped. */
export function checkFieldMapping(mapping: Record<string, string | null>, fields: ImportField[]): string | null {
    const seen = new Set<string>();
    for (const key of Object.values(mapping)) {
        if (!key) continue;
        if (seen.has(key)) return 'Each field can be mapped to only one column.';
        seen.add(key);
    }
    const missing = fields.filter((f) => f.required && !seen.has(f.key));
    if (missing.length > 0) return `Map a column to ${missing.map((f) => f.label).join(', ')}.`;
    return null;
}

/** Re-keys every row by field key; unmapped columns and blank cells are dropped. */
export function applyMapping(rows: Record<string, string>[], mapping: Record<string, string | null>): Record<string, string>[] {
    return rows.map((row) => {
        const out: Record<string, string> = {};
        for (const [header, key] of Object.entries(mapping)) {
            if (!key) continue;
            const value = row[header];
            if (value !== undefined && value !== '') out[key] = value;
        }
        return out;
    });
}

/** "1,250.50" / "AED 1,250" / "12%" → number; '' → null; anything else → NaN. */
export function toNumber(raw: string | undefined): number | null {
    if (raw === undefined || raw.trim() === '') return null;
    const cleaned = raw.replace(/[,\s%]/g, '').replace(/^[A-Za-z$€£₹]+/, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
    return Number(cleaned);
}
