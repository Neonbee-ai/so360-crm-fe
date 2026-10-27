import React from 'react';
import { type FormFieldSize } from './FormField';
export interface AutocompleteOption {
    value: string;
    label: string;
    description?: string;
    group?: string;
    disabled?: boolean;
}
export interface AutocompleteProps {
    /** Free-text value (controlled). */
    value?: string;
    defaultValue?: string;
    onChange?: (text: string) => void;
    /** Fired when a suggestion is picked. */
    onSelect?: (option: AutocompleteOption) => void;
    /** Static suggestions, filtered locally. */
    options?: AutocompleteOption[];
    /** Async suggestions; called (debounced) with the current text. Overrides local filtering. */
    loadOptions?: (query: string) => Promise<AutocompleteOption[]>;
    debounceMs?: number;
    /** Minimum characters before suggestions show (default 1). */
    minChars?: number;
    label?: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
    size?: FormFieldSize;
    emptyText?: string;
    /** Offer a "Create “text”" row when the typed text has no exact match; called with the trimmed text. */
    onCreate?: (text: string) => void;
    /** Label for the create row (default `Create “text”`). */
    createLabel?: (text: string) => string;
    'aria-label'?: string;
    'data-testid'?: string;
}
/** Free-text input with suggestions. Unlike Combobox, the typed text is the value. */
export declare const Autocomplete: React.FC<AutocompleteProps>;
