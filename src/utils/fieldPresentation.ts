/**
 * Shared presentation layer for lead/customer field values.
 *
 * Lead Detail renders only ADMIN-DEFINED custom fields, looked up by definition id
 * and formatted per the definition's declared type. The Quick Overview drawer
 * instead iterated the raw `meta_data` JSONB bucket and pushed every value through
 * `String(val)` — so internal bookkeeping keys the merge flow writes (`merged_into`,
 * `merged_at`) surfaced to users as a bare UUID and a raw ISO timestamp.
 *
 * Both surfaces now share this module so labels, formatting, lookup resolution and
 * the empty-value placeholder can never drift apart again.
 */

/** Placeholder for a value that is absent, blank, or unresolvable. */
export const EMPTY_VALUE = '—';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when a value looks like a raw database identifier that must never be shown. */
export function isUuid(value: unknown): boolean {
    return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * `meta_data` keys owned by the system rather than by the user.
 *
 * These are either rendered through a dedicated, resolved presentation (the merge
 * pair) or suppressed entirely — never dumped into the generic "Additional Fields"
 * list where they read as gibberish.
 */
export const SYSTEM_META_KEYS = new Set([
    'merged_into',
    'merged_at',
    'merged_by',
    'merged_from',
    'converted_at',
    'converted_by',
    'source_ref',
    'import_batch_id',
    'dedupe_hash',
    'external_id',
    'raw_payload',
]);

/**
 * Keys already surfaced by a dedicated, labelled row elsewhere in the panel.
 * Repeating them under "Additional Fields" is noise.
 */
export const PROMOTED_META_KEYS = new Set([
    'city',
    'state',
    'country',
    'industry',
    'website',
    'tags',
    'priority',
    'deal_value',
    'campaign',
]);

/** "merged_into" → "Merged Into". Mirrors the label casing used on Lead Detail. */
export function humanizeFieldLabel(key: string): string {
    return key
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FormatFieldValueOptions {
    /** Bound formatter from `useCRMFormatters()` — supplies org timezone + locale. */
    formatDate?: (value: any, options?: any) => string;
    /** Resolved display names keyed by id, for lookup fields. */
    lookups?: Record<string, string | undefined>;
}

/**
 * Render any raw field value as text a user can read.
 *
 * Rules, in order:
 *   - null / undefined / '' / []      → EMPTY_VALUE
 *   - boolean                         → Yes / No
 *   - a UUID with a resolved lookup   → the resolved name
 *   - a UUID with no resolved lookup  → EMPTY_VALUE (never leak the identifier)
 *   - ISO timestamp                   → localized date + time
 *   - ISO date                        → localized date
 *   - array                           → comma-joined
 *   - object                          → EMPTY_VALUE (no "[object Object]")
 */
export function formatFieldValue(
    value: unknown,
    { formatDate, lookups }: FormatFieldValueOptions = {},
): string {
    if (value === null || value === undefined) return EMPTY_VALUE;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : EMPTY_VALUE;

    if (Array.isArray(value)) {
        const parts = value
            .map((v) => formatFieldValue(v, { formatDate, lookups }))
            .filter((v) => v !== EMPTY_VALUE);
        return parts.length ? parts.join(', ') : EMPTY_VALUE;
    }

    if (typeof value === 'object') return EMPTY_VALUE;

    const str = String(value).trim();
    if (!str) return EMPTY_VALUE;

    if (isUuid(str)) {
        const resolved = lookups?.[str];
        return resolved && resolved.trim() ? resolved.trim() : EMPTY_VALUE;
    }

    if (ISO_TIMESTAMP_RE.test(str)) {
        return formatDate
            ? formatDate(str, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
              })
            : str;
    }

    if (ISO_DATE_RE.test(str)) {
        return formatDate
            ? formatDate(str, { year: 'numeric', month: 'short', day: 'numeric' })
            : str;
    }

    return str;
}

/** Shown when a custom field's definition has been deleted or is not loaded yet. */
export const UNNAMED_CUSTOM_FIELD = 'Unnamed Custom Field';

/** The subset of a CustomFieldDefinition needed to name a stored value. */
export interface CustomFieldLabelSource {
    id: string;
    label?: string | null;
    name?: string | null;
}

export interface VisibleMetaEntriesOptions extends FormatFieldValueOptions {
    /**
     * Admin-configured custom field definitions. Values are stored under the
     * definition's **id**, so without these the panel has nothing to show but the
     * raw UUID.
     */
    customFieldDefs?: CustomFieldLabelSource[];
}

/**
 * The display name for a `meta_data` key.
 *
 * Custom-field values are keyed by definition id, so `humanizeFieldLabel` turned
 * `0a0aeff5-5ad0-431b-8eb8-5717e5117826` into the "label"
 * "0A0AEFF5 5AD0 431B 8EB8 5717E5117826" — a database identifier presented to
 * the user as if it were a business field name. An id resolves through the
 * definitions; only ordinary keys are humanized.
 */
export function resolveMetaLabel(
    key: string,
    customFieldDefs: CustomFieldLabelSource[] = [],
): string {
    const def = customFieldDefs.find((d) => d.id === key);
    if (def) return (def.label || def.name || '').trim() || UNNAMED_CUSTOM_FIELD;
    // Never let an identifier reach the UI, even with no definition to match.
    if (isUuid(key)) return UNNAMED_CUSTOM_FIELD;
    return humanizeFieldLabel(key);
}

/**
 * The `meta_data` entries safe to show in a generic "Additional Fields" list:
 * system bookkeeping and already-promoted keys removed, and anything whose value
 * renders as empty dropped rather than shown as a bare dash.
 */
export function visibleMetaEntries(
    metaData: Record<string, unknown> | null | undefined,
    options: VisibleMetaEntriesOptions = {},
): Array<{ key: string; label: string; value: string }> {
    if (!metaData) return [];
    const { customFieldDefs = [], ...formatOptions } = options;
    return Object.entries(metaData)
        .filter(([key]) => !SYSTEM_META_KEYS.has(key) && !PROMOTED_META_KEYS.has(key))
        .map(([key, raw]) => ({
            key,
            label: resolveMetaLabel(key, customFieldDefs),
            value: formatFieldValue(raw, formatOptions),
        }))
        .filter((entry) => entry.value !== EMPTY_VALUE);
}
