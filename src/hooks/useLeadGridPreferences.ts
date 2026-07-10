import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { crmService } from '../services/crmService';

export type GridDensity = 'compact' | 'comfortable' | 'spacious';

export interface ColumnPreference {
  key: string;
  visible: boolean;
  width: number;
  pinned: boolean;
  order: number;
}

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SavedView {
  id: string;
  name: string;
  columns: ColumnPreference[];
  sorts: SortSpec[];
  filters: Record<string, string>;
  density: GridDensity;
  isDefault?: boolean;
}

interface GridPreferences {
  columns: ColumnPreference[];
  density: GridDensity;
  savedViews: SavedView[];
  activeViewId: string | null;
}

const STORAGE_KEY = 'crm_leads_grid_prefs_v2';

export const DEFAULT_COLUMNS: ColumnPreference[] = [
  { key: 'select',     visible: true,  width: 48,  pinned: true,  order: 0  },
  { key: 'company',    visible: true,  width: 220, pinned: true,  order: 1  },
  { key: 'contact',    visible: true,  width: 180, pinned: false, order: 2  },
  { key: 'email',      visible: true,  width: 200, pinned: false, order: 3  },
  { key: 'phone',      visible: true,  width: 140, pinned: false, order: 4  },
  { key: 'status',     visible: true,  width: 140, pinned: false, order: 5  },
  { key: 'owner',      visible: true,  width: 160, pinned: false, order: 6  },
  { key: 'source',     visible: true,  width: 130, pinned: false, order: 7  },
  { key: 'lead_score', visible: true,  width: 120, pinned: false, order: 8  },
  { key: 'created_at', visible: true,  width: 140, pinned: false, order: 9  },
  { key: 'updated_at', visible: false, width: 140, pinned: false, order: 10 },
  { key: 'city',       visible: false, width: 120, pinned: false, order: 11 },
  { key: 'state',      visible: false, width: 120, pinned: false, order: 12 },
  { key: 'country',    visible: false, width: 120, pinned: false, order: 13 },
  { key: 'industry',   visible: false, width: 140, pinned: false, order: 14 },
  { key: 'website',    visible: false, width: 180, pinned: false, order: 15 },
  { key: 'priority',   visible: false, width: 100, pinned: false, order: 16 },
  { key: 'deal_value', visible: false, width: 130, pinned: false, order: 17 },
  { key: 'tags',           visible: false, width: 200, pinned: false, order: 18 },
  { key: 'lead_health',    visible: true,  width: 110, pinned: false, order: 19 },
  { key: 'next_follow_up', visible: true,  width: 150, pinned: false, order: 20 },
  { key: 'last_activity',  visible: false, width: 140, pinned: false, order: 21 },
  { key: 'actions',        visible: true,  width: 56,  pinned: false, order: 99 },
];

function loadPrefs(): GridPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<GridPreferences>;
      const storedCols = parsed.columns ?? [];
      const storedKeys = new Set(storedCols.map((c) => c.key));
      const newDefaults = DEFAULT_COLUMNS.filter((c) => !storedKeys.has(c.key));
      return {
        density: parsed.density ?? 'comfortable',
        savedViews: parsed.savedViews ?? [],
        activeViewId: parsed.activeViewId ?? null,
        columns: [...storedCols, ...newDefaults],
      };
    }
  } catch {
    /* ignore */
  }
  return { columns: DEFAULT_COLUMNS, density: 'comfortable', savedViews: [], activeViewId: null };
}

export function useLeadGridPreferences() {
  const [prefs, setPrefs] = useState<GridPreferences>(loadPrefs);
  // Becomes true after the first backend hydration attempt (success or failure),
  // so we never push a save before we've had a chance to pull.
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  // Cross-device hydration: pull the saved column layout from the backend once
  // on mount. localStorage already gave us an immediate render and remains the
  // offline fallback; backend values win when present. Any failure (offline,
  // migration not applied, older backend) silently keeps the local state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await crmService.gridColumns.get('lead');
        const rp = (remote as { prefs?: Partial<GridPreferences> } | null)?.prefs;
        if (!cancelled && rp && Array.isArray(rp.columns) && rp.columns.length) {
          const keys = new Set(rp.columns.map((c) => c.key));
          const merged = [...rp.columns, ...DEFAULT_COLUMNS.filter((c) => !keys.has(c.key))];
          setPrefs((prev) => ({ ...prev, columns: merged, density: rp.density ?? prev.density }));
        }
      } catch {
        /* keep localStorage-backed state */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced push of the column layout to the backend after user changes, so a
  // burst of resize/reorder events collapses into a single write. Fire-and-forget
  // — a failure never disrupts the UI (localStorage is authoritative locally).
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      crmService.gridColumns
        .save({ columns: prefs.columns, density: prefs.density }, 'lead')
        .catch(() => { /* offline — localStorage keeps the layout */ });
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [prefs.columns, prefs.density, hydrated]);

  const updateColumn = useCallback((key: string, updates: Partial<ColumnPreference>) => {
    setPrefs((prev) => ({
      ...prev,
      columns: prev.columns.map((c) => (c.key === key ? { ...c, ...updates } : c)),
    }));
  }, []);

  const reorderColumns = useCallback((fromKey: string, toKey: string) => {
    setPrefs((prev) => {
      const sorted = [...prev.columns].sort((a, b) => a.order - b.order);
      const fromIdx = sorted.findIndex((c) => c.key === fromKey);
      const toIdx = sorted.findIndex((c) => c.key === toKey);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [moved] = sorted.splice(fromIdx, 1);
      sorted.splice(toIdx, 0, moved);
      return { ...prev, columns: sorted.map((c, i) => ({ ...c, order: i })) };
    });
  }, []);

  const setDensity = useCallback((density: GridDensity) => {
    setPrefs((prev) => ({ ...prev, density }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setPrefs((prev) => ({ ...prev, columns: DEFAULT_COLUMNS, density: 'comfortable' }));
    crmService.gridColumns.reset('lead').catch(() => { /* offline — local reset still applies */ });
  }, []);

  const saveView = useCallback(
    (name: string, filters: Record<string, string>, sorts: SortSpec[]) => {
      const view: SavedView = {
        id: `view_${Date.now()}`,
        name,
        columns: prefs.columns,
        sorts,
        filters,
        density: prefs.density,
      };
      setPrefs((prev) => ({ ...prev, savedViews: [...prev.savedViews, view] }));
      return view;
    },
    [prefs.columns, prefs.density],
  );

  const renameView = useCallback((id: string, name: string) => {
    setPrefs((prev) => ({
      ...prev,
      savedViews: prev.savedViews.map((v) => (v.id === id ? { ...v, name } : v)),
    }));
  }, []);

  const deleteView = useCallback((id: string) => {
    setPrefs((prev) => ({
      ...prev,
      savedViews: prev.savedViews.filter((v) => v.id !== id),
      activeViewId: prev.activeViewId === id ? null : prev.activeViewId,
    }));
  }, []);

  const setActiveView = useCallback((id: string | null) => {
    setPrefs((prev) => ({ ...prev, activeViewId: id }));
  }, []);

  const visibleColumns = useMemo(
    () =>
      prefs.columns
        .filter((c) => c.visible)
        .sort((a, b) => a.order - b.order),
    [prefs.columns],
  );

  return {
    columns: prefs.columns,
    visibleColumns,
    density: prefs.density,
    savedViews: prefs.savedViews,
    activeViewId: prefs.activeViewId,
    updateColumn,
    reorderColumns,
    setDensity,
    resetToDefaults,
    saveView,
    renameView,
    deleteView,
    setActiveView,
  };
}
