import React from 'react';
export type StatusLegendTone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';
export interface StatusLegendItem {
    label: string;
    tone: StatusLegendTone;
    count?: number;
}
export interface StatusLegendProps {
    items: StatusLegendItem[];
    className?: string;
    'data-testid'?: string;
}
/** Inline row of colour dot + label (+ optional count) explaining status colours. */
export declare const StatusLegend: React.FC<StatusLegendProps>;
