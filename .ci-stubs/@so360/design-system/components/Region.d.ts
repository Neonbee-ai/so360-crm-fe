import React from 'react';
export interface RegionProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Right-aligned slot beside the title (buttons, links). */
    actions?: React.ReactNode;
    as?: 'section' | 'div' | 'aside';
    className?: string;
    children?: React.ReactNode;
    'data-testid'?: string;
}
/** Titled content section: section title + optional description, actions right, body on region rhythm. */
export declare const Region: React.FC<RegionProps>;
