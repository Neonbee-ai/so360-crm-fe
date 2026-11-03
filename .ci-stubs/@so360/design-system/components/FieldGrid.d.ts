import React from 'react';
export type FieldGridColumns = 1 | 2 | 3 | 4;
/** Responsive column classes: 1 column on compact, 2 from wc-medium (600), 3/4 from wc-expanded (840). */
export declare const FIELD_GRID_COLUMNS: Record<FieldGridColumns, string>;
export interface FieldGridProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Columns at the widest breakpoint (default 2). Always collapses to 1 on compact. */
    columns?: FieldGridColumns;
    children: React.ReactNode;
}
/** The one field layout: a responsive grid with the standard field gap. Use `FieldGridItem span="full"` for wide fields. */
export declare const FieldGrid: React.FC<FieldGridProps>;
export interface FieldGridItemProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Columns to span; `full` spans the whole row (notes, addresses, line items). */
    span?: 1 | 2 | 3 | 4 | 'full';
    children: React.ReactNode;
}
export declare const FieldGridItem: React.FC<FieldGridItemProps>;
