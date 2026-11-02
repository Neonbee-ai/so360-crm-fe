import React from 'react';
export interface PortalProviderProps {
    /** Element that DS overlays (Modal, Toast, CommandPalette...) portal into. */
    container: HTMLElement | null;
    children?: React.ReactNode;
}
/** Lets scoped-CSS hosts route DS overlays into their own root instead of document.body. */
export declare const PortalProvider: React.FC<PortalProviderProps>;
/** Container for overlays. Defaults to document.body (null during SSR). */
export declare function usePortalContainer(): HTMLElement | null;
/**
 * For overlays that historically rendered inline (Drawer, DeleteConfirmDialog):
 * portal only when a provider supplies a container, otherwise return the node unchanged.
 */
export declare function useOptionalPortal(): (node: React.ReactElement) => React.ReactElement;
