import React from 'react';
import type { CombAttrs } from '../utils/comb';
export type PageContainerWidth = 'page' | 'form' | 'full';
export interface PageContainerProps {
    /** `page` = max 1440 (default), `form` = max 960, `full` = unbounded. Always left-aligned. */
    width?: PageContainerWidth;
    /** Render the inner box as another element (templates pass `section`). */
    as?: 'div' | 'section' | 'main';
    className?: string;
    children: React.ReactNode;
    'data-testid'?: string;
    /** Comb automation attributes for the root (page templates pass combPageAttrs). */
    comb?: CombAttrs;
}
/**
 * Neonbee page container: `bg-bg` canvas, 24px padding (16px below 600px), 24px gap between regions,
 * max width 1440 (960 for forms), left-aligned. Put cards on `bg-surface` inside it.
 */
export declare const PageContainer: React.FC<PageContainerProps>;
