import React from 'react';
import { type CombScopeValue } from './CombScope';
/**
 * One ancestor of the current page in the trail (`Root › A › B`). The current page is the page title and is
 * never part of the trail. Navigation: `onClick` → else `CombScope.navigate(to)` → else a plain `<a href>`.
 */
export interface TrailItem {
    label: string;
    to?: string;
    onClick?: () => void;
}
/** Legacy crumb shape (`PageHeader.breadcrumbs`): `href` instead of `to`, and the LAST item is the current page. */
interface LegacyCrumb {
    label: string;
    href?: string;
    onClick?: () => void;
}
export interface PageTrailProps {
    /**
     * Ancestors of this page, nearest last. `[]` means "directly under the module root". The CombScope `root`
     * is prepended unless the trail already starts with it. Leave undefined for no trail (module root pages).
     */
    trail?: TrailItem[];
    /** @deprecated Use `trail` (the current page is the title, not a crumb). Last item renders as the current page. */
    breadcrumbs?: LegacyCrumb[];
    /** @deprecated Use `trail`; the back action then goes to the last trail item. Overrides the back target. */
    onBack?: () => void;
    /** @deprecated Accessible name of the legacy `onBack` button. Default `Back to {last}` or `Back`. */
    backLabel?: string;
    /** Render the back action at all (ListDetailTemplate: only while a record is selected). Default true. */
    showBack?: boolean;
    /** Extra classes on the back button (ListDetailTemplate: `wc-expanded:hidden`). */
    backClassName?: string;
    className?: string;
}
export interface ResolvedTrail {
    /** Navigable ancestors, root first. */
    items: TrailItem[];
    /** Legacy `breadcrumbs` only: the last crumb, rendered as the current page. */
    current?: TrailItem;
}
/** Pure: merge `trail` / legacy `breadcrumbs` with the scope root. Exported for tests and custom headers. */
export declare function resolveTrail({ trail, breadcrumbs }: Pick<PageTrailProps, 'trail' | 'breadcrumbs'>, root?: CombScopeValue['root']): ResolvedTrail;
/** Follow a trail item: its own onClick, else the scope router, else a full navigation. Never history.back(). */
export declare function followTrailItem(item: TrailItem, navigate?: (to: string) => void): void;
/**
 * The one row above every page title: `[←] Root › A › B`. `←` goes to the last trail item (aria-label
 * `Back to {label}`, `data-comb="action" data-comb-id="back"`). On narrow windows middle crumbs collapse to
 * `…`, keeping the root and the last. Renders nothing when there is neither a crumb nor a back target.
 */
export declare const PageTrail: React.FC<PageTrailProps>;
export {};
