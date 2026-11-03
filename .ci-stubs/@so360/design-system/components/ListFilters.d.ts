import React from 'react';
import { type DateRange } from './DateRangePicker';
export interface NumberRange {
    min: number | null;
    max: number | null;
}
export type FilterValue = string | number | boolean | string[] | DateRange | NumberRange | null | undefined;
export type FilterValues = Record<string, FilterValue>;
export type FilterFieldType = 'select' | 'multiselect' | 'text' | 'date' | 'daterange' | 'numberrange' | 'boolean' | 'person' | 'custom';
export interface FilterFieldOption {
    value: string;
    label: string;
    /** Record count shown next to the option in the drawer, e.g. "New (126)" — replaces status count tabs/KPI rows. */
    count?: number;
}
export interface FilterField {
    key: string;
    label: string;
    type: FilterFieldType;
    options?: FilterFieldOption[];
    /** @deprecated Ignored — every field lives in the Filters drawer; the toolbar shows one filter icon button. */
    quick?: boolean;
    /** Required for `custom`. */
    render?: (value: FilterValue, setValue: (next: FilterValue) => void) => React.ReactNode;
    /** `person` only: org used to load people. */
    orgId?: string;
    /** Chip text for `custom` / `person` values. */
    formatValue?: (value: FilterValue) => string;
}
export interface ListGroupByOption {
    value: string;
    label: string;
}
/** "Group by" choice shown at the bottom of the Filters drawer (committed with Apply; not a filter, so no chip). */
export interface ListGroupByConfig {
    options: ListGroupByOption[];
    /** Current grouping; null/undefined/'' = no grouping. */
    value?: string | null;
    onChange: (value: string | null) => void;
    /** Field label (default "Group by"). */
    label?: string;
    /** Label of the no-grouping option (default "None"). */
    noneLabel?: string;
}
export interface ListFilterConfig {
    fields: FilterField[];
    values: FilterValues;
    onChange: (values: FilterValues) => void;
    onClear: () => void;
    /** Optional grouping control rendered in the drawer below the filters. */
    groupBy?: ListGroupByConfig;
}
/** @deprecated Inline quick filters were removed; kept for back-compat. */
export declare const MAX_QUICK_FILTERS = 0;
export declare function isFilterActive(v: FilterValue): boolean;
export declare function formatFilterValue(field: FilterField, v: FilterValue): string;
export interface ListFiltersProps extends ListFilterConfig {
    /** `toolbar` = filter icon button + drawer; `chips` = applied-chip row; `all` = both (default). */
    part?: 'toolbar' | 'chips' | 'all';
    /** Controlled drawer state, so the chips row ("+N more") can open the drawer owned by the toolbar button. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** Max chips shown before collapsing the rest into a "+N more" chip that opens the drawer (default 6). */
    maxChips?: number;
    className?: string;
}
export declare const MAX_VISIBLE_CHIPS = 6;
/**
 * Standard list filter UI: ONE filter icon button (badge = number of applied filters) opening a drawer with every
 * field (draft; Apply commits, Clear resets), and an applied-chip row ("Label: value ✕" + Clear all) shown only
 * while a filter is set. No inline filter controls in the toolbar.
 */
export declare const ListFilters: React.FC<ListFiltersProps>;
