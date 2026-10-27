import React from 'react';
export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
export interface PopoverProps {
    /** Single element; receives aria-expanded, aria-controls and onClick. */
    trigger: React.ReactElement<Record<string, unknown>>;
    /** Panel content, or a render function receiving `close`. */
    content: React.ReactNode | ((api: {
        close: () => void;
    }) => React.ReactNode);
    placement?: PopoverPlacement;
    name?: string;
    /** Optional controlled state. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /**
     * Render the panel in a portal (PortalProvider container, else document.body) with fixed positioning,
     * flipped/clamped to the viewport, so no ancestor `overflow` (tab rows, cards, tables) can clip it. Default true.
     * `false` keeps the legacy inline absolutely-positioned panel.
     */
    portal?: boolean;
    /** Extra classes for the panel (e.g. a min/max width). */
    panelClassName?: string;
    'data-testid'?: string;
}
/** Viewport position for a portaled panel: requested side, flipped when it does not fit, clamped to the viewport. */
export declare function computePopoverPosition(trigger: {
    top: number;
    bottom: number;
    left: number;
    right: number;
}, panel: {
    width: number;
    height: number;
}, placement: PopoverPlacement, viewport: {
    width: number;
    height: number;
}): {
    top: number;
    left: number;
    side: 'top' | 'bottom';
};
export declare const Popover: React.FC<PopoverProps>;
