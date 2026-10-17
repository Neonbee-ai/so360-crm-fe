import { type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
/**
 * Shared drag-and-drop logic for hierarchical lists (Tree, NavList). No dependencies:
 * native pointer events for mouse/pen (touch via an explicit drag handle with `touch-action: none`)
 * plus a keyboard alternative (Alt + Arrow keys).
 */
export interface DndNode {
    id: string;
    children?: DndNode[];
}
export type DropPosition = 'before' | 'after' | 'inside';
/** A resolved move: `id` becomes child #`index` of `parentId` (null = root), counted after removing it. */
export interface TreeMove {
    id: string;
    parentId: string | null;
    index: number;
    /** The row it was dropped on and where, as shown by the indicator. */
    targetId: string;
    position: DropPosition;
}
export type KeyboardMoveDirection = 'up' | 'down' | 'indent' | 'outdent';
interface Loc {
    parentId: string | null;
    index: number;
    siblings: DndNode[];
    node: DndNode;
}
export declare function locateNode(nodes: DndNode[], id: string, parentId?: string | null): Loc | null;
/** True when `id` is `ancestorId` itself or sits anywhere below it. */
export declare function isSelfOrDescendant(nodes: DndNode[], ancestorId: string, id: string): boolean;
/** Turn "drop `dragId` before/after/inside `targetId`" into a move; null when invalid or a no-op. */
export declare function resolveMove(nodes: DndNode[], dragId: string, targetId: string, position: DropPosition): TreeMove | null;
/** Keyboard alternative: Alt+Up/Down reorder among siblings, Alt+Right nests under the previous sibling, Alt+Left moves out after the parent. */
export declare function keyboardMove(nodes: DndNode[], id: string, dir: KeyboardMoveDirection): TreeMove | null;
/** Immutable helper to apply a `TreeMove` to your data: `setNodes((n) => moveTreeNode(n, move))`. */
export declare function moveTreeNode<N extends {
    id: string;
    children?: N[];
}>(nodes: N[], move: Pick<TreeMove, 'id' | 'parentId' | 'index'>): N[];
/** Map a pointer Y within a row to a drop position (top/bottom quarter = before/after, middle = inside). */
export declare function positionFromPoint(y: number, rect: {
    top: number;
    height: number;
}, allowInside: boolean): DropPosition;
export interface UseTreeDndOptions {
    nodes: DndNode[];
    enabled: boolean;
    rootRef: RefObject<HTMLElement | null>;
    onMove?: (move: TreeMove) => void;
    canDrop?: (move: TreeMove) => boolean;
    /** Allow dropping onto a row to nest under it (default true). */
    allowInside?: boolean;
    /** Plain-text name for announcements. */
    nameOf?: (id: string) => string;
    /**
     * Custom drop position for a hovered target (e.g. group headers always 'inside', rows before/after).
     * Return null to reject the target. Defaults to `positionFromPoint(y, rect, allowInside)`.
     */
    positionFor?: (targetId: string, y: number, rect: {
        top: number;
        height: number;
    }) => DropPosition | null;
    /** Custom live-region text for a committed move. */
    describeMove?: (move: TreeMove) => string;
}
export interface TreeDndState {
    dragId: string | null;
    drop: {
        targetId: string;
        position: DropPosition;
    } | null;
    announcement: string;
    /** Spread on a row (or a drag handle with `handleOnly`) — `data-dnd-id` must be on the row element. */
    startDrag: (id: string, e: ReactPointerEvent<HTMLElement>, opts?: {
        handle?: boolean;
    }) => void;
    /** Run a keyboard move; returns the move when one happened. */
    keyMove: (id: string, dir: KeyboardMoveDirection) => TreeMove | null;
    /** Validate (canDrop), commit (onMove) and announce a move computed by the caller; returns it when applied. */
    applyMove: (move: TreeMove | null) => TreeMove | null;
    /** Write a message to the live region (e.g. "Picked up …"). */
    announce: (message: string) => void;
}
export declare function useTreeDnd({ nodes, enabled, rootRef, onMove, canDrop, allowInside, nameOf, positionFor, describeMove, }: UseTreeDndOptions): TreeDndState;
/** Classes for the drop indicator line/box. Render inside a `relative` row. */
export declare function dropIndicatorClass(position: DropPosition): string;
/** Map Alt+Arrow to a keyboard move direction. */
export declare function moveDirFromKey(e: {
    key: string;
    altKey: boolean;
}): KeyboardMoveDirection | null;
export {};
