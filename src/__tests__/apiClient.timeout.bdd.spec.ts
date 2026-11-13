/**
 * CRM apiClient GET timeout (CRM-W4-1): 30 s for normal GETs, none for reports/exports/analytics.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmApiClient } from '../services/crmService';

let abortSignals: AbortSignal[];

beforeEach(() => {
  vi.useFakeTimers();
  abortSignals = [];
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
    if (init?.signal) abortSignals.push(init.signal);
    return new Promise((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      setTimeout(() => resolve({ ok: true, status: 200, headers: new Headers(), text: () => Promise.resolve('{"ok":true}') }), 45_000);
    });
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Given a slow GET on a normal endpoint', () => {
  it('When it takes 45 s / Then it times out after 30 s', async () => {
    const p = crmApiClient.get('/leads');
    const assertion = expect(p).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(31_000);
    await assertion;
  });
});

describe('Given a slow GET on a reports/export/analytics endpoint', () => {
  it.each(['/reports/pipeline', '/leads/export', '/analytics/summary'])(
    'When %s takes 45 s / Then it completes without timing out',
    async (path) => {
      const p = crmApiClient.get(path);
      await vi.advanceTimersByTimeAsync(46_000);
      await expect(p).resolves.toEqual({ ok: true });
    },
  );
});
