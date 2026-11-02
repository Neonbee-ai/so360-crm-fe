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
 * Portal for fixed overlays (Drawer, DeleteConfirmDialog, DocumentPreviewDrawer): the provider's container,
 * else document.body. They used to render inline without a provider, which trapped their z-drawer layer inside
 * any positioned ancestor's stacking context (e.g. the sticky z-toolbar list toolbar), so the DataTable's sticky
 * header painted over the open Filters drawer. Inline only when there is no DOM (SSR).
 */
export function useOptionalPortal(): (node: React.ReactElement) => React.ReactElement {
    const container = usePortalContainer();
    return (node) => (container ? createPortal(node, container) : node);
}
