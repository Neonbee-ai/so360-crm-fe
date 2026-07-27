import { useState, useEffect, useCallback, useRef } from 'react';
import { crmService } from '../services/crmService';

export interface LayoutSectionPref {
    key: string;
    visible: boolean;
    collapsed: boolean;
    order: number;
}

const STORAGE_KEY = 'crm_lead_detail_layout_prefs_v1';
const ENTITY_TYPE = 'lead_detail_layout';

export const DEFAULT_SECTIONS: LayoutSectionPref[] = [
    { key: 'activity', visible: true, collapsed: false, order: 0 },
    { key: 'notes', visible: true, collapsed: false, order: 1 },
    { key: 'tasks', visible: true, collapsed: false, order: 2 },
    { key: 'documents', visible: true, collapsed: false, order: 3 },
    { key: 'products', visible: true, collapsed: false, order: 4 },
    { key: 'feedback', visible: true, collapsed: false, order: 5 },
    { key: 'calls', visible: true, collapsed: false, order: 6 },
    { key: 'audit', visible: true, collapsed: false, order: 7 },
    { key: 'stakeholders', visible: true, collapsed: false, order: 8 },
    { key: 'emails', visible: true, collapsed: false, order: 9 },
    { key: 'meetings', visible: true, collapsed: false, order: 10 },
];

function loadSections(): LayoutSectionPref[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as { sections?: LayoutSectionPref[] };
            const storedSections = parsed.sections ?? [];
            const storedKeys = new Set(storedSections.map((s) => s.key));
            const newDefaults = DEFAULT_SECTIONS.filter((s) => !storedKeys.has(s.key));
            return [...storedSections, ...newDefaults];
        }
    } catch {
        /* ignore */
    }
    return DEFAULT_SECTIONS;
}

/**
 * Task 5 (Customizable Lead Detail Layout, Phase-1-lite) — reorder (up/down),
 * show/hide, collapse/expand, persisted per user. Structurally copied from
 * useLeadGridPreferences.ts (localStorage-first, 800ms debounced background
 * sync, cross-device hydration, silent fail-open) rather than written from
 * scratch, reusing the SAME crm_grid_column_prefs table/endpoint via a new
 * entity_type value — no new backend table for the personal-override path.
 */
export function useLeadDetailLayoutPreferences() {
    const [sections, setSections] = useState<LayoutSectionPref[]>(loadSections);
    const [hydrated, setHydrated] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections }));
        } catch {
            /* ignore */
        }
    }, [sections]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const remote = await crmService.gridColumns.get(ENTITY_TYPE);
                const rp = (remote as { prefs?: { sections?: LayoutSectionPref[] } } | null)?.prefs;
                if (!cancelled && rp?.sections && Array.isArray(rp.sections) && rp.sections.length) {
                    const keys = new Set(rp.sections.map((s) => s.key));
                    const merged = [...rp.sections, ...DEFAULT_SECTIONS.filter((s) => !keys.has(s.key))];
                    setSections(merged);
                }
            } catch {
                /* keep localStorage-backed state (or role/hardcoded default) */
            } finally {
                if (!cancelled) setHydrated(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            crmService.gridColumns.save({ sections }, ENTITY_TYPE).catch(() => { /* offline */ });
        }, 800);
        return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    }, [sections, hydrated]);

    const toggleVisible = useCallback((key: string) => {
        setSections((prev) => prev.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)));
    }, []);

    const toggleCollapsed = useCallback((key: string) => {
        setSections((prev) => prev.map((s) => (s.key === key ? { ...s, collapsed: !s.collapsed } : s)));
    }, []);

    const moveSection = useCallback((key: string, direction: 'up' | 'down') => {
        setSections((prev) => {
            const sorted = [...prev].sort((a, b) => a.order - b.order);
            const idx = sorted.findIndex((s) => s.key === key);
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return prev;
            [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
            return sorted.map((s, i) => ({ ...s, order: i }));
        });
    }, []);

    const resetToDefaults = useCallback(() => {
        setSections(DEFAULT_SECTIONS);
        crmService.gridColumns.reset(ENTITY_TYPE).catch(() => { /* offline — local reset still applies */ });
    }, []);

    const visibleSections = [...sections].filter((s) => s.visible).sort((a, b) => a.order - b.order);
    const allSectionsOrdered = [...sections].sort((a, b) => a.order - b.order);

    return { sections: allSectionsOrdered, visibleSections, toggleVisible, toggleCollapsed, moveSection, resetToDefaults };
}
