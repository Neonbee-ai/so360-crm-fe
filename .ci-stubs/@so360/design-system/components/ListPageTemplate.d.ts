import React from 'react';
import { type CombPageProps } from './usePageComb';
import { MenuItem } from './Menu';
import type { TrailItem } from './PageTrail';
import { type ListFilterConfig, type ListGroupByConfig } from './ListFilters';
export interface ListViewOption {
    /** Consumer-defined id, e.g. 'list' | 'board' | 'calendar' | 'timeline'. */
    value: string;
    /** Accessible name + tooltip (the segment is icon-only when `icon` is set). */
    label: string;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    disabled?: boolean;
}
export interface ListViewSwitcher {
    options: ListViewOption[];
    value: string;
    onChange: (value: string) => void;
    'aria-label'?: string;
}
export interface ListPageTemplateProps extends CombPageProps {
    title: string;
    /** Ancestors of this list (usually omitted on a module root list) (`Root › A`, nearest last); renders `[←] Root › A` above the title. See PageHeader. */
    trail?: TrailItem[];
    description?: string;
    /** Record count chip next to the title. */
    count?: number | string;
    /** The single filled primary action, rightmost in the header. */
    primaryAction?: React.ReactNode;
    /** Up to 2 outlined secondary header buttons, placed before the primary. */
    headerSecondaryActions?: React.ReactNode[];
    /** Legacy name for the overflow "..." menu items. Prefer `overflowActions`. */
    secondaryActions?: MenuItem[];
    /** Overflow "..." menu items (destructive actions belong here). Merged after `secondaryActions`. */
    overflowActions?: MenuItem[];
    /** @deprecated List pages carry no KPI/count rows: put counts on filter options (`FilterFieldOption.count`). Still rendered for legacy pages. */
    kpis?: React.ReactNode;
    /** View switch (e.g. All · Mine · Team · Unassigned), first item of the toolbar. Use a `SegmentedControl` or a Views menu — never a separate tab row. */
    views?: React.ReactNode;
    /** Search input (left of the toolbar). */
    search?: React.ReactNode;
    /** @deprecated Use `filterConfig`. Free-form filter controls (middle of the toolbar). */
    filters?: React.ReactNode;
    /** Typed filters: one filter icon button (drawer, badge = applied count) in the toolbar row. Applied chips render in their own row BELOW the toolbar (only while ≥1 filter is applied; max 6 + a "+N more" chip that opens the drawer). */
    filterConfig?: ListFilterConfig;
    /**
     * Content view switcher (List · Board · Calendar · Timeline …, consumer-supplied): icon `SegmentedControl` at the
     * right of the toolbar, before `toolbarEnd` (§8.2 #7). Hidden when fewer than 2 options. Persisting the choice is the page's job.
     */
    viewSwitcher?: ListViewSwitcher;
    /** Group-by choice surfaced in the Filters drawer (merged into `filterConfig`; renders the filter button even without filter fields). */
    groupBy?: ListGroupByConfig;
    /** View / columns / export controls (right of the toolbar). */
    toolbarEnd?: React.ReactNode;
    /** Legacy free-form toolbar content (rendered after search/filters). */
    toolbar?: React.ReactNode;
    /** Bulk action buttons shown in the toolbar while `selectedCount` > 0. */
    bulkActions?: React.ReactNode;
    /** Number of selected rows; > 0 switches the toolbar to bulk mode. */
    selectedCount?: number;
    onClearSelection?: () => void;
    /** Pagination node, rendered under the content. */
    pagination?: React.ReactNode;
    /** Legacy footer slot (after pagination). */
    footer?: React.ReactNode;
    /** Shows skeleton rows instead of the content. */
    loading?: boolean;
    /** Number of skeleton rows while loading (default 6). */
    loadingRows?: number;
    /** Content for the empty list. Shown instead of children when `isEmpty` (or when provided and `isEmpty` is unset). */
    empty?: React.ReactNode;
    isEmpty?: boolean;
    /** The list is empty because filters exclude everything: shows a "clear filters" empty state. */
    isFilteredEmpty?: boolean;
    onClearFilters?: () => void;
    /** The list / table. */
    children?: React.ReactNode;
    className?: string;
}
/**
 * Standard list page — two rows above the data: header (title · count · ⓘ · actions) and ONE sticky toolbar
 * (views · search · filter button … toolbarEnd; one non-wrapping line). Applied-filter chips (+ Clear all) get a separate wrapping row directly
 * below it, rendered only while a filter is applied (`data-slot="active-filters"`). A legacy `<FilterChips>` passed via `filters` is
 * a popover-trigger bar (its chips are the triggers, not removable applied chips), so it stays in the toolbar row; new pages use `filterConfig`. Then content, pagination (then legacy footer).
 *
 * @example
 * <ListPageTemplate title="Invoices" count={42} primaryAction={<Button>New</Button>}
 *   search={<SearchInput />} filters={<FilterChips ... />} selectedCount={sel.length}
 *   bulkActions={<Button variant="secondary">Archive</Button>} pagination={<Pagination ... />}>
 *   <DataTable ... />
 * </ListPageTemplate>
 */
export declare const ListPageTemplate: React.FC<ListPageTemplateProps>;
