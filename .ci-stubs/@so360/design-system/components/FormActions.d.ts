import React from 'react';
export type FormActionsEmphasis = 'primary' | 'tonal';
/** Lets a container (InlineFormPanel) lower the submit emphasis so a page keeps one primary. */
export declare const FormActionsEmphasisContext: React.Context<FormActionsEmphasis | undefined>;
export interface FormActionsProps {
    /** `end` (default): [extra … ][Cancel][Submit]. `start`: [Submit][Cancel][ … extra]. */
    align?: 'end' | 'start';
    submitLabel?: string;
    /** Click handler; omit to render a `type="submit"` button for the enclosing form. */
    onSubmit?: () => void;
    submitting?: boolean;
    submitDisabled?: boolean;
    /** Omit to hide Cancel. */
    onCancel?: () => void;
    cancelLabel?: string;
    /** Submit emphasis. Defaults to the container's (InlineFormPanel → tonal), else primary. */
    emphasis?: FormActionsEmphasis;
    size?: 'sm' | 'md';
    /** Top border + padding to separate from the fields (page/section forms). */
    divider?: boolean;
    /** Extra actions (e.g. a ghost "Delete") placed away from Submit/Cancel. */
    children?: React.ReactNode;
    /** Associates a submit button with a form by id (e.g. Drawer footer). */
    form?: string;
    name?: string;
    className?: string;
    'data-testid'?: string;
}
/**
 * The one action row for forms: consistent Cancel + Submit order, one emphasised button.
 * Primary emphasis pairs with a secondary Cancel; tonal (inline panels) pairs with a ghost Cancel.
 */
export declare const FormActions: React.FC<FormActionsProps>;
