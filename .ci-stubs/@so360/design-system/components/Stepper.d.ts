import React from 'react';
export interface StepItem {
    label: string;
    description?: string;
    /** Marks the step as failed (overrides complete). */
    error?: boolean;
}
export interface StepperProps extends Omit<React.HTMLAttributes<HTMLOListElement>, 'onChange'> {
    /** Stable id for Comb automation (data-comb-id). */
    name?: string;
    steps: StepItem[];
    /** Zero-based index of the current step. */
    current: number;
    orientation?: 'horizontal' | 'vertical';
    /** When provided, completed/previous steps become clickable. */
    onStepClick?: (index: number) => void;
    /**
     * Horizontal only. Default layout: numbered circle with its label (and description) BELOW it, connectors between
     * circles, steps share the width equally (labels wrap to 2 lines, full text in the title tooltip), no scrolling.
     * `'auto'` (default) collapses to circles only + the current step's label under the row when the container is
     * narrower than `compactBelow`; `true` always collapsed; `false` never collapses.
     */
    compact?: 'auto' | boolean;
    /** Width (px) under which `compact='auto'` collapses. Default 72px per step. */
    compactBelow?: number;
}
export declare const Stepper: React.FC<StepperProps>;
