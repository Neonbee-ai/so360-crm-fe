import React from 'react';
/**
 * Module/entity defaults for the Comb automation contract (packages/design-system/docs/automation-contract.md §8).
 * Wrap an MFE root once — `<CombScope module="projects">` — and every page template under it stamps
 * data-comb-module without each page repeating it. Template props win over the scope.
 */
export interface CombScopeValue {
    module?: string;
    entity?: string;
    /**
     * Module root crumb (e.g. `{ label: 'Projects', to: '/projects' }`). Auto-prepended to every page
     * `trail` under this scope unless the trail already starts with it.
     */
    root?: {
        label: string;
        to: string;
    };
    /**
     * Router push used by trail crumbs and the back action (`(to) => navigate(to)` from react-router).
     * Without it crumbs fall back to plain `<a href>` links. Never `navigate(-1)`.
     */
    navigate?: (to: string) => void;
}
export declare const useCombScope: () => CombScopeValue;
export declare const CombScope: React.FC<CombScopeValue & {
    children?: React.ReactNode;
}>;
