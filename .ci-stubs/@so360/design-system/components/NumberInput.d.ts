import React from 'react';
import type { FormFieldSize } from './FormField';
export interface NumberInputProps {
    /** Controlled value (null = empty). */
    value?: number | null;
    defaultValue?: number | null;
    onChange?: (value: number | null) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    size?: FormFieldSize;
    id?: string;
    onBlur?: () => void;
    autoFocus?: boolean;
    /** Show the −/+ stepper buttons (default true). Off → a plain right-aligned amount field. */
    stepper?: boolean;
    /** Leading adornment, e.g. a currency symbol ("₹", "$"). */
    prefix?: React.ReactNode;
    /** Trailing adornment, e.g. a unit ("kg", "hrs", "%") or currency code. */
    suffix?: React.ReactNode;
    /** Text alignment; defaults to `center` with the stepper, `end` without (amounts). */
    align?: 'start' | 'center' | 'end';
    'aria-label'?: string;
    'data-testid'?: string;
}
export declare function clampNumber(n: number, min?: number, max?: number): number;
/**
 * Numeric spinbutton: no native spinner, optional −/+ stepper, prefix/suffix adornments, negatives allowed
 * (unless `min` ≥ 0), min/max/step and ArrowUp/ArrowDown. Same height, radius, border and focus ring as Input.
 */
export declare const NumberInput: React.ForwardRefExoticComponent<NumberInputProps & React.RefAttributes<HTMLInputElement>>;
