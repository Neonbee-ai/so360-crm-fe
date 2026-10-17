import React from 'react';
import { type TooltipSide } from './Tooltip';
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Required — doubles as the tooltip text and the accessible name (aria-label)
     * for this icon-only button. Keep it short and specific, e.g. "Delete Item",
     * "Refresh Data" — never generic text like "Button" or "Click here".
     */
    label: string;
    icon: React.ReactNode;
    variant?: 'ghost' | 'solid' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    tooltipSide?: TooltipSide;
    /** Suppress the tooltip while still keeping the aria-label (rare — e.g. inside another tooltip-bearing region). */
    hideTooltip?: boolean;
    /** Toggle state (M3 selected icon button): sets aria-pressed and a tinted container. */
    selected?: boolean;
    /** Shows a spinner in place of the icon, sets aria-busy and disables the button (size stays fixed). */
    loading?: boolean;
}
export declare const IconButton: React.ForwardRefExoticComponent<IconButtonProps & React.RefAttributes<HTMLButtonElement>>;
