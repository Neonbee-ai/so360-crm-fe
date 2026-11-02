import React from 'react';
/**
 * Switch — an on/off setting that takes effect immediately (e.g. "Private project", "Billable", "Notify me").
 *
 * When to use what:
 * - Switch: ONE binary setting, applied instantly, reads as a statement that is true/false.
 * - SegmentedControl: choose ONE of 2–5 named, mutually exclusive options/views ("List | Board | Gantt", "Public | Private"
 *   when both labels matter). Never two toggled Buttons.
 * - Checkbox: binary choice inside a form that is saved with a Submit button, or multi-select lists.
 */
export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'type'> {
    label: string;
    name: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    /** Secondary helper text under the label (wired via aria-describedby). */
    description?: React.ReactNode;
    /** Visually hide the label (still announced). Use only when context makes the setting obvious. */
    hideLabel?: boolean;
    /** Put the label before the track (settings-list layout). Default: track first. */
    labelPosition?: 'start' | 'end';
    'data-testid'?: string;
}
export declare const Switch: React.FC<SwitchProps>;
