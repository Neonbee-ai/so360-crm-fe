import { DrawnCheck } from './Feedback';
import React from 'react';
import { combAttrs, combId } from '../utils/comb';
import { mergeClassName } from '../utils/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Action hierarchy (one primary per view):
 * - `primary`   filled brand — the ONE main verb of the view (page header far right).
 * - `tonal`     primary-container fill — the main action of a section / inline form when the view already has a primary.
 * - `secondary` surface + hairline — any other action (section header actions, Cancel).
 * - `ghost`     text only — low-emphasis, repeated or toolbar actions.
 * - `danger`    destructive confirm only (inside a ConfirmDialog), never in a header.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Defaults to the nearest `ButtonDefaults` variant, else `primary`. */
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Shows a spinner, sets aria-busy and disables the button. The label keeps its width (no layout shift). */
    loading?: boolean;
    /** Comb 1.1 success feedback: the label is swapped for a drawn tick (keeps its width). Set it briefly after a save. */
    success?: boolean;
    /** Icon before the label (decorative; the label names the action). */
    leadingIcon?: React.ReactNode;
    /** Icon after the label (decorative). */
    trailingIcon?: React.ReactNode;
    /** `name` (native attr) doubles as the stable automation id (data-comb-id); defaults to label / aria-label. */
}

interface ButtonDefaultsValue {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** When set, a `primary` Button inside (with no explicit `type`/`form`) renders `type="submit" form={submitForm}`.
     * Used by Modal/Drawer footers so the primary action submits a `<form id>` that lives in the body. */
    submitForm?: string;
}

const ButtonDefaultsContext = React.createContext<ButtonDefaultsValue>({});

/**
 * Sets the default `variant`/`size` for Buttons rendered inside it that don't set their own.
 * Card/SectionCard header actions use `variant="secondary"`, so a plain `<Button>` there never becomes a second primary.
 */
export const ButtonDefaults: React.FC<ButtonDefaultsValue & { children?: React.ReactNode }> = ({ variant, size, submitForm, children }) => {
    const parent = React.useContext(ButtonDefaultsContext);
    const value = React.useMemo(
        () => ({ variant: variant ?? parent.variant, size: size ?? parent.size, submitForm: submitForm ?? parent.submitForm }),
        [variant, size, submitForm, parent.variant, parent.size, parent.submitForm],
    );
    return <ButtonDefaultsContext.Provider value={value}>{children}</ButtonDefaultsContext.Provider>;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
    children,
    variant: variantProp,
    size: sizeProp,
    className = '',
    loading = false,
    success = false,
    leadingIcon,
    trailingIcon,
    disabled,
    ...props
}, ref) {
    const defaults = React.useContext(ButtonDefaultsContext);
    const variant: ButtonVariant = variantProp ?? defaults.variant ?? 'primary';
    const size: ButtonSize = sizeProp ?? defaults.size ?? 'md';
    const submitForm = variant === 'primary' && props.type === undefined && props.form === undefined ? defaults.submitForm : undefined;
    // Comb 1.2 flat buttons: hover/press change the fill colour only (no overlay, lift or glow); press nudges scale to .98.
    // aria-pressed=true gets the Comb selected treatment (fill + primary border + semibold).
    const selected = "aria-pressed:border-primary/60 aria-pressed:bg-selected aria-pressed:text-selected-fg aria-pressed:font-semibold";
    const baseStyles = selected + " relative inline-flex items-center justify-center gap-2 rounded-nb border font-nb-sans whitespace-nowrap [overflow-wrap:anywhere] transition-[background-color,border-color,color,transform] duration-nb-fast ease-nb active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

    const variants: Record<ButtonVariant, string> = {
        // Flat brand fill: no shadow/glow — emphasis comes from colour, and there is only one per view.
        primary: "border-transparent bg-primary text-primary-fg font-semibold hover:bg-primary-hover active:bg-primary-press",
        // Tonal (M3 filled-tonal): section-level main action, never competes with the page primary.
        tonal: "border-transparent bg-tint-teal text-ink-teal font-semibold hover:brightness-[.96] active:brightness-[.92]",
        // Surface + hairline.
        secondary: "bg-surface text-fg border-line font-medium hover:bg-surface-hover active:bg-surface-high",
        // Text only; hairline-free.
        ghost: "border-transparent bg-transparent text-fg-muted font-medium hover:bg-surface-hover hover:text-fg active:bg-surface-high",
        danger: "border-transparent bg-danger text-danger-fg font-semibold hover:bg-danger-hover active:brightness-[.92]"
    };

    const sizes = {
        sm: "h-nb-control-sm px-2.5 text-[13px]",
        md: "h-nb-control-md px-3.5 text-sm",
        lg: "h-nb-control-lg px-4 text-[15px]"
    };

    const content = (
        <>
            {leadingIcon && <span aria-hidden="true" data-slot="leading-icon" className="inline-flex shrink-0 items-center">{leadingIcon}</span>}
            {children}
            {trailingIcon && <span aria-hidden="true" data-slot="trailing-icon" className="inline-flex shrink-0 items-center">{trailingIcon}</span>}
        </>
    );
    return (
        <button
            ref={ref}
            // Caller overrides (h-auto, justify-start, px-0, rounded-full…) always win over the base, regardless of CSS order.
            className={mergeClassName(`${baseStyles} ${variants[variant]} ${sizes[size]}`, className)}
            {...props}
            {...(submitForm ? { type: 'submit' as const, form: submitForm } : null)}
            {...combAttrs('action', combId(props.name, props['aria-label'], typeof children === 'string' ? children : undefined, props.title), { variant, state: { disabled: !!(disabled || loading), loading } })}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            data-loading={loading || undefined}
            data-success={(success && !loading) || undefined}
            data-variant={variant}
        >
            {loading || success ? <span className="invisible inline-flex items-center justify-center gap-2">{content}</span> : content}
            {success && !loading && (
                <span data-testid="button-success" className="absolute inset-0 flex items-center justify-center">
                    <DrawnCheck className="h-4 w-4" />
                    <span className="sr-only">Done</span>
                </span>
            )}
            {loading && (
                <span aria-hidden="true" data-testid="button-spinner" className="absolute inset-0 flex items-center justify-center">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                </span>
            )}
        </button>
    );
});
