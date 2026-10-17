import React from 'react';
export interface TabItem {
    id: string;
    label: string;
    /** Optional leading icon. */
    icon?: React.ReactNode;
    /** Small muted chip after the label (e.g. a count). */
    badge?: React.ReactNode;
    /** Alias of `badge` for numeric counts; `badge` wins if both are set. */
    count?: number;
    disabled?: boolean;
}
export interface TabsProps {
    items: TabItem[];
    /** Controlled active tab id. */
    value?: string;
    /** Uncontrolled initial tab id (defaults to first enabled). */
    defaultValue?: string;
    onChange?: (id: string) => void;
    /** Render the content of the active panel. */
    children?: (id: string) => React.ReactNode;
    /** Accessible name for the tablist and testid suffix. */
    name?: string;
    /** Right-aligned slot inside the tablist row (e.g. card actions). */
    end?: React.ReactNode;
    /**
     * 'underline' (default) — page/card tabs. 'pill' — compact in-toolbar tabs: one track with a selected thumb
     * (same look as SegmentedControl, but keeps tab/tabpanel semantics).
     */
    variant?: 'underline' | 'pill';
    /**
     * Show at most this many tabs; the rest go into a "More ▾" menu (portaled, never clipped by the tab row).
     * The active tab is always kept visible (it takes the last visible slot).
     */
    maxVisible?: number;
    /** Label of the overflow trigger (default "More"). */
    moreLabel?: string;
    className?: string;
    'data-testid'?: string;
}
export declare const Tabs: React.FC<TabsProps>;
