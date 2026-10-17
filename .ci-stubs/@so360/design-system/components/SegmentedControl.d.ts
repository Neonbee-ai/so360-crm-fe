import React from 'react';
export interface SegmentedOption {
    value: string;
    label: string;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    disabled?: boolean;
    /** Icon-only segment: the label becomes the accessible name + tooltip (e.g. view switchers). Requires `icon`. */
    hideLabel?: boolean;
    /** Small muted chip after the label (e.g. a count). `count` is an alias for numeric badges; `badge` wins if both are set. */
    badge?: React.ReactNode;
    count?: number;
}
export interface SegmentedControlProps {
    options: SegmentedOption[];
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    disabled?: boolean;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    className?: string;
    name?: string;
    'data-testid'?: string;
}
/**
 * Single-choice radiogroup: one track (`bg-surface-sunken`) with a raised surface thumb (`bg-surface-raised`, 1px border, primary text).
 * Use for 2–5 mutually exclusive options (view switch, Public | Private). For a binary on/off setting use `Switch`.
 * Arrow keys move + select (roving tabindex). */
export declare const SegmentedControl: React.FC<SegmentedControlProps>;
