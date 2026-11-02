import React from 'react';
export interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    /** Optional line under the title. */
    subtitle?: string;
    /**
     * Edge the panel slides from. `right` (default) is the platform create/edit
     * surface; `left` suits navigation/filter rails; `bottom` is a sheet
     * (mobile actions, quick pickers, previews of wide content).
     */
    side?: DrawerSide;
    /**
     * Size preset. Width for `left`/`right`: sm=400, md=560, lg=720 (legacy),
     * form=480 and preview=640 (Comb §8.7), xl=960, full=100%.
     * Height for `bottom`: sm=40%, form/md=60%, preview/lg=80%, xl=90%, full=100%.
     * Every side is full width on compact windows.
     */
    size?: DrawerSize;
    /** Pinned action bar at the bottom of the panel. */
    footer?: React.ReactNode;
    /**
     * Back affordance in the header. The platform UX rule is drawer-first with
     * NO stacked surfaces: a flow that needs a second screen replaces the
     * drawer's content and offers this to return, it never opens a second
     * drawer or a modal on top.
     */
    onBack?: () => void;
    /** Non-scrolling strip between header and body, e.g. a section nav. */
    toolbar?: React.ReactNode;
    /** Ref to the scrolling body, for scroll-spy / "more below" hints. */
    bodyRef?: React.Ref<HTMLDivElement>;
    onBodyScroll?: React.UIEventHandler<HTMLDivElement>;
    name?: string;
    'data-testid'?: string;
    children: React.ReactNode;
}
export type DrawerSide = 'left' | 'right' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'form' | 'preview' | 'xl' | 'full';
/** Panel classes for a side + size; exported for specs and custom surfaces. */
export declare function drawerPanelClass(side?: DrawerSide, size?: DrawerSize): string;
/**
 * Slide-over panel — the platform's primary create/edit surface (UX guide:
 * drawer-first navigation; never stack modal-on-modal). Right edge by default;
 * `side="left"` or `side="bottom"` for rails and sheets.
 */
export declare const Drawer: React.FC<DrawerProps>;
