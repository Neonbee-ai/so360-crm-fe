/**
 * RE §31 — customizable CRM dashboard. Pure layout rules: which widgets exist,
 * their default order, and how a stored per-user preference is read back.
 *
 * Stored through the existing grid-prefs endpoint (crm_grid_column_prefs,
 * entity_type `crm_dashboard_layout`) as `{ order: string[], hidden: string[] }`.
 */
export const DASHBOARD_WIDGETS = [
    { key: 'kpis', label: 'KPI cards' },
    { key: 'commerce', label: 'Commerce performance' },
    { key: 're_widgets', label: 'Real estate overview' },
    { key: 'reminders', label: 'Active reminders' },
    { key: 'revenue', label: 'Revenue & leaderboard' },
    { key: 'performance', label: 'Performance analytics' },
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number]['key'];

export interface DashboardLayout {
    order: DashboardWidgetKey[];
    hidden: DashboardWidgetKey[];
}

export const DASHBOARD_WIDGET_LABELS: Record<string, string> = Object.fromEntries(
    DASHBOARD_WIDGETS.map((w) => [w.key, w.label]),
);

const KEYS: readonly string[] = DASHBOARD_WIDGETS.map((w) => w.key);
const isKey = (k: unknown): k is DashboardWidgetKey => typeof k === 'string' && KEYS.includes(k);

export const DEFAULT_LAYOUT: DashboardLayout = {
    order: DASHBOARD_WIDGETS.map((w) => w.key),
    hidden: [],
};

/**
 * Reads a stored preference defensively: unknown or repeated keys are dropped,
 * widgets added since the user saved are appended in their default position
 * order, and anything malformed falls back to the default layout.
 */
export function normalizeLayout(raw: unknown): DashboardLayout {
    const src = (raw && typeof raw === 'object' ? raw : {}) as { order?: unknown; hidden?: unknown };
    const stored = Array.isArray(src.order) ? src.order.filter(isKey) : [];
    const order = [...new Set(stored)];
    for (const k of DEFAULT_LAYOUT.order) if (!order.includes(k)) order.push(k);
    const hidden = Array.isArray(src.hidden) ? [...new Set(src.hidden.filter(isKey))] : [];
    return { order, hidden };
}

/** Swaps a widget with its neighbour; a move past either end is a no-op. */
export function moveWidget(layout: DashboardLayout, key: string, direction: 'up' | 'down'): DashboardLayout {
    const idx = layout.order.indexOf(key as DashboardWidgetKey);
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swap < 0 || swap >= layout.order.length) return layout;
    const order = [...layout.order];
    [order[idx], order[swap]] = [order[swap], order[idx]];
    return { ...layout, order };
}

/** Shows a hidden widget or hides a visible one; unknown keys are ignored. */
export function toggleWidget(layout: DashboardLayout, key: string): DashboardLayout {
    if (!isKey(key)) return layout;
    const hidden = layout.hidden.includes(key)
        ? layout.hidden.filter((k) => k !== key)
        : [...layout.hidden, key];
    return { ...layout, hidden };
}

/** The panel's row model: every widget in the user's order with its visibility. */
export function layoutRows(layout: DashboardLayout): Array<{ key: DashboardWidgetKey; visible: boolean }> {
    return layout.order.map((key) => ({ key, visible: !layout.hidden.includes(key) }));
}

/** The keys to render, in order. */
export function visibleWidgets(layout: DashboardLayout): DashboardWidgetKey[] {
    return layout.order.filter((k) => !layout.hidden.includes(k));
}
