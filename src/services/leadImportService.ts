import { crmApiClient } from './crmService';

/**
 * Bulk lead import (A7). crm-be has no /v1 prefix. Both calls are multipart
 * with the file in the "file" field; the file is re-sent on import (crm-be
 * keeps no upload token).
 *
 *  POST /leads/import/preview  file → ImportPreview (nothing written)
 *  POST /leads/import          file + mapping (JSON string) + duplicate_policy → ImportResult
 */

export type ImportDuplicatePolicy = 'skip' | 'update' | 'create';

export interface ImportFieldOption {
    key: string;
    label: string;
    custom?: boolean;
    type?: string | null;
}

export interface ImportPreview {
    headers: string[];
    sample_rows: Record<string, string>[];
    total_rows: number;
    /** header → field key, or null when nothing matched */
    suggested_mapping: Record<string, string | null>;
    available_fields: ImportFieldOption[];
}

export interface ImportResult {
    total_rows: number;
    created: number;
    updated: number;
    skipped: number;
    /** row = spreadsheet row number */
    errors: Array<{ row: number; message: string }>;
}

export const DUPLICATE_POLICIES: Array<{ value: ImportDuplicatePolicy; label: string; hint: string }> = [
    { value: 'skip', label: 'Skip', hint: 'Leave the existing lead as it is' },
    { value: 'update', label: 'Update', hint: 'Fill the existing lead with the file values' },
    { value: 'create', label: 'Create anyway', hint: 'Add a new lead (an email already on file is never created twice)' },
];

/** Limits enforced by crm-be; checked here so a bad file fails before upload. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMPORT_TYPES = '.csv,.xlsx';

/** Why this file cannot be imported, or null. */
export function checkImportFile(file: File | null | undefined): string | null {
    if (!file) return 'Choose a .csv or .xlsx file.';
    if (!/\.(csv|xlsx)$/i.test(file.name)) return 'Only .csv and .xlsx files can be imported.';
    if (file.size === 0) return 'The file is empty.';
    if (file.size > MAX_IMPORT_BYTES) return 'The file is larger than 10 MB.';
    return null;
}

/** Why the mapping cannot be imported, or null (mirrors crm-be's checks). */
export function checkMapping(mapping: Record<string, string | null>): string | null {
    const used = Object.values(mapping).filter((v): v is string => !!v);
    const seen = new Set<string>();
    for (const key of used) {
        if (seen.has(key)) return 'Each field can be mapped to only one column.';
        seen.add(key);
    }
    if (!seen.has('first_name') && !seen.has('contact_name')) {
        return 'Map a column to First name or Full name.';
    }
    return null;
}

/** Drops unmapped headers so only real choices are sent. */
export function compactMapping(mapping: Record<string, string | null>): Record<string, string> {
    return Object.fromEntries(Object.entries(mapping).filter(([, v]) => !!v)) as Record<string, string>;
}

/**
 * uploadMultipart throws a plain Error (no status) carrying crm-be's message,
 * so the explained 400s (bad mapping, too many rows, wrong file) come through
 * as-is; only its bare status echo and Nest's unmatched-route text fall back.
 */
export function describeImportError(error: unknown, fallback: string): string {
    const message = (error as Error)?.message;
    if (!message) return fallback;
    if (/^Upload failed: \d+$/.test(message)) return fallback;
    if (/^Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(message)) return fallback;
    if (/^Internal server error$/i.test(message)) return fallback;
    return message;
}

export const leadImportService = {
    preview: (file: File) => crmApiClient.uploadMultipart<ImportPreview>('/leads/import/preview', file),
    import: (file: File, mapping: Record<string, string | null>, duplicatePolicy: ImportDuplicatePolicy) =>
        crmApiClient.uploadMultipart<ImportResult>('/leads/import', file, {
            mapping: JSON.stringify(compactMapping(mapping)),
            duplicate_policy: duplicatePolicy,
        }),
};
