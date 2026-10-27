import React from 'react';
import { mergeClassName } from '../utils/cx';

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

const DOT: Record<StatusLegendTone, string> = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    primary: 'bg-primary',
    neutral: 'bg-fg-subtle',
};

/** Inline row of colour dot + label (+ optional count) explaining status colours. */
export const StatusLegend: React.FC<StatusLegendProps> = ({ items, className = '', ...rest }) => (
    <ul
        data-testid={rest['data-testid'] ?? 'status-legend'}
        className={mergeClassName(`flex flex-wrap items-center gap-x-nb-4 gap-y-nb-2 font-nb-sans text-xs text-fg-muted`.trim(), className)}
    >
        {items.map((it) => (
            <li key={it.label} className="inline-flex items-center gap-nb-2">
                <span data-testid="status-legend-dot" aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[it.tone]}`} />
                <span>{it.label}</span>
                {typeof it.count === 'number' && <span className="font-semibold text-fg">{it.count}</span>}
            </li>
        ))}
    </ul>
);
