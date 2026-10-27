import React from 'react';
import { type FormFieldSize } from './FormField';
export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    /** Omit when nesting inside your own FormField. */
    label?: string;
    name: string;
    options: SelectOption[];
    /** Renders a disabled, empty-valued first option. */
    placeholder?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    size?: FormFieldSize;
    /** 'inline' = borderless, quiet until hover/focus (M3 in-row edit). Default 'outlined'. */
    variant?: 'outlined' | 'inline';
    /** Convenience alongside the native onChange: receives the selected value. */
    onValueChange?: (value: string) => void;
    'data-testid'?: string;
}
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;
