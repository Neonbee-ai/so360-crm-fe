import React from 'react';
export type StackDirection = 'vertical' | 'horizontal';
export type StackGap = 'none' | 'tight' | 'default' | 'region';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type StackJustify = 'start' | 'center' | 'end' | 'between';
export interface StackProps {
    direction?: StackDirection;
    /** tight = 8px, default = 16px, region = 24px. */
    gap?: StackGap;
    align?: StackAlign;
    justify?: StackJustify;
    wrap?: boolean;
    as?: 'div' | 'section' | 'ul' | 'ol' | 'nav';
    className?: string;
    children?: React.ReactNode;
    'data-testid'?: string;
}
/** Flex stack with Comb rhythm gaps. Vertical by default. */
export declare const Stack: React.FC<StackProps>;
