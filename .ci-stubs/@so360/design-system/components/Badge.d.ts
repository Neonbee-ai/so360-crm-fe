import React from 'react';
export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';
export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children' | 'className'> {
    tone?: BadgeTone;
    size?: BadgeSize;
    /** Show a leading status dot (always on for `muted`, which relies on it for colour). */
    dot?: boolean;
    variant?: BadgeVariant;
    shape?: BadgeShape;
    children?: React.ReactNode;
    className?: string;
    'data-testid'?: string;
}
/** Emphasis: `soft` (default, container tint), `muted` (neutral chip + coloured dot, for dense tables), `outline`, `solid`. */
export type BadgeVariant = 'soft' | 'muted' | 'outline' | 'solid';
export type BadgeShape = 'rounded' | 'pill';
type ToneClasses = Record<BadgeVariant, string> & {
    dot: string;
};
/** Semantic tokens only — no raw palette colours. Soft uses the M3 container/on-container pair (AA in both themes). */
export declare const BADGE_TONES: Record<BadgeTone, ToneClasses>;
export declare const Badge: React.FC<BadgeProps>;
export {};
