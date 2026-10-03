import { useCallback, useEffect, useRef, useState } from 'react';
import { crmService } from '../services/crmService';
import {
    DashboardLayout,
    DEFAULT_LAYOUT,
    moveWidget,
    normalizeLayout,
    toggleWidget,
} from '../utils/dashboardLayout';

export const DASHBOARD_LAYOUT_ENTITY = 'crm_dashboard_layout';
export const DASHBOARD_LAYOUT_SAVE_DELAY_MS = 600;

/**
 * RE §31 — the signed-in user's CRM dashboard layout (widget order + hidden
 * widgets). Reuses the per-user grid-prefs store (crm_grid_column_prefs via
 * crmService.gridColumns) under entity_type `crm_dashboard_layout`, the same
 * way useLeadDetailLayoutPreferences stores the lead-detail layout — no new
 * table or endpoint.
 *
 * - `enabled=false` (flag off): nothing is fetched or saved; the default layout
 *   is returned, so the dashboard looks exactly as before.
 * - A save is only sent after the user changes something (never on load), and
 *   a pending save is flushed on unmount.
 * - Late hydration never overrides a change the user already made.
 * - Every store call fails open: the dashboard never breaks on a prefs error.
 */
export function useDashboardLayout(enabled: boolean) {
    const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
    const touched = useRef(false);
    const pending = useRef<DashboardLayout | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flush = useCallback(async () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        const prefs = pending.current;
        pending.current = null;
        if (!prefs) return;
        try {
            await crmService.gridColumns.save({ order: prefs.order, hidden: prefs.hidden }, DASHBOARD_LAYOUT_ENTITY);
        } catch {
            /* offline — the layout still applies for this session */
        }
    }, []);

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const remote = await crmService.gridColumns.get(DASHBOARD_LAYOUT_ENTITY);
                const prefs = (remote as { prefs?: unknown } | null)?.prefs;
                if (!cancelled && !touched.current && prefs) setLayout(normalizeLayout(prefs));
            } catch {
                /* keep the default layout */
            }
        })();
        return () => { cancelled = true; };
    }, [enabled]);

    useEffect(() => () => { void flush(); }, [flush]);

    const apply = useCallback((next: (prev: DashboardLayout) => DashboardLayout) => {
        touched.current = true;
        setLayout((prev) => {
            const updated = next(prev);
            if (updated !== prev) {
                pending.current = updated;
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => { void flush(); }, DASHBOARD_LAYOUT_SAVE_DELAY_MS);
            }
            return updated;
        });
    }, [flush]);

    const move = useCallback((key: string, direction: 'up' | 'down') => {
        apply((prev) => moveWidget(prev, key, direction));
    }, [apply]);

    const toggle = useCallback((key: string) => {
        apply((prev) => toggleWidget(prev, key));
    }, [apply]);

    const reset = useCallback(async () => {
        touched.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        pending.current = null;
        setLayout(DEFAULT_LAYOUT);
        try {
            await crmService.gridColumns.reset(DASHBOARD_LAYOUT_ENTITY);
        } catch {
            /* offline — the local reset still applies */
        }
    }, []);

    return { layout: enabled ? layout : DEFAULT_LAYOUT, move, toggle, reset };
}
