import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLeadDetailLayoutPreferences } from './useLeadDetailLayoutPreferences';

const store: Record<string, string> = {};
const okJson = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const puts = (m: ReturnType<typeof vi.fn>) => m.mock.calls.filter(([, init]) => init?.method === 'PUT');

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => Object.keys(store).forEach((k) => delete store[k]),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useLeadDetailLayoutPreferences — backend sync', () => {
  it('given no remote layout, when a lead page only loads, then no PUT is sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(null));
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useLeadDetailLayoutPreferences());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 1000));
    expect(puts(fetchMock)).toHaveLength(0);
  });

  it('given the user hides a section, then the layout is PUT once (debounced)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(null));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLeadDetailLayoutPreferences());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    const key = result.current.sections[0].key;
    act(() => { result.current.toggleVisible(key); });
    await waitFor(() => expect(puts(fetchMock)).toHaveLength(1), { timeout: 2000 });
    expect(String(puts(fetchMock)[0][0])).toContain('/grid/columns');
  });
});
