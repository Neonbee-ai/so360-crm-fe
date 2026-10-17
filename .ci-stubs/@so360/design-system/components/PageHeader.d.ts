import React from 'react';
import { MenuItem } from './Menu';
import { type OverflowToolbarItem } from './OverflowToolbar';
import { type TrailItem } from './PageTrail';
/** One entry of the quiet meta row under the title (deadline, owner avatars, tags…). */
export interface PageHeaderMetaItem {
    id: string;
    /** Optional leading icon (16px, muted). */
    icon?: React.ReactNode;
    /** Optional quiet label before the value, e.g. "Due". */
    label?: string;
    /** The value: text, an AvatarGroup, Badges… */
    content: React.ReactNode;
}
/**
 * A header action that collapses into the "More" menu as the header narrows. `node` renders inline,
 * `menuItem` is how it appears once collapsed. Lower `priority` collapses first.
 */
export type PageHeaderAction = OverflowToolbarItem & {
    menuItem: MenuItem;
};
/** @deprecated Use `TrailItem` with `trail` (current page = title, not a crumb). */
export interface Breadcrumb {
    label: string;
    href?: string;
    onClick?: () => void;
}
export interface PageHeaderProps {
    title: string;
    description?: string;
    /** `tooltip` shows the description as an ⓘ next to the title instead of a line under it (list pages). */
    descriptionAs?: 'text' | 'tooltip';
    /**
     * Ancestors of this page (`Root › A › B`, nearest last) in one row above the title, with a `←` that goes to
     * the last item. The current page is the title — do not repeat it. `[]` = directly under the CombScope root.
     */
    trail?: TrailItem[];
    /** @deprecated Use `trail`. Legacy crumbs: the last item renders as the current page. */
    breadcrumbs?: Breadcrumb[];
    /** Legacy free-form actions slot (rendered right, before the new action props). Prefer the props below. */
    actions?: React.ReactNode;
    /** @deprecated Use `trail` (back then goes to the last trail item). Still renders the same `←` back action. */
    onBack?: () => void;
    /** @deprecated Accessible name for the legacy `onBack` action. */
    backLabel?: string;
    /** Record count chip after the title. */
    count?: number | string;
    /** Status badge after the title. */
    status?: React.ReactNode;
    /** Line under the title (e.g. owner, updated-at). */
    meta?: React.ReactNode;
    /**
     * Structured single meta row under the title: quiet `nb-sm` muted items separated by `·`, wrapping on
     * narrow widths. Comb §8.1 recommends ≤ 3 items.
     */
    metaItems?: PageHeaderMetaItem[];
    /**
     * Responsive secondary actions. Rendered inline while they fit and collapsed (lowest priority first)
     * into one "More" menu that also holds `overflowActions`; the primary stays rightmost. When set,
     * it replaces `secondaryActions`.
     */
    collapsibleActions?: PageHeaderAction[];
    /** The single filled primary action; always rightmost. */
    primaryAction?: React.ReactNode;
    /** Up to 2 outlined secondary actions, placed before the primary (extras are dropped; use overflowActions). */
    secondaryActions?: React.ReactNode[];
    /** Everything else, including destructive actions, in a "..." menu. */
    overflowActions?: MenuItem[];
    /** Right-slot filters (dashboards), left of the actions. */
    filters?: React.ReactNode;
    className?: string;
    'data-testid'?: string;
}
/** "..." overflow menu used by page headers. */
export declare const OverflowMenu: React.FC<{
    items: MenuItem[];
}>;
/**
 * The quiet meta row: `[icon] Label value · [icon] value · …`. Exported for custom headers.
 * Wrapping: every separator sits in a fixed 16px lead (dot + gap) and the list is shifted left by that
 * amount inside a clipping wrapper, so an item that wraps to a new line never starts with a stray "·".
 */
export declare const PageHeaderMeta: React.FC<{
    items: PageHeaderMetaItem[];
    className?: string;
}>;
/**
 * Page header. Trail row (`[←] Root › A`) above; left: title, count/status, then description/meta. Right: filters, legacy `actions`,
 * up to 2 secondaries, overflow "...", then the one primary (rightmost).
 *
 * @example
 * <PageHeader title="Invoices" count={42} primaryAction={<Button>New invoice</Button>}
 *   secondaryActions={[<Button variant="secondary">Import</Button>]}
 *   overflowActions={[{ label: 'Delete all', danger: true, onSelect }]} />
 */
export declare const PageHeader: React.FC<PageHeaderProps>;
