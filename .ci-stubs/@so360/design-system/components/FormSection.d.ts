import React from 'react';
import { type FieldGridColumns } from './FieldGrid';
/** Miller's law: keep a chunk to ≤ 7 fields; split into more sections beyond this. */
export declare const FORM_SECTION_MAX_FIELDS = 7;
export interface FormSectionProps {
    title: string;
    description?: string;
    /** 1 (default) – 4 columns; collapses responsively (see FieldGrid). */
    columns?: FieldGridColumns;
    /** `card` (default): bordered surface for a page form. `plain`: no border/padding, for use inside a Card or Drawer. */
    variant?: 'card' | 'plain';
    /** Optional FormActions row rendered after the fields. */
    actions?: React.ReactNode;
    /** Override the child count used for the ≤7 guidance. */
    fieldCount?: number;
    children: React.ReactNode;
    className?: string;
}
/** A chunk of a form: heading + help text + a field grid. Warns (dev) when it holds more than 7 fields. */
export declare const FormSection: React.FC<FormSectionProps>;
