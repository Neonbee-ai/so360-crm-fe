import React from 'react';
export type GridGap = 'sm' | 'md' | 'lg';
export type GridColumns = 'auto' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 12;
export type GridSpan = 3 | 4 | 6 | 8 | 12 | 'full';
export interface GridResponsiveSpan {
    /** Compact (< 600px, 4 columns). Defaults to full width. */
    base?: GridSpan;
    /** Medium (>= 600px, 8 columns). Defaults to `base`. */
    md?: GridSpan;
    /** Expanded and up (>= 840px, 12 columns). Defaults to `md`. */
    lg?: GridSpan;
}
export interface GridProps {
    /** `auto` = 4 columns compact / 8 medium / 12 expanded. */
    columns?: GridColumns;
    /**
     * Asymmetric / auto column template (e.g. `"auto 1fr"`, `"2fr 1fr"`), applied from the
     * medium window class up; stacks to one column on compact. Overrides `columns`.
     */
    template?: string;
    /** sm = 8px, md = 16px, lg = 24px (region gutter). */
    gap?: GridGap;
    as?: 'div' | 'section' | 'ul' | 'ol';
    className?: string;
    children?: React.ReactNode;
    'data-testid'?: string;
}
export interface GridItemProps {
    /** One span (collapses to full on compact) or a per-window-class object. */
    span?: GridSpan | GridResponsiveSpan;
    as?: 'div' | 'section' | 'li' | 'article';
    className?: string;
    children?: React.ReactNode;
    'data-testid'?: string;
}
/** Resolve the span classes for compact / medium / expanded. Exported for specs. */
export declare function gridSpanClasses(span?: GridItemProps['span']): string;
declare const GridItem: React.FC<GridItemProps>;
/**
 * Comb grid: 4 / 8 / 12 columns by window class with token gutters.
 * Children should be `Grid.Item` with spans 3/4/6/8/12.
 */
export declare const Grid: React.FC<GridProps> & {
    Item: typeof GridItem;
};
export { GridItem };
