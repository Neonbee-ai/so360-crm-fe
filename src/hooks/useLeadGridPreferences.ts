import { useState, useEffect, useCallback } from 'react';

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
  { key: 'tags',       visible: false, width: 200, pinned: false, order: 18 },
  { key: 'actions',    visible: true,  width: 56,  pinned: false, order: 99 },
];

function loadPrefs(): GridPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as GridPreferences;
      const storedKeys = new Set((parsed.columns || []).map((c) => c.key));
      const newDefaults = DEFAULT_COLUMNS.filter((c) => !storedKeys.has(c.key));
      return {
        density: 'comfortable',
        savedViews: [],
        activeViewId: null,
        ...parsed,
        columns: [...(parsed.columns || DEFAULT_COLUMNS), ...newDefaults],
      };
    }
  } catch {
    /* ignore */
  }
  return { columns: DEFAULT_COLUMNS, density: 'comfortable', savedViews: [], activeViewId: null };
}

export function useLeadGridPreferences() {
  const [prefs, setPrefs] = useState<GridPreferences>(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

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
