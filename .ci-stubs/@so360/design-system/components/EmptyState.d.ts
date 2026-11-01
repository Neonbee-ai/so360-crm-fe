import React from 'react';
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'className'> {
    icon?: React.ComponentType<{
        className?: string;
    }>;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        'data-testid'?: string;
    };
    /** Used for the testid instead of the title. */
    name?: string;
    className?: string;
    'data-testid'?: string;
}
export declare const EmptyState: React.FC<EmptyStateProps>;
