import React from 'react';
export type IconTileSize = 'sm' | 'md' | 'lg';
export type IconTileTone = 'primary' | 'neutral' | 'success' | 'warning' | 'danger';
export interface IconTileProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
    /** A lucide icon component (no emojis). */
    icon: React.ComponentType<{
        className?: string;
    }>;
    size?: IconTileSize;
    tone?: IconTileTone;
    /** Provide only when the icon carries meaning on its own; otherwise the tile is decorative (aria-hidden). */
    label?: string;
    'data-testid'?: string;
}
/** Tokenised square tile holding one icon — used as the leading visual of cards and list rows. */
export declare const IconTile: React.FC<IconTileProps>;
