/**
 * Test contract (UI kit): every kit component derives a stable data-testid
 * from its props so E2E drivers never depend on copy or CSS.
 *
 *   testId('field', 'Customer Name')  -> 'field-customer_name'
 *   testId('confirm', 'delete')       -> 'confirm-delete'
 *
 * An explicit `data-testid` passed by the caller always wins — see
 * resolveTestId.
 */
export function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function testId(kind: string, name?: string | null): string {
    const slug = name ? slugify(name) : '';
    return slug ? `${kind}-${slug}` : kind;
}

export function resolveTestId(
    explicit: string | undefined,
    kind: string,
    name?: string | null,
): string {
    return explicit ?? testId(kind, name);
}
