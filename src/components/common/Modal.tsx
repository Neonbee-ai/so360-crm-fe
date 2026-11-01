import React from 'react';
import { Modal as DsModal } from '@so360/design-system';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    size?: ModalSize;
    /** Optional line under the title. */
    subtitle?: React.ReactNode;
    /** Sticky footer (actions right-aligned: secondary then primary). */
    footer?: React.ReactNode;
    /** When false, backdrop click / Escape / close button do nothing (e.g. while saving). Default true. */
    dismissible?: boolean;
    /** Body padding; set false when the content brings its own padding/sections. Default true. */
    bodyPadding?: boolean;
    'data-testid'?: string;
}

/** Thin wrapper over the DS Modal (portals into the CRM scope root via PortalProvider). */
export const Modal = ({ // comb-exception: thin adapter over the DS Modal (isOpen API); renaming would churn ~10 importers
    isOpen,
    onClose,
    title,
    children,
    size = 'lg',
    subtitle,
    footer,
    dismissible = true,
    bodyPadding = true,
    'data-testid': testId,
}: ModalProps) => (
    <DsModal
        open={isOpen}
        onClose={onClose}
        title={title}
        description={subtitle}
        size={size}
        footer={footer}
        dismissible={dismissible}
        bodyPadding={bodyPadding}
        data-testid={testId}
    >
        {children}
    </DsModal>
);
