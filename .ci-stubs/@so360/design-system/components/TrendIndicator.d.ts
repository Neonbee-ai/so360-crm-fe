import React from 'react';
export type TrendFormat = 'percent' | 'number';
export type TrendSize = 'sm' | 'md';
export interface TrendIndicatorProps {
    value: number;
    /** `percent` appends %, `number` shows the signed number. */
    format?: TrendFormat;
    /** When false, a rise is bad (e.g. churn, cost): up renders danger, down renders success. Default true. */
    positiveIsGood?: boolean;
    size?: TrendSize;
    className?: string;
    'data-testid'?: string;
}
/** Arrow up / down / flat plus the signed value, toned by whether the direction is good. */
export declare const TrendIndicator: React.FC<TrendIndicatorProps>;
