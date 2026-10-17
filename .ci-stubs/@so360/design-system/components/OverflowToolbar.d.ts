import React from 'react';
import { type MenuItem } from './Menu';
export interface OverflowToolbarItem {
    id: string;
    /** What renders inline (a Button, FilterChips, a SegmentedControl…). */
    node: React.ReactNode;
    /** How the item appears inside "More" once collapsed. Items without one never collapse (treated as pinned). */
    menuItem?: MenuItem;
    /** Lower collapses first. Default 0; ties collapse right-to-left. */
    priority?: number;
    /** Never collapses. */
    pinned?: boolean;
}
export interface OverflowToolbarProps {
    items: OverflowToolbarItem[];
    'aria-label': string;
    /** Accessible label of the overflow trigger. Default "More actions". */
    moreLabel?: string;
    /**
     * Items that always live in "More" (e.g. a page header's overflow actions), listed after any collapsed
     * items. When non-empty the "More" trigger is always shown.
     */
    extraMenuItems?: MenuItem[];
    /** Align items to the end of the row (e.g. a toolbar-end slot). */
    align?: 'start' | 'end';
    className?: string;
    'data-testid'?: string;
}
/**
 * Pure: which item ids to collapse so the row fits `available` px.
 * Collapses the lowest-priority collapsible items first (ties: right-most first) and reserves room for "More".
 */
export declare function computeOverflow(items: Pick<OverflowToolbarItem, 'id' | 'priority' | 'pinned' | 'menuItem'>[], widths: Record<string, number>, available: number, moreWidth?: number): string[];
/**
 * A toolbar row that never overflows: measures its items and moves the lowest-priority ones into a portaled
 * "More" menu as the row narrows. Use for secondary list/page actions next to a search field.
 */
export declare const OverflowToolbar: React.FC<OverflowToolbarProps>;
