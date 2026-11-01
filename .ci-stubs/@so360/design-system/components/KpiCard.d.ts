import React from 'react';
export interface KpiCardProps {
    /** Stable id for Comb automation; defaults to the label. */
    name?: string;
    label: string;
    value: React.ReactNode;
    /** Signed change; positive = increase, negative = decrease, 0 = no sign announcement. */
    /** Secondary text under the value. */
    hint?: React.ReactNode;
    delta?: number;
    deltaLabel?: string;
    icon?: React.ComponentType<{
        className?: string;
    }>;
    loading?: boolean;
    onClick?: () => void;
    className?: string;
    'data-testid'?: string;
}
export declare const KpiCard: React.FC<KpiCardProps>;
