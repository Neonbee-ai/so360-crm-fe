import React from 'react';
export interface ChipGroupOption {
    value: string;
    label: string;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    disabled?: boolean;
}
interface ChipGroupBase {
    options: ChipGroupOption[];
    name: string;
    /** Visible label above the chips; otherwise pass `aria-label`. */
    label?: string;
    hint?: string;
    size?: 'sm' | 'md';
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
    'data-testid'?: string;
}
export interface ChipGroupMultipleProps extends ChipGroupBase {
    /** Multi-select (default): role=group, each chip role=checkbox. */
    multiple?: true;
    value: string[];
    onChange: (value: string[]) => void;
}
export interface ChipGroupSingleProps extends ChipGroupBase {
    /** Single-select: role=radiogroup, each chip role=radio, arrow keys move + select. */
    multiple: false;
    value: string | null;
    onChange: (value: string | null) => void;
    /** Clicking the selected chip clears it (default false). */
    allowDeselect?: boolean;
}
export type ChipGroupProps = ChipGroupMultipleProps | ChipGroupSingleProps;
/**
 * Choice chips: pick one or more values that filter or tag content. Selected chips are tonal
 * (container tint, primary text, check) and keep the unselected chip's size — never a filled button.
 * Use SegmentedControl for switching a view, Tabs for switching a panel, Switch for on/off settings.
 */
export declare const ChipGroup: React.FC<ChipGroupProps>;
export {};
