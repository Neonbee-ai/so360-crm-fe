import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { mergeClassName } from '../utils/cx';

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

const SIZE: Record<TrendSize, { text: string; icon: number }> = {
    sm: { text: 'text-xs', icon: 12 },
    md: { text: 'text-sm', icon: 14 },
};

/** Arrow up / down / flat plus the signed value, toned by whether the direction is good. */
export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
    value, format = 'percent', positiveIsGood = true, size = 'sm', className = '', ...rest
}) => {
    const finite = Number.isFinite(value);
    const dir: 'up' | 'down' | 'flat' = !finite || value === 0 ? 'flat' : value > 0 ? 'up' : 'down';
    const good = dir === 'up' ? positiveIsGood : !positiveIsGood;
    const tone = dir === 'flat' ? 'text-fg-muted' : good ? 'text-success' : 'text-danger';
    const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus;
    const abs = finite ? Math.abs(Math.round(value * 100) / 100) : 0;
    const text = `${abs}${format === 'percent' ? '%' : ''}`;
    return (
        <span
            data-testid={rest['data-testid'] ?? 'trend-indicator'}
            data-direction={dir}
            className={mergeClassName(`inline-flex items-center gap-1 font-nb-sans font-medium ${SIZE[size].text} ${tone}`.trim(), className)}
        >
            <Icon size={SIZE[size].icon} aria-hidden="true" />
            <span>{text}</span>
            <span className="sr-only">{dir === 'up' ? 'increase' : dir === 'down' ? 'decrease' : 'no change'}</span>
        </span>
    );
};
