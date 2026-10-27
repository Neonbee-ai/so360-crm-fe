import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

const PortalContext = createContext<HTMLElement | null>(null);

export interface PortalProviderProps {
    /** Element that DS overlays (Modal, Toast, CommandPalette...) portal into. */
    container: HTMLElement | null;
    children?: React.ReactNode;
}

/** Lets scoped-CSS hosts route DS overlays into their own root instead of document.body. */
export const PortalProvider: React.FC<PortalProviderProps> = ({ container, children }) => (
    <PortalContext.Provider value={container}>{children}</PortalContext.Provider>
);

/** Container for overlays. Defaults to document.body (null during SSR). */
export function usePortalContainer(): HTMLElement | null {
    const ctx = useContext(PortalContext);
    if (ctx) return ctx;
    return typeof document !== 'undefined' ? document.body : null;
}

/**
 * For overlays that historically rendered inline (Drawer, DeleteConfirmDialog):
 * portal only when a provider supplies a container, otherwise return the node unchanged.
 */
export function useOptionalPortal(): (node: React.ReactElement) => React.ReactElement {
    const ctx = useContext(PortalContext);
    return (node) => (ctx ? createPortal(node, ctx) : node);
}
