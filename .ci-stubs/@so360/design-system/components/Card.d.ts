import React from 'react';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export interface CardProps {
    title?: string;
    /** Header actions. A `<Button>` here without an explicit `variant` renders `secondary` (one primary per view). */
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    padding?: CardPadding;
    /** Used for the testid when there is no title. */
    name?: string;
    children?: React.ReactNode;
    className?: string;
    'data-testid'?: string;
}
export declare const Card: React.FC<CardProps>;
/** A titled section of a page (Card with a header). Alias of `Card` so `SectionCard` call sites map 1:1. */
export declare const SectionCard: React.FC<CardProps>;
export type SectionCardProps = CardProps;
