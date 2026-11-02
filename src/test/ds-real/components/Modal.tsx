import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePortalContainer } from './PortalProvider';
import { X } from 'lucide-react';
import { combAttrs } from '../utils/comb';
import { Button, ButtonDefaults } from './Button';
import { resolveTestId } from '../utils/testId';
import { usePresence } from '../hooks/usePresence';

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
    /** Id of a `<form>` in the body. The primary `<Button>` in `footer` (no explicit `type`/`form`) becomes
     * `type="submit" form={formId}`, so Enter in a field and the footer button share one submit path.
     * With no `footer`, a default Cancel + submit footer is rendered (see `submitLabel`/`cancelLabel`). */
    formId?: string;
    /** Label of the auto footer's submit button (formId without footer). Default 'Save'. */
    submitLabel?: React.ReactNode;
    /** Label of the auto footer's cancel button. Default 'Cancel'. */
    cancelLabel?: React.ReactNode;
    /** Auto footer: spinner + disabled submit, and cancel disabled. */
    submitLoading?: boolean;
    /** Auto footer: disables the submit button. */
    submitDisabled?: boolean;
    'data-testid'?: string;
}

const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-nb-modal-md',
    lg: 'max-w-nb-modal-lg',
    xl: 'max-w-nb-modal-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
};

const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Centered, portaled dialog with focus trap, Esc-to-close, focus restore and
 * body scroll lock. Prefer Drawer for create/edit flows; use Modal for short
 * decisions and confirmations.
 */
export const Modal: React.FC<ModalProps> = (props) => {
    const {
        open,
        onClose,
        title,
        description,
        size = 'md',
        footer,
        children,
        closeOnOverlayClick = true,
        dismissible = true,
        bodyPadding = true,
        initialFocusRef,
        name,
        formId,
        submitLabel = 'Save',
        cancelLabel = 'Cancel',
        submitLoading = false,
        submitDisabled = false,
    } = props;
    const dialogRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = dismissible ? onClose : () => {};
    const uid = useId();
    const titleId = `${uid}-title`;
    const descId = `${uid}-desc`;

    useEffect(() => {
        if (!open) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const dialog = dialogRef.current;
        const target =
            initialFocusRef?.current ?? dialog?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
        target?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (items.length === 0) {
                e.preventDefault();
                dialogRef.current.focus();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            previouslyFocused?.focus?.();
        };
        // initialFocusRef is read once on open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const portalTarget = usePortalContainer();
    const presence = usePresence(open);
    if (!presence.mounted || !portalTarget) return null;
    const closing = presence.state === 'closing';

    const footerContent =
        footer ??
        (formId ? (
            <>
                <Button type="button" variant="secondary" name="cancel" onClick={onClose} disabled={submitLoading || !dismissible}>
                    {cancelLabel}
                </Button>
                <Button name="submit" loading={submitLoading} disabled={submitDisabled}>
                    {submitLabel}
                </Button>
            </>
        ) : null);

    return createPortal(
        <div
            className={`fixed inset-0 z-dialog flex items-center justify-center p-4 ${closing ? 'pointer-events-none' : ''}`}
            role="presentation"
            data-state={closing ? 'closing' : 'open'}
        >
            <div
                className={`fixed inset-0 bg-overlay/70 ${closing ? 'animate-nb-fade-out' : 'animate-nb-fade'}`}
                data-testid="modal-overlay"
                onClick={!closing && closeOnOverlayClick && dismissible ? onClose : undefined}
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                {...combAttrs('dialog', name ?? (typeof title === 'string' ? title : undefined), { state: { open: true } })}
                aria-describedby={description ? descId : undefined}
                tabIndex={-1}
                data-testid={resolveTestId(props['data-testid'], 'dialog', name ?? (typeof title === 'string' ? title : undefined))}
                className={`relative flex max-h-[90vh] w-full ${sizeMap[size]} flex-col rounded-nb-lg border border-line bg-surface-raised shadow-overlay ${closing ? 'animate-nb-dialog-out' : 'animate-nb-dialog'} focus:outline-none`}
                onAnimationEnd={(e: React.AnimationEvent<HTMLDivElement>) => {
                    if (closing && e.target === e.currentTarget) presence.onExitEnd();
                }}
            >
                <div className="flex items-start gap-3 border-b border-line px-6 py-4">
                    <div className="min-w-0 flex-1">
                        <h2 id={titleId} className="truncate text-lg font-semibold text-fg">
                            {title}
                        </h2>
                        {description && (
                            <div id={descId} className="mt-1 text-sm text-fg-muted">
                                {description}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={dismissible ? onClose : undefined}
                        disabled={!dismissible}
                        aria-label="Close"
                        className="rounded-nb-lg p-1.5 text-fg-muted hover:text-fg focus:outline-none focus-visible:ring-2 ring-focus disabled:opacity-50"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
                <div className={`min-h-0 flex-1 overflow-y-auto text-fg ${bodyPadding ? 'px-6 pb-5 pt-6' : ''}`}>{children}</div>
                {footerContent && (
                    <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4" data-slot="dialog-footer">
                        {formId ? <ButtonDefaults submitForm={formId}>{footerContent}</ButtonDefaults> : footerContent}
                    </div>
                )}
            </div>
        </div>,
        portalTarget,
    );
};
