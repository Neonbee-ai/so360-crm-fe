import React from 'react';
import { type MenuItem } from './Menu';
import { type TreeMove } from '../utils/treeDnd';
export interface NavListItem {
    id: string;
    /** Plain text — truncates with a tooltip when it does not fit. */
    label: string;
    /** Leading slot: a number ("1.", "M2"), a <NavListDot>, or a small icon. */
    leading?: React.ReactNode;
    /** Muted trailing count, e.g. open tasks. Hidden while the row's actions are shown. */
    count?: React.ReactNode;
    disabled?: boolean;
    children?: NavListItem[];
}
export type NavListDotTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
/** Status dot for the NavList leading slot. Pass `label` so the status is not conveyed by colour alone. */
export declare const NavListDot: React.FC<{
    tone?: NavListDotTone;
    label?: string;
    className?: string;
}>;
export interface NavListProps {
    items: NavListItem[];
    /** Section header text (e.g. "Phases & Milestones"); also names the list. */
    title?: string;
    /** Header action, e.g. an IconButton to add a top-level item. */
    headerAction?: React.ReactNode;
    /** Required when there is no `title`. */
    'aria-label'?: string;
    selected?: string | null;
    defaultSelected?: string | null;
    onSelect?: (id: string, item: NavListItem) => void;
    expanded?: string[];
    defaultExpanded?: string[];
    onExpandedChange?: (ids: string[]) => void;
    /** Shows a "+" row action; called with the row it was pressed on. */
    onAdd?: (item: NavListItem) => void;
    /** Limit the "+" action to some rows (default: all enabled rows). */
    canAdd?: (item: NavListItem) => boolean;
    /** Accessible name of the "+" action (default "Add to <label>"). */
    addLabel?: (item: NavListItem) => string;
    /** Kebab menu items for a row; return [] for none. */
    menuItems?: (item: NavListItem) => MenuItem[];
    /** Extra trailing actions (rendered before the kebab). Use IconButton size="sm". */
    renderActions?: (item: NavListItem) => React.ReactNode;
    /** Show a drag handle and enable Alt+Arrow keyboard moves. */
    reorderable?: boolean;
    onMove?: (move: TreeMove) => void;
    canDrop?: (move: TreeMove) => boolean;
    /** Allow dropping onto a row to nest under it (default true). */
    allowNesting?: boolean;
    /** Indent per level in px (default 16). */
    indent?: number;
    name?: string;
    className?: string;
    'data-testid'?: string;
}
/**
 * Sidebar navigation list (e.g. a "Phases & Milestones" rail): section header with an action,
 * collapsible hierarchy, leading number/status dot, truncating labels with tooltips, muted counts,
 * row actions revealed on hover/focus (+, drag handle, kebab), selection and roving tabindex.
 * Optional handle-based drag reorder (shares utils/treeDnd with Tree) with Alt+Arrow keyboard moves.
 */
export declare const NavList: React.FC<NavListProps>;
