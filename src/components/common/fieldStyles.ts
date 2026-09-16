/**
 * The shared look of an *editable* form control.
 *
 * Quote forms filled their inputs with `bg-slate-800` — lighter than the
 * `bg-slate-900` card behind them, which is exactly the treatment this app uses
 * for disabled controls. Title, Valid Until, every line-item cell and the whole
 * Notes & Terms block therefore read as read-only, and users stopped trying to
 * edit them.
 *
 * Editable fields sit *darker* than their card (a well the caret drops into),
 * carry a visible border that brightens on hover, and take a blue focus ring.
 * Disabled ones keep the lighter fill and lose those affordances — so the two
 * states can never be confused again.
 */
export const EDITABLE_FIELD_CLASS =
    'w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder:text-slate-500 ' +
    'hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors ' +
    'disabled:bg-slate-800 disabled:text-slate-400 disabled:border-slate-700 disabled:cursor-not-allowed disabled:hover:border-slate-700';

/** Same language, sized for the dense line-item grid. */
export const EDITABLE_FIELD_SM_CLASS =
    'w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 text-sm placeholder:text-slate-500 ' +
    'hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors ' +
    'disabled:bg-slate-800 disabled:text-slate-400 disabled:border-slate-700 disabled:cursor-not-allowed disabled:hover:border-slate-700';

/** Right-aligned variant for numeric line-item cells (qty, price, discount, tax). */
export const EDITABLE_FIELD_SM_NUMERIC_CLASS = `${EDITABLE_FIELD_SM_CLASS} text-right`;
