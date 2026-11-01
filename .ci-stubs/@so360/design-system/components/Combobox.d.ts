import React from 'react';
import { type FormFieldSize } from './FormField';
export interface ComboboxOption {
    value: string;
    label: string;
    description?: string;
    group?: string;
    disabled?: boolean;
}
export interface ComboboxProps {
    options: ComboboxOption[];
    /** Selected option value (controlled). `null` = nothing selected. */
    value?: string | null;
    defaultValue?: string | null;
    onChange?: (value: string | null, option: ComboboxOption | null) => void;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
    size?: FormFieldSize;
    /** Show a clear (x) button when a value is selected. */
    clearable?: boolean;
    emptyText?: string;
    /** Custom match predicate (replaces label fuzzy match) — e.g. search description/email too. */
    filter?: (option: ComboboxOption, query: string) => boolean;
    /** Async options, called (debounced) with the typed query; replaces local filtering of `options`. */
    loadOptions?: (query: string) => Promise<ComboboxOption[]>;
    debounceMs?: number;
    /**
     * Offer a "Create “query”" row when the query has no exact match. Return the created option to select it
     * (sync or async); return nothing to leave selection to the caller.
     */
    onCreate?: (text: string) => ComboboxOption | void | Promise<ComboboxOption | void>;
    createLabel?: (text: string) => string;
    id?: string;
    onBlur?: () => void;
    autoFocus?: boolean;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Searchable single-select. The value is an option value (not free text). */
export declare const Combobox: React.FC<ComboboxProps>;
