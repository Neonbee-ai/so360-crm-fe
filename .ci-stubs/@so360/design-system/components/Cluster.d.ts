import React from 'react';
export type ClusterGap = 'none' | 'tight' | 'default' | 'region';
export type ClusterAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type ClusterJustify = 'start' | 'center' | 'end' | 'between';
export interface ClusterProps {
    /** tight = 8px, default = 16px, region = 24px. */
    gap?: ClusterGap;
    /** Cross-axis alignment. Defaults to center. */
    align?: ClusterAlign;
    justify?: ClusterJustify;
    as?: 'div' | 'section' | 'ul' | 'ol' | 'nav';
    className?: string;
    children?: React.ReactNode;
    'data-testid'?: string;
}
/** Horizontal, wrapping row with token gap — chips, inline actions, meta lines. */
export declare const Cluster: React.FC<ClusterProps>;
