/** newIdempotencyKey — one random key per create attempt (Pulse 3f510e56). */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { newIdempotencyKey } from './idempotencyKey';

afterEach(() => vi.unstubAllGlobals());

describe('newIdempotencyKey', () => {
  it('Given crypto.randomUUID / When a key is made / Then it is the UUID', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1', getRandomValues: vi.fn() });
    expect(newIdempotencyKey()).toBe('uuid-1');
  });

  it('Given no randomUUID (plain-http LAN) / When a key is made / Then 16 random bytes are hex-encoded', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(171) });
    expect(newIdempotencyKey()).toBe('ab'.repeat(16));
  });

  it('Given no Web Crypto at all / When two keys are made / Then both are non-empty and differ', () => {
    vi.stubGlobal('crypto', undefined);
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a.length).toBeGreaterThan(10);
    expect(a).not.toBe(b);
  });
});
