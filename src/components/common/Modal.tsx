import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { crmPortalRoot } from '../../utils/crmScope';

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
};

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    size?: keyof typeof sizeClasses;
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

export const Modal = ({
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
}: ModalProps) => {
    const titleId = useId();
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !dismissible) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, dismissible, onClose]);

    if (!isOpen) return null;

    const close = () => { if (dismissible) onClose(); };

    return createPortal(
        <div className="fixed inset-0 z-dialog flex items-start justify-center p-6 overflow-y-auto">
            <div
                className="fixed inset-0 bg-overlay backdrop-blur-sm"
                onClick={close}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                data-testid={testId}
                className={`relative bg-surface-raised border border-line rounded-nb-lg w-full ${sizeClasses[size]} shadow-overlay overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col my-auto max-h-[90vh]`}
            >
                <div className="flex items-start justify-between gap-nb-3 px-6 py-4 border-b border-line shrink-0">
                    <div className="min-w-0">
                        <h3 id={titleId} className="text-xl font-bold text-fg">{title}</h3>
                        {subtitle && <div className="text-sm text-fg-muted mt-1">{subtitle}</div>}
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={close}
                        disabled={!dismissible}
                        className="p-1 hover:bg-surface-high rounded-lg text-fg-subtle hover:text-fg transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className={`${bodyPadding ? 'p-6' : ''} overflow-y-auto flex-1 min-h-0`}>
                    {children}
                </div>
                {footer && (
                    <div className="flex items-center justify-end gap-nb-2 px-6 py-4 border-t border-line shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        crmPortalRoot()
    );
};
