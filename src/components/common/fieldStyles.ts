/**
 * The shared look of an *editable* form control.
 *
 * Quote forms filled their inputs with `bg-surface-raised` — lighter than the
 * `bg-surface` card behind them, which is exactly the treatment this app uses
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
    'w-full px-4 py-2 bg-bg border border-line rounded-lg text-fg placeholder:text-fg-muted ' +
    'hover:border-line focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-primary transition-colors ' +
    'disabled:bg-surface-raised disabled:text-fg-subtle disabled:border-line disabled:cursor-not-allowed disabled:hover:border-line';

/** Same language, sized for the dense line-item grid. */
export const EDITABLE_FIELD_SM_CLASS =
    'w-full px-3 py-1.5 bg-bg border border-line rounded text-fg text-sm placeholder:text-fg-muted ' +
    'hover:border-line focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-primary transition-colors ' +
    'disabled:bg-surface-raised disabled:text-fg-subtle disabled:border-line disabled:cursor-not-allowed disabled:hover:border-line';

/** Right-aligned variant for numeric line-item cells (qty, price, discount, tax). */
export const EDITABLE_FIELD_SM_NUMERIC_CLASS = `${EDITABLE_FIELD_SM_CLASS} text-right`;
