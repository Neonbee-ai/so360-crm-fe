import React from 'react';
import { type CombPageProps } from './usePageComb';
import { Breadcrumb } from './PageHeader';
import type { TrailItem } from './PageTrail';
export interface FormPageSection {
    id: string;
    title: string;
    description?: string;
    /** Fields; laid out in 2 columns from 768px, 1 below. Use `md:col-span-2` on a field for full width. */
    content: React.ReactNode;
}
export interface FormPageTemplateProps extends CombPageProps {
    title: string;
    description?: string;
    /** Ancestors of this page (`Root › A`, nearest last); renders `[←] Root › A` above the title. See PageHeader. */
    trail?: TrailItem[];
    /** @deprecated Use `trail`. */
    breadcrumbs?: Breadcrumb[];
    /** @deprecated Use `trail` (back goes to the last trail item). */
    onBack?: () => void;
    /** @deprecated Accessible name of the legacy `onBack` action. */
    backLabel?: string;
    status?: React.ReactNode;
    meta?: React.ReactNode;
    /** Sectioned form body (cards on bg-surface). */
    sections?: FormPageSection[];
    /** Free-form body, rendered after `sections`. */
    children?: React.ReactNode;
    /** Footer: Cancel button (left of secondary/primary). */
    onCancel?: () => void;
    cancelLabel?: string;
    /** Footer: outlined secondary (e.g. "Save draft"), between Cancel and primary. */
    secondaryAction?: React.ReactNode;
    /** Footer: the single filled primary, rightmost. */
    primaryAction?: React.ReactNode;
    /** Footer: destructive action, far left. */
    destructiveAction?: React.ReactNode;
    className?: string;
}
/**
 * Form page (max width 960). Footer is sticky; order: destructive (far left), then Cancel, secondary, primary (right).
 *
 * @example
 * <FormPageTemplate title="New vendor" onCancel={back} primaryAction={<Button type="submit">Save</Button>}
 *   sections={[{ id: 'basic', title: 'Basics', content: <><Input .../><Input .../></> }]} />
 */
export declare const FormPageTemplate: React.FC<FormPageTemplateProps>;
