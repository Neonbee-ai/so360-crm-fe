import React from 'react';
import { PopoverPlacement } from './Popover';
export interface MenuItem {
    label: string;
    onSelect: () => void;
    icon?: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
}
export interface MenuProps {
    trigger: React.ReactElement<Record<string, unknown>>;
    items: MenuItem[];
    placement?: PopoverPlacement;
    name?: string;
    /** Portal the menu out of clipping ancestors (default true, see Popover). */
    portal?: boolean;
    'data-testid'?: string;
}
/** Action menu (Popover + roving focus). */
export declare const Menu: React.FC<MenuProps>;
