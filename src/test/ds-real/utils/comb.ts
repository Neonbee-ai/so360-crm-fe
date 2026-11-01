/**
 * Comb automation contract v1 — see packages/design-system/docs/automation-contract.md.
 *
 * Every Comb component stamps semantic attributes on its root so a browser agent can
 * find "the Save action in the open drawer" the same way in every module:
 *
 *   combAttrs('action', 'Invite client', { variant: 'primary' })
 *     -> { 'data-comb': 'action', 'data-comb-id': 'invite_client', 'data-comb-variant': 'primary' }
 *
 * Additive: data-testid (utils/testId.ts) is untouched.
 */
import { slugify } from './testId';

export const COMB_CONTRACT_VERSION = 1;

export type CombKind =
    | 'page' | 'header' | 'region'
    | 'action' | 'menu' | 'menuitem'
    | 'tabs' | 'tab' | 'panel'
    | 'toolbar' | 'search' | 'filter' | 'chip'
    | 'form' | 'field'
    | 'drawer' | 'dialog'
    | 'table' | 'row' | 'column' | 'cell-action'
    | 'pagination' | 'stepper' | 'step'
    | 'kpi' | 'empty' | 'result' | 'alert' | 'toast'
    | 'nav' | 'navitem';

export type CombPageType = 'list' | 'detail' | 'list-detail' | 'dashboard' | 'form' | 'settings' | 'editor';

export type CombControl =
    | 'text' | 'textarea' | 'number' | 'currency' | 'password' | 'otp' | 'phone' | 'email'
    | 'select' | 'combobox' | 'multiselect' | 'tags' | 'checkbox' | 'switch' | 'radio' | 'chips'
    | 'date' | 'daterange' | 'datetime' | 'time' | 'file' | 'people' | 'color' | 'rating' | 'slider';

/** State tokens for data-comb-state; falsy entries are dropped. */
export type CombStateMap = Partial<Record<
    | 'open' | 'closed' | 'loading' | 'busy' | 'error' | 'empty' | 'ready'
    | 'disabled' | 'readonly' | 'selected' | 'current' | 'complete'
    | 'invalid' | 'required' | 'dirty' | 'expanded' | 'collapsed'
    | 'sorted-asc' | 'sorted-desc',
    boolean | null | undefined
>>;

export interface CombAttrOptions {
    state?: CombStateMap;
    control?: CombControl;
    variant?: string;
    /** Never expose this field's value through window.__comb. */
    sensitive?: boolean;
}

export type CombAttrs = Record<`data-comb${string}`, string>;

/** First non-empty candidate, as a slug. Accepts strings only (ReactNode labels are skipped). */
export function combId(...candidates: unknown[]): string | undefined {
    for (const c of candidates) {
        if (typeof c === 'string' || typeof c === 'number') {
            const slug = slugify(String(c));
            if (slug) return slug;
        }
    }
    return undefined;
}

export function combState(state?: CombStateMap): string | undefined {
    if (!state) return undefined;
    const tokens = Object.entries(state).filter(([, on]) => on).map(([k]) => k);
    return tokens.length ? tokens.join(' ') : undefined;
}

/** Attributes for a component root. `id` may be a label — it is slugified. */
export function combAttrs(kind: CombKind, id?: unknown, opts: CombAttrOptions = {}): CombAttrs {
    const attrs: CombAttrs = { 'data-comb': kind };
    const slug = combId(id);
    if (slug) attrs['data-comb-id'] = slug;
    const state = combState(opts.state);
    if (state) attrs['data-comb-state'] = state;
    if (opts.control) attrs['data-comb-control'] = opts.control;
    if (opts.variant) attrs['data-comb-variant'] = opts.variant;
    if (opts.sensitive) attrs['data-comb-sensitive'] = 'true';
    return attrs;
}

export interface CombPageAttrOptions {
    module?: string;
    entity?: string;
    record?: string | number | null;
    state?: CombStateMap;
}

/** Contract v1.1: floorplan name carried by data-comb-path on a page root. */
export const COMB_PAGE_NAMES: Record<CombPageType, string> = {
    list: 'ListPage', detail: 'DetailPage', 'list-detail': 'ListDetailPage', dashboard: 'DashboardPage',
    form: 'FormPage', settings: 'SettingsPage', editor: 'EditorPage',
};

/** Contract v1.1 additive attribute: `<Floorplan>.<region>[.<slot>]` (data-comb-path). Segments are slugified. */
export function combPath(page: CombPageType, ...segments: unknown[]): { 'data-comb-path': string } {
    const parts = [COMB_PAGE_NAMES[page], ...segments.map((s) => combId(s)).filter((s): s is string => !!s)];
    return { 'data-comb-path': parts.join('.') };
}

/** Attributes for a page template root. */
export function combPageAttrs(type: CombPageType, opts: CombPageAttrOptions = {}): CombAttrs {
    const attrs = combAttrs('page', opts.entity ?? type, { state: opts.state });
    attrs['data-comb-page'] = type;
    attrs['data-comb-path'] = COMB_PAGE_NAMES[type];
    if (opts.module) attrs['data-comb-module'] = slugify(opts.module);
    if (opts.entity) attrs['data-comb-entity'] = slugify(opts.entity);
    if (opts.record != null && opts.record !== '') attrs['data-comb-record'] = String(opts.record);
    return attrs;
}
