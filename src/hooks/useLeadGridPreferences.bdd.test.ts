import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLeadGridPreferences, DEFAULT_COLUMNS } from './useLeadGridPreferences';

const STORAGE_KEY = 'crm_leads_grid_prefs_v2';

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => Object.keys(mockStorage).forEach((k) => delete mockStorage[k]),
  });
  // Default: backend is "offline" so the hook falls back to localStorage. This
  // keeps every existing test purely local; BE-sync tests override fetch below.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useLeadGridPreferences — initial state', () => {
  it('loads default columns when no stored prefs exist', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    expect(result.current.columns.length).toBe(DEFAULT_COLUMNS.length);
  });

  it('defaults density to comfortable', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    expect(result.current.density).toBe('comfortable');
  });

  it('starts with no saved views', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    expect(result.current.savedViews).toEqual([]);
  });

  it('visible columns exclude hidden defaults', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    const hiddenKeys = DEFAULT_COLUMNS.filter((c) => !c.visible).map((c) => c.key);
    const visibleKeys = result.current.visibleColumns.map((c) => c.key);
    for (const key of hiddenKeys) {
      expect(visibleKeys).not.toContain(key);
    }
  });
});

describe('useLeadGridPreferences — column management', () => {
  it('toggles column visibility via updateColumn', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    const initialVisible = result.current.columns.find((c) => c.key === 'city')?.visible;
    act(() => { result.current.updateColumn('city', { visible: !initialVisible }); });
    expect(result.current.columns.find((c) => c.key === 'city')?.visible).toBe(!initialVisible);
  });

  it('pins a column', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.updateColumn('email', { pinned: true }); });
    expect(result.current.columns.find((c) => c.key === 'email')?.pinned).toBe(true);
  });

  it('updates column width', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.updateColumn('company', { width: 300 }); });
    expect(result.current.columns.find((c) => c.key === 'company')?.width).toBe(300);
  });

  it('reorders columns', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    const contactOrderBefore = result.current.columns.find((c) => c.key === 'contact')?.order ?? 0;
    const emailOrderBefore = result.current.columns.find((c) => c.key === 'email')?.order ?? 0;
    act(() => { result.current.reorderColumns('email', 'contact'); });
    const contactOrderAfter = result.current.columns.find((c) => c.key === 'contact')?.order ?? 0;
    const emailOrderAfter = result.current.columns.find((c) => c.key === 'email')?.order ?? 0;
    // After reorder, email should come before contact
    expect(emailOrderAfter).toBeLessThan(contactOrderAfter);
    expect(emailOrderBefore).toBeGreaterThan(contactOrderBefore);
  });

  it('resets to default columns and density', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.updateColumn('city', { visible: true }); });
    act(() => { result.current.setDensity('compact'); });
    act(() => { result.current.resetToDefaults(); });
    expect(result.current.density).toBe('comfortable');
    const cityCol = result.current.columns.find((c) => c.key === 'city');
    expect(cityCol?.visible).toBe(false); // default is hidden
  });
});

describe('useLeadGridPreferences — density', () => {
  it('changes density to compact', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.setDensity('compact'); });
    expect(result.current.density).toBe('compact');
  });

  it('changes density to spacious', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.setDensity('spacious'); });
    expect(result.current.density).toBe('spacious');
  });
});

describe('useLeadGridPreferences — saved views', () => {
  it('saves a view with filters and sorts', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => {
      result.current.saveView('Hot Leads', { status: 'Qualified' }, [{ field: 'created_at', direction: 'desc' }]);
    });
    expect(result.current.savedViews).toHaveLength(1);
    expect(result.current.savedViews[0].name).toBe('Hot Leads');
    expect(result.current.savedViews[0].filters).toEqual({ status: 'Qualified' });
    expect(result.current.savedViews[0].sorts[0].field).toBe('created_at');
  });

  it('renames a view', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.saveView('Old Name', {}, []); });
    const id = result.current.savedViews[0].id;
    act(() => { result.current.renameView(id, 'New Name'); });
    expect(result.current.savedViews[0].name).toBe('New Name');
  });

  it('deletes a view', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.saveView('Temp View', {}, []); });
    const id = result.current.savedViews[0].id;
    act(() => { result.current.deleteView(id); });
    expect(result.current.savedViews).toHaveLength(0);
  });

  it('clears activeViewId when active view is deleted', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.saveView('My View', {}, []); });
    const id = result.current.savedViews[0].id;
    act(() => { result.current.setActiveView(id); });
    expect(result.current.activeViewId).toBe(id);
    act(() => { result.current.deleteView(id); });
    expect(result.current.activeViewId).toBeNull();
  });
});

describe('useLeadGridPreferences — persistence', () => {
  it('persists prefs to localStorage on change', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    act(() => { result.current.setDensity('compact'); });
    const stored = JSON.parse(mockStorage[STORAGE_KEY] ?? '{}');
    expect(stored.density).toBe('compact');
  });

  it('loads prefs from localStorage on mount', () => {
    mockStorage[STORAGE_KEY] = JSON.stringify({
      columns: DEFAULT_COLUMNS,
      density: 'spacious',
      savedViews: [],
      activeViewId: null,
    });
    const { result } = renderHook(() => useLeadGridPreferences());
    expect(result.current.density).toBe('spacious');
  });

  it('merges new default columns when upgrading from old prefs', () => {
    // Store prefs with a column removed (simulating upgrade from old version)
    const subsetColumns = DEFAULT_COLUMNS.filter((c) => c.key !== 'tags');
    mockStorage[STORAGE_KEY] = JSON.stringify({
      columns: subsetColumns,
      density: 'comfortable',
      savedViews: [],
      activeViewId: null,
    });
    const { result } = renderHook(() => useLeadGridPreferences());
    // tags column should be added back from defaults
    expect(result.current.columns.some((c) => c.key === 'tags')).toBe(true);
  });
});

describe('useLeadGridPreferences — visibleColumns', () => {
  it('returns only visible columns sorted by order', () => {
    const { result } = renderHook(() => useLeadGridPreferences());
    const visible = result.current.visibleColumns;
    for (let i = 1; i < visible.length; i++) {
      expect(visible[i].order).toBeGreaterThanOrEqual(visible[i - 1].order);
    }
    expect(visible.every((c) => c.visible)).toBe(true);
  });
});

describe('useLeadGridPreferences — backend sync', () => {
  const okJson = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

  it('hydrates the column layout from the backend on mount', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okJson({ prefs: { columns: [{ key: 'company', visible: true, width: 999, pinned: true, order: 1 }], density: 'spacious' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useLeadGridPreferences());

    await waitFor(() => expect(result.current.density).toBe('spacious'));
    expect(result.current.columns.find((c) => c.key === 'company')?.width).toBe(999);
    // defaults not present in the remote payload are merged back in
    expect(result.current.columns.some((c) => c.key === 'email')).toBe(true);
  });

  it('keeps localStorage state when the backend is offline', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLeadGridPreferences());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.columns.length).toBe(DEFAULT_COLUMNS.length);
  });

  it('pushes column changes to the backend (debounced)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({}));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLeadGridPreferences());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => { result.current.updateColumn('company', { width: 321 }); });

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeTruthy();
      expect(String(put![0])).toContain('/grid/columns');
      const body = JSON.parse(put![1].body);
      expect(body.prefs.columns.find((c: { key: string; width: number }) => c.key === 'company').width).toBe(321);
    }, { timeout: 2000 });
  });

  it('clears the backend layout on reset', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({}));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useLeadGridPreferences());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => { result.current.resetToDefaults(); });

    await waitFor(() => {
      const del = fetchMock.mock.calls.find(([url, init]) => init?.method === 'DELETE' && String(url).includes('/grid/columns'));
      expect(del).toBeTruthy();
    }, { timeout: 2000 });
  });
});
