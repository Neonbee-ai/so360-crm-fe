import React from 'react';

/**
 * Boundary for additive panels (the 360 blocks).
 *
 * A panel is extra information bolted onto a record the user came for. If one
 * of them throws — a null field, a shape change in a module we compose from —
 * the record must still render. Before this existed, a single null inside the
 * 360 block replaced the whole customer page with "Something went wrong".
 *
 * Fails silently to the user, loudly to the console: the panel disappears and
 * the error is logged so it can be fixed, rather than being swallowed.
 */
interface PanelBoundaryProps {
    /** Shown instead of the panel when it fails. Defaults to nothing. */
    fallback?: React.ReactNode;
    /** Name for the console message, e.g. "customer-360". */
    name: string;
    children: React.ReactNode;
}

interface PanelBoundaryState {
    failed: boolean;
}

export class PanelBoundary extends React.Component<PanelBoundaryProps, PanelBoundaryState> {
    state: PanelBoundaryState = { failed: false };

    static getDerivedStateFromError(): PanelBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: Error) {
        // Deliberately kept as a warning: the page is still usable, so this is
        // a defect in one panel, not a broken screen.
        console.warn(`[${this.props.name}] panel failed to render:`, error?.message);
    }

    render() {
        if (this.state.failed) return this.props.fallback ?? null;
        return this.props.children;
    }
}

export default PanelBoundary;
