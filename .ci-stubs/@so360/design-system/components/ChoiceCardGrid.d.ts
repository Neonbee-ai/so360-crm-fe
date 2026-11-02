import React from 'react';
interface BaseProps {
    children: React.ReactNode;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    /** Testid suffix: choice-grid-<name>. */
    name?: string;
    /** Minimum card width (CSS length) for the auto-fill grid. Default 14rem. */
    minCardWidth?: string;
    className?: string;
    'data-testid'?: string;
}
export interface ChoiceCardGridSingleProps extends BaseProps {
    multiple?: false;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
}
export interface ChoiceCardGridMultiProps extends BaseProps {
    multiple: true;
    value?: string[];
    defaultValue?: string[];
    onChange?: (value: string[]) => void;
}
export type ChoiceCardGridProps = ChoiceCardGridSingleProps | ChoiceCardGridMultiProps;
/**
 * Responsive grid of <SelectableCard value=…>. Single choice = radiogroup (arrow keys move + select);
 * `multiple` = checkbox group (arrow keys move focus, Space toggles). Cards share equal heights.
 */
export declare const ChoiceCardGrid: React.FC<ChoiceCardGridProps>;
export {};
