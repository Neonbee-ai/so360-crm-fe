import React from 'react';
export type SplitRatio = '8/4' | '6/6' | '9/3';
export interface SplitProps {
    /** Main/rail column share of 12. Default 8/4. */
    ratio?: SplitRatio;
    /** Rail content, always on the right from expanded up; stacks below main on compact/medium. */
    rail: React.ReactNode;
    className?: string;
    children: React.ReactNode;
    'data-testid'?: string;
}
/** Main + rail two-column layout. 12-col from expanded; single stacked column below. */
export declare const Split: React.FC<SplitProps>;
