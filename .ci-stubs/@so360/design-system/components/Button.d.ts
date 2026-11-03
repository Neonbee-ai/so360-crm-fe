import React from 'react';
export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
/**
 * Action hierarchy (one primary per view):
 * - `primary`   filled brand — the ONE main verb of the view (page header far right).
 * - `tonal`     primary-container fill — the main action of a section / inline form when the view already has a primary.
 * - `secondary` surface + hairline — any other action (section header actions, Cancel).
 * - `ghost`     text only — low-emphasis, repeated or toolbar actions.
 * - `danger`    destructive confirm only (inside a ConfirmDialog), never in a header.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Defaults to the nearest `ButtonDefaults` variant, else `primary`. */
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Shows a spinner, sets aria-busy and disables the button. The label keeps its width (no layout shift). */
    loading?: boolean;
}
interface ButtonDefaultsValue {
    variant?: ButtonVariant;
    size?: ButtonSize;
}
/**
 * Sets the default `variant`/`size` for Buttons rendered inside it that don't set their own.
 * Card/SectionCard header actions use `variant="secondary"`, so a plain `<Button>` there never becomes a second primary.
 */
export declare const ButtonDefaults: React.FC<ButtonDefaultsValue & {
    children?: React.ReactNode;
}>;
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
export {};
