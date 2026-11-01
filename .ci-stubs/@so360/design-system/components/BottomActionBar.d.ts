import React from 'react';
export interface BottomActionBarProps {
    /** Primary action(s), right-aligned (e.g. <Button>Approve</Button>). */
    primary?: React.ReactNode;
    /** Secondary actions, left of the primary (e.g. Reject / overflow Menu). */
    secondary?: React.ReactNode;
    /** Optional leading summary (e.g. "3 selected" or a total). */
    summary?: React.ReactNode;
    /**
     * Window class from which the bar is hidden (actions then live in the page header).
     * 'medium' (default) = compact phones only (<600px); 'expanded' = up to 840px; 'never' = always shown.
     */
    hideFrom?: 'medium' | 'expanded' | 'never';
    /** Render a spacer of the bar's height so page content is never covered (default true). */
    reserveSpace?: boolean;
    'aria-label'?: string;
    name?: string;
    'data-testid'?: string;
    className?: string;
}
/**
 * Sticky bottom action bar for compact windows (thumb-reach primary actions on detail / review pages).
 * Form pages already get a sticky footer from FormPageTemplate; use this on ObjectPage-style screens.
 * Fixed to the viewport bottom with safe-area padding; hidden from `hideFrom` up.
 */
export declare const BottomActionBar: React.FC<BottomActionBarProps>;
