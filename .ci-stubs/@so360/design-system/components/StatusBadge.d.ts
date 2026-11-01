import React from 'react';
import { BadgeShape, BadgeSize, BadgeTone, BadgeVariant } from './Badge';
export declare const DEFAULT_STATUS_MAP: Record<string, BadgeTone>;
export interface StatusBadgeProps {
    status: string;
    /** Overrides/extends the default map. Keys are matched case-insensitively. */
    map?: Record<string, BadgeTone>;
    size?: BadgeSize;
    /** Badge emphasis; `muted` suits dense tables (neutral text, coloured dot). */
    variant?: BadgeVariant;
    shape?: BadgeShape;
    className?: string;
    'data-testid'?: string;
}
export declare function titleCase(value: string): string;
export declare const StatusBadge: React.FC<StatusBadgeProps>;
