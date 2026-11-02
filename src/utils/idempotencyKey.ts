/**
 * A random Idempotency-Key for one create attempt (Pulse 3f510e56).
 * crypto.randomUUID needs a secure context, so plain-http LAN access falls back
 * to getRandomValues, then to Math.random as a last resort.
 */
export function newIdempotencyKey(): string {
    const c: Crypto | undefined = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    if (c && typeof c.getRandomValues === 'function') {
        const bytes = c.getRandomValues(new Uint8Array(16));
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}
