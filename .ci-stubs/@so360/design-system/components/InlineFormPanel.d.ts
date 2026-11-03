import React from 'react';
import { type FieldGridColumns } from './FieldGrid';
export interface InlineFormPanelProps {
    title?: string;
    description?: string;
    /** Field grid columns (default 2). */
    columns?: FieldGridColumns;
    /** Fields. Wrapped in a FieldGrid. */
    children: React.ReactNode;
    /** `form` (default): Enter submits and calls onSubmit. `div`: Submit button calls onSubmit. */
    as?: 'form' | 'div';
    onSubmit?: () => void;
    submitLabel?: string;
    submitting?: boolean;
    submitDisabled?: boolean;
    onCancel?: () => void;
    cancelLabel?: string;
    /** Replace the default FormActions row. */
    actions?: React.ReactNode;
    name?: string;
    className?: string;
    'data-testid'?: string;
}
/**
 * @deprecated Forms open in a Drawer (≤8 fields) or Modal (≤4 fields) — comb-page-standard. Kept for backward compatibility.
 *
 * A short add/edit form shown in place, inside a section (add a line, a contact, a note).
 * Muted sunken surface, no border of its own (it already sits in a card), submit is tonal so the page's
 * primary stays unique. More than ~6 fields, or creating a top-level record → use a Drawer instead.
 */
export declare const InlineFormPanel: React.FC<InlineFormPanelProps>;
