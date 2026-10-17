import React from 'react';
import { type MenuItem } from './Menu';
/** Inline cell editing: click (or F2 on a focused row) opens a text input; Enter/blur commits, Esc cancels. */
export interface DataTableEditable<T> {
    /** Text shown in the input (defaults to `row[key]`). */
    getValue?: (row: T) => string;
    /** Called with the trimmed value when it changed and is not empty. */
    onCommit: (row: T, value: string) => void | Promise<void>;
    /** Accessible name of the input, e.g. "Task name" (defaults to the header text). */
    label?: string;
}
export interface DataTableColumn<T> {
    key: string;
    /** Plain text, or a node such as a SortableHeader. */
    header: React.ReactNode;
    /** Defaults to rendering `row[key]` as text. */
    render?: (row: T) => React.ReactNode;
    /** Tailwind width class for the column, e.g. 'w-32'. */
    widthClassName?: string;
    /** Header becomes a sort button (aria-sort). */
    sortable?: boolean;
    /** Cell/header alignment; numeric columns should use 'right'. */
    align?: 'left' | 'right' | 'center';
    /** Value used by the client-side sort fallback (defaults to `row[key]`). */
    sortValue?: (row: T) => string | number | null | undefined;
    /** Column cannot be hidden via ColumnsMenu. */
    alwaysVisible?: boolean;
    /** Hide this column below a window class (M3: compact <600px, medium <840px). Cards view (compact) still lists it. */
    hideBelow?: 'medium' | 'expanded';
    /**
     * Pin the column while the table scrolls horizontally. When no column sets this, the first column stays pinned left
     * (legacy behaviour). Left-pinned columns should lead, right-pinned ones trail.
     */
    sticky?: 'left' | 'right';
    /** Inline text editing for this column. */
    editable?: DataTableEditable<T>;
    /** The cell holds its own controls (Select, Popover…): clicks inside never trigger `onRowClick` or row selection. */
    interactive?: boolean;
}
export type SortDir = 'asc' | 'desc';
/** A row move from drag-and-drop or the keyboard. `toIndex` counts within the destination group (or the flat list). */
export interface DataTableRowMove {
    rowId: string;
    /** Group the row came from (null when the table is not grouped). */
    fromGroupKey: string | null;
    toGroupKey: string | null;
    toIndex: number;
    /** Row keys of the destination group (or the whole list) in their new order — ready for an `onReorder(ids)` API. */
    orderedIds: string[];
}
/** Windowing for long lists. Only the rows in view (plus `overscan`) are mounted. */
export interface DataTableVirtualize {
    /** Fixed row height in px (fastest; skips measuring). */
    rowHeight?: number;
    /** Starting estimate when rows are measured (default 48, or 36 when density is compact). */
    estimateRowHeight?: number;
    /** Rows rendered above and below the viewport (default 8). */
    overscan?: number;
}
export interface DataTableBulkActionsContext {
    selectedKeys: Set<string>;
    count: number;
    clear: () => void;
}
/**
 * Row grouping: collapsible group header rows with label, row count and optional aggregates.
 * Groups keep first-appearance order unless `sortGroups` is given; rows are sorted within each group.
 */
export interface DataTableGroupBy<T> {
    /** Group key for a top-level row (sub-rows stay with their parent). */
    getKey: (row: T) => string;
    /** Header label; defaults to the key. */
    label?: (key: string, rows: T[]) => React.ReactNode;
    /** Summary shown at the end of the group header (e.g. a total). In table view it is replaced by `columnAggregates` when both are set; the card view always uses it. */
    aggregate?: (rows: T[]) => React.ReactNode;
    /** Per-column summaries rendered in that column of the header row (table view), e.g. `{ amount: rows => sum }`. */
    columnAggregates?: Record<string, (rows: T[]) => React.ReactNode>;
    /** Group order comparator (by key). */
    sortGroups?: (a: string, b: string) => number;
    /** Controlled collapsed group keys. */
    collapsedKeys?: ReadonlySet<string>;
    /** Initially collapsed group keys when uncontrolled. */
    defaultCollapsedKeys?: Iterable<string>;
    onCollapsedChange?: (keys: Set<string>) => void;
    /** Extra row under each expanded group (e.g. a subtotal or a link). */
    renderFooter?: (key: string, rows: T[]) => React.ReactNode;
    /** Per-group inline add row ("Add a task…"): Enter submits the trimmed text for that group, Esc clears. */
    onInlineAdd?: (key: string, value: string) => void | Promise<void>;
    /** Placeholder / accessible name for the per-group add input (default "Add item"). */
    inlineAddPlaceholder?: string;
}
export type DataTableDensity = 'comfortable' | 'compact';
export interface DataTableProps<T> {
    /**
     * UX guide caps default views at 7 columns — more than that belongs behind
     * a detail drawer, not in the grid. Enforced in dev via console.warn
     * rather than a throw so a violation degrades instead of crashing.
     */
    columns: DataTableColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    loading?: boolean;
    /** Rendered when rows is empty and not loading. */
    emptyState?: React.ReactNode;
    /** Plain row click. With selection on, Cmd/Ctrl+click toggles and Shift+click range-selects instead. */
    onRowClick?: (row: T) => void;
    /** Number of skeleton rows while loading. */
    skeletonRows?: number;
    /**
     * Row selection (bulk approve / bulk edit). Controlled: pass the selected
     * row keys and receive the next set. Omit both to render no checkbox column.
     * Shift+click a checkbox selects (or clears) the range from the last toggled row.
     */
    selectedKeys?: ReadonlySet<string>;
    /** Alias of `selectedKeys`. */
    selectedRowIds?: ReadonlySet<string>;
    onSelectionChange?: (keys: Set<string>) => void;
    /** Rows that may not be selected (e.g. already approved). */
    isRowSelectable?: (row: T) => boolean;
    /** Bulk-action bar shown above the table while rows are selected ("3 selected · Clear · your actions"). */
    bulkActions?: (ctx: DataTableBulkActionsContext) => React.ReactNode;
    /** Controlled sort. When `onSortChange` is omitted, DataTable sorts rows client-side. */
    sortKey?: string | null;
    sortDir?: SortDir;
    onSortChange?: (key: string, dir: SortDir) => void;
    /** Kebab column (P3 row actions). Clicking it never triggers `onRowClick`. */
    rowActions?: (row: T) => MenuItem[];
    /**
     * Frequent row actions shown inline as icon buttons (each needs an `icon`; `label` becomes aria-label + tooltip).
     * On hover-capable devices they appear on row hover/focus; on touch they are always visible. Rendered in the same
     * non-wrapping actions column as the `rowActions` kebab (put rarer actions there).
     */
    rowInlineActions?: (row: T) => MenuItem[];
    /** Pin the actions column to the right edge while scrolling horizontally. */
    stickyActions?: boolean;
    /** Header stays visible while the body scrolls (default true). */
    stickyHeader?: boolean;
    /** Max height of the scroll area (CSS value) so the sticky header has something to stick to. Default `calc(100dvh - 14rem)`. */
    maxHeight?: string;
    /** On compact windows (<600px): 'cards' renders a card list (default), 'scroll' keeps the horizontally scrolling table. */
    compactLayout?: 'cards' | 'scroll';
    density?: DataTableDensity;
    /** Totals row rendered in a `<tfoot>` spanning all columns. */
    footer?: React.ReactNode;
    /** Column keys to hide (controlled by the page, see ColumnsMenu). */
    hiddenColumns?: ReadonlySet<string> | string[];
    onHiddenColumnsChange?: (hidden: Set<string>) => void;
    /** Extra props per row (data-testid, className...). */
    getRowProps?: (row: T) => {
        className?: string;
        'data-testid'?: string;
    } & Record<string, unknown>;
    /**
     * Tree rows: return a row's children to make it expandable (chevron toggle + indent in the first column).
     * Children follow the same client-side sort. Select-all covers top-level `rows` only.
     */
    getSubRows?: (row: T) => T[] | undefined;
    /** Controlled expanded row keys (tree rows). */
    expandedKeys?: ReadonlySet<string>;
    /** Initially expanded row keys when uncontrolled. */
    defaultExpandedKeys?: Iterable<string>;
    onExpandedChange?: (keys: Set<string>) => void;
    /**
     * Inline-create row at the bottom ("+ Add item"): Enter submits the trimmed text, Esc clears.
     * The input stays disabled while a returned promise is pending; it is cleared on success and kept on rejection.
     * When set, an empty table renders its header + this row instead of `emptyState`.
     */
    onInlineCreate?: (value: string) => void | Promise<void>;
    inlineCreatePlaceholder?: string;
    /**
     * Group rows under collapsible header rows (label · count · aggregate). Pass a key function or a
     * full `DataTableGroupBy` config. Works with sorting (within groups), selection (group checkbox),
     * tree rows, inline actions and the narrow-screen card view.
     */
    groupBy?: ((row: T) => string) | DataTableGroupBy<T>;
    /**
     * Drag-and-drop row reorder through a grip handle column (pointer, touch via the handle, and keyboard:
     * Alt+Up/Down on a row or handle, or Space on the handle then arrows). With `groupBy`, rows move between
     * groups and dropping on a group header appends to it. Disabled while a sort is active; sub-rows don't move.
     */
    reorderable?: boolean;
    onRowMove?: (move: DataTableRowMove) => void;
    /** Veto a move before it is shown/committed. */
    canDrop?: (move: DataTableRowMove) => boolean;
    /** Plain-text row name for announcements and handle labels (defaults to the first column's value). */
    getRowLabel?: (row: T) => string;
    /** Window long lists (in-house, no dependency). Works with `groupBy`, sticky columns and reorder. */
    virtualize?: boolean | DataTableVirtualize;
    /**
     * Roving-focus row navigation: Up/Down/Home/End move, Shift+Up/Down extend the selection, Space toggles it,
     * Enter opens (`onRowClick`), F2 edits the first editable cell, Alt+Up/Down reorders. Default: on when `reorderable`.
     */
    keyboardNavigation?: boolean;
    name?: string;
    'data-testid'?: string;
}
/** Toolbar-end menu to show/hide DataTable columns. */
export interface ColumnsMenuProps {
    columns: {
        key: string;
        header: React.ReactNode;
        alwaysVisible?: boolean;
    }[];
    hidden: ReadonlySet<string> | string[];
    onChange: (hidden: Set<string>) => void;
    label?: string;
}
export declare const ColumnsMenu: React.FC<ColumnsMenuProps>;
/**
 * Standard master-data table — replaces the hand-rolled slate `<table>` blocks
 * copy-pasted across module list pages. Deliberately minimal: sorting, paging
 * and filtering compose from SortableHeader / Pagination / FilterBar rather
 * than being baked in.
 */
export declare function DataTable<T>(props: DataTableProps<T>): React.ReactElement;
