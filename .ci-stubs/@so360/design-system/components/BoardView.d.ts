import React from 'react';
import { type MenuItem } from './Menu';
export interface BoardColumn {
    id: string;
    title: string;
    /** Optional aggregate shown under the title (e.g. a formatted currency sum or "32h"). */
    sum?: React.ReactNode;
    /** Work-in-progress limit: the count renders as `n / limit` and turns danger when exceeded. */
    wipLimit?: number;
    /** Cards may not be dropped into this column (still rendered). */
    dropDisabled?: boolean;
}
export interface BoardCardContext {
    columnId: string;
    index: number;
    selected: boolean;
    dragging: boolean;
}
export interface BoardViewProps<T> {
    columns: BoardColumn[];
    /** All items; grouped into columns by `getColumnId`, keeping their given order within a column. */
    items: T[];
    getItemId: (item: T) => string;
    getColumnId: (item: T) => string;
    /** Card body. The board supplies the card chrome (border, focus, selection, drag state). */
    renderCard: (item: T, ctx: BoardCardContext) => React.ReactNode;
    /** Accessible name of a card (move menu, live announcements). Defaults to the item id. */
    getItemLabel?: (item: T) => string;
    /**
     * Controlled move. `index` is the position in the destination column's list AFTER the moved item has been
     * removed from its source (so "move to end of the same column" = column length - 1).
     * Omit to render a read-only board (no drag, no move menu).
     */
    onMove?: (itemId: string, toColumnId: string, index: number) => void;
    /** Veto a move (e.g. workflow rules). Default: allowed unless the target column is `dropDisabled`. */
    canMove?: (item: T, toColumnId: string) => boolean;
    onCardClick?: (item: T) => void;
    /** Items for the column header ⋯ menu. */
    columnMenuItems?: (column: BoardColumn) => MenuItem[];
    /** Custom slot at the end of the column header (before the ⋯ menu), e.g. a "+" quick-add icon button. */
    renderColumnHeaderEnd?: (column: BoardColumn) => React.ReactNode;
    /** Slot under the last card (e.g. an inline "+ Add task"). */
    renderColumnFooter?: (column: BoardColumn) => React.ReactNode;
    /** Empty-column content (default: muted "No items"). */
    emptyColumn?: React.ReactNode | ((column: BoardColumn) => React.ReactNode);
    /** Selection / bulk mode: each card gets a checkbox. Controlled. */
    selectedIds?: ReadonlySet<string>;
    onSelectionChange?: (ids: Set<string>) => void;
    loading?: boolean;
    /** Max height of each column's card list (CSS). Default `calc(100dvh - 16rem)`. */
    columnMaxHeight?: string;
    'aria-label'?: string;
    name?: string;
    'data-testid'?: string;
    className?: string;
}
/**
 * Kanban board (BoardPage floorplan, §7.8): fixed-width columns (288px) in a horizontally scrolling row; header =
 * title · count (· WIP limit) · optional sum · ⋯ menu. Controlled via `onMove(itemId, toColumnId, index)`.
 *
 * Moving cards: pointer drag-and-drop (HTML5), or keyboard on a focused card — Ctrl/Alt+←/→ moves to the
 * adjacent column, Ctrl/Alt+↑/↓ reorders; plain arrows move focus; Enter opens (`onCardClick`). Every card also
 * has a "Move" menu listing the other columns. Moves are announced in a polite live region.
 */
export declare function BoardView<T>(props: BoardViewProps<T>): React.ReactElement;
