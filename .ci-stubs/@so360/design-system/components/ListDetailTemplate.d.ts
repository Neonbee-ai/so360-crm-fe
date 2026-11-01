import React from 'react';
import { type CombPageProps } from './usePageComb';
import { type TrailItem } from './PageTrail';
export interface ListDetailTemplateProps extends CombPageProps {
    list: React.ReactNode;
    detail: React.ReactNode;
    /** True when an item is selected. On compact/medium windows this switches the single visible pane to the detail. */
    hasSelection: boolean;
    /**
     * Ancestors of the selected record (nearest last). Shown above the detail pane; on compact/medium windows the
     * `←` goes to the last item (e.g. the list route).
     */
    trail?: TrailItem[];
    /** Back on small windows (e.g. clear the selection). Takes precedence over the trail's back target. */
    onBack?: () => void;
    backLabel?: string;
    /** Shown in the detail pane when nothing is selected (two-pane layout only). */
    emptyDetail?: React.ReactNode;
    className?: string;
}
/** M3 canonical list-detail: two panes at wc-expanded+, one pane (with back) below. */
export declare const ListDetailTemplate: React.FC<ListDetailTemplateProps>;
