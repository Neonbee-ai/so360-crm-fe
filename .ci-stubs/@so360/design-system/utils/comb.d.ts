export declare const COMB_CONTRACT_VERSION = 1;
export type CombKind = 'page' | 'header' | 'region' | 'action' | 'menu' | 'menuitem' | 'tabs' | 'tab' | 'panel' | 'toolbar' | 'search' | 'filter' | 'chip' | 'form' | 'field' | 'drawer' | 'dialog' | 'table' | 'row' | 'column' | 'cell-action' | 'pagination' | 'stepper' | 'step' | 'kpi' | 'empty' | 'result' | 'alert' | 'toast' | 'nav' | 'navitem';
export type CombPageType = 'list' | 'detail' | 'list-detail' | 'dashboard' | 'form' | 'settings';
export type CombControl = 'text' | 'textarea' | 'number' | 'currency' | 'password' | 'otp' | 'phone' | 'email' | 'select' | 'combobox' | 'multiselect' | 'tags' | 'checkbox' | 'switch' | 'radio' | 'chips' | 'date' | 'daterange' | 'datetime' | 'time' | 'file' | 'people' | 'color' | 'rating' | 'slider';
/** State tokens for data-comb-state; falsy entries are dropped. */
export type CombStateMap = Partial<Record<'open' | 'closed' | 'loading' | 'busy' | 'error' | 'empty' | 'ready' | 'disabled' | 'readonly' | 'selected' | 'current' | 'complete' | 'invalid' | 'required' | 'dirty' | 'expanded' | 'collapsed' | 'sorted-asc' | 'sorted-desc', boolean | null | undefined>>;
export interface CombAttrOptions {
    state?: CombStateMap;
    control?: CombControl;
    variant?: string;
    /** Never expose this field's value through window.__comb. */
    sensitive?: boolean;
}
export type CombAttrs = Record<`data-comb${string}`, string>;
/** First non-empty candidate, as a slug. Accepts strings only (ReactNode labels are skipped). */
export declare function combId(...candidates: unknown[]): string | undefined;
export declare function combState(state?: CombStateMap): string | undefined;
/** Attributes for a component root. `id` may be a label — it is slugified. */
export declare function combAttrs(kind: CombKind, id?: unknown, opts?: CombAttrOptions): CombAttrs;
export interface CombPageAttrOptions {
    module?: string;
    entity?: string;
    record?: string | number | null;
    state?: CombStateMap;
}
/** Attributes for a page template root. */
export declare function combPageAttrs(type: CombPageType, opts?: CombPageAttrOptions): CombAttrs;
