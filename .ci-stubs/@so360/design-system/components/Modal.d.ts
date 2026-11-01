import React from 'react';
export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
    footer?: React.ReactNode;
    children?: React.ReactNode;
    /** Click on the backdrop closes the modal. Default true. */
    closeOnOverlayClick?: boolean;
    /** Element to focus on open; defaults to the first focusable control. */
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    /** When false, Escape / backdrop / close button do nothing (e.g. while saving). Default true. */
    dismissible?: boolean;
    /** Body padding; set false when content brings its own sections. Default true. */
    bodyPadding?: boolean;
    /** Used for the derived test id (falls back to title when it is a string). */
    name?: string;
    'data-testid'?: string;
}
/**
 * Centered, portaled dialog with focus trap, Esc-to-close, focus restore and
 * body scroll lock. Prefer Drawer for create/edit flows; use Modal for short
 * decisions and confirmations.
 */
export declare const Modal: React.FC<ModalProps>;
