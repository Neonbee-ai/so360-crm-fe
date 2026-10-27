import { type CombAttrs, type CombPageType, type CombStateMap } from '../utils/comb';
export interface CombPageProps {
    /** Comb automation: owning module (falls back to the nearest CombScope). */
    module?: string;
    /** Comb automation: entity shown (falls back to the nearest CombScope). */
    entity?: string;
    /** Comb automation: id of the record a detail/form page is showing. */
    record?: string | number | null;
}
/** Page-root Comb attributes for a template; also installs the window.__comb inspector once. */
export declare function usePageComb(type: CombPageType, props: CombPageProps, state?: CombStateMap): CombAttrs;
