import React from 'react';
import { type IconTileTone } from './IconTile';
/** Internal: provided by ChoiceCardGrid so cards need only a `value`. */
export interface ChoiceGroupContextValue {
    multiple: boolean;
    isSelected: (value: string) => boolean;
    toggle: (value: string) => void;
    hasSelection: boolean;
}
export declare const ChoiceGroupContext: React.Context<ChoiceGroupContextValue | null>;
export interface SelectableCardProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'role' | 'type' | 'onSelect'> {
    title: string;
    description?: string;
    /** lucide icon shown in a top-aligned IconTile. */
    icon?: React.ComponentType<{
        className?: string;
    }>;
    /** Tile tone while unselected (a selected card always uses `primary`). Default `neutral`. */
    iconTone?: IconTileTone;
    /** Small Badges / chips; wrap onto multiple lines. */
    tags?: React.ReactNode;
    /** Value inside a ChoiceCardGrid. Required there; ignored standalone. */
    value?: string;
    /** Standalone controlled state (inside a ChoiceCardGrid the group owns it). */
    selected?: boolean;
    /** Standalone click handler (inside a ChoiceCardGrid use the grid's onChange). */
    onSelect?: () => void;
    /** Standalone semantics: radio (default) or checkbox. Inside a grid it follows `multiple`. */
    selectionRole?: 'radio' | 'checkbox';
    'data-testid'?: string;
}
/**
 * Card-shaped choice: top-aligned IconTile, one-line title, wrapping muted description, optional tags,
 * primary border + check when selected. Prefer inside <ChoiceCardGrid> (radiogroup / checkbox group).
 */
export declare const SelectableCard: React.FC<SelectableCardProps>;
