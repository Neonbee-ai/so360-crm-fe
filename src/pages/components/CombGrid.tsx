import React from 'react';

/**
 * Comb layout shim for CRM record pages. The design system does not export a `Grid` primitive yet,
 * so every responsive column layout in the CRM record surfaces goes through this single component
 * (spans collapse 1 -> N by window class) instead of ad-hoc `grid-cols-*` in pages.
 * comb-exception: replace with `@so360/design-system` Grid once it ships.
 */
export type CombGridCols = 'pair' | 'pair-fixed' | 'triple' | 'quad' | 'trio' | 'quad-wide';

const COLS: Record<CombGridCols, string> = {
    // 1 col compact -> 2 cols from wc-medium
    pair: 'grid-cols-1 wc-medium:grid-cols-2',
    // always 2 cols
    'pair-fixed': 'grid-cols-2',
    // 1 -> 2 -> 3
    triple: 'grid-cols-1 wc-medium:grid-cols-2 lg:grid-cols-3',
    // 2 -> 3 -> 4
    quad: 'grid-cols-2 wc-medium:grid-cols-3 lg:grid-cols-4',
    // 1 -> 3
    trio: 'grid-cols-1 wc-medium:grid-cols-3',
    // 2 -> 4
    'quad-wide': 'grid-cols-2 wc-medium:grid-cols-4',
};

export interface CombGridProps extends React.HTMLAttributes<HTMLElement> {
    cols?: CombGridCols;
    as?: 'div' | 'dl' | 'ul';
}

export const CombGrid: React.FC<CombGridProps> = ({ cols = 'pair', as: Tag = 'div', className = '', children, ...rest }) => (
    <Tag className={`grid ${COLS[cols]} gap-nb-3 ${className}`.trim()} {...(rest as any)}>
        {children}
    </Tag>
);
