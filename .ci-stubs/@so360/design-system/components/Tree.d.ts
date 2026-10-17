import React from 'react';
import { type TreeMove } from '../utils/treeDnd';
export interface TreeNode {
    id: string;
    label: React.ReactNode;
    /** Plain-text name used for aria-label on checkboxes; defaults to label when it is a string. */
    textLabel?: string;
    icon?: React.ReactNode;
    /** Right-aligned secondary text, e.g. a balance. */
    meta?: React.ReactNode;
    disabled?: boolean;
    children?: TreeNode[];
}
export interface TreeProps extends Omit<React.HTMLAttributes<HTMLUListElement>, 'onSelect' | 'onChange' | 'defaultChecked'> {
    nodes: TreeNode[];
    'aria-label': string;
    expanded?: string[];
    defaultExpanded?: string[];
    onExpandedChange?: (ids: string[]) => void;
    selected?: string | null;
    defaultSelected?: string | null;
    onSelect?: (id: string) => void;
    /** Show checkboxes (parents cascade to children, with mixed state). */
    checkable?: boolean;
    checked?: string[];
    defaultChecked?: string[];
    onCheckedChange?: (ids: string[]) => void;
    /**
     * Drag to reorder/reparent (mouse/pen; drop on a row's top/bottom edge = before/after, middle = inside).
     * Keyboard: Alt+Up/Down reorder, Alt+Right nests under the previous sibling, Alt+Left moves out. Esc cancels a drag.
     * The tree does not own `nodes` — apply the move in `onMove` (see `moveTreeNode`).
     */
    reorderable?: boolean;
    onMove?: (move: TreeMove) => void;
    /** Veto a candidate move (e.g. leaves cannot take children). */
    canDrop?: (move: TreeMove) => boolean;
    /** Allow dropping into a node to nest it (default true). */
    allowNesting?: boolean;
}
export declare const Tree: React.FC<TreeProps>;
