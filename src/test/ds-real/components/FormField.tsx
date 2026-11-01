import { useReplay, errorRaised } from '../hooks/useReplay';
import React, { createContext, useContext, useId, useLayoutEffect, useState } from 'react';
import { combAttrs, type CombAttrs, type CombControl } from '../utils/comb';
import { mergeClassName } from '../utils/cx';

/** What an input tells its enclosing FormField so the FormField root can carry data-comb-control. */
export interface CombFieldReg {
    control: CombControl;
    sensitive?: boolean;
    disabled?: boolean;
    readonly?: boolean;
}

export interface FormFieldContextValue {
    /** id to put on the control so the label's htmlFor resolves. */
    id: string;
    /** space-separated hint/error ids for aria-describedby (undefined when none). */
    describedBy?: string;
    invalid: boolean;
    required: boolean;
    name: string;
    /** Comb contract: inputs report their control type so the FormField root (which owns kind `field`) carries it. */
    registerComb?: (reg: CombFieldReg | null) => void;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

/** Returns the enclosing FormField's wiring, or null when used standalone. */
export const useFormFieldContext = (): FormFieldContextValue | null => useContext(FormFieldContext);

/**
 * Comb contract hook for every field input. Standalone → the input root gets kind `field` + control.
 * Inside a FormField → FormField owns `field` (no double-stamp); the input reports its control/state to it
 * through context and returns {} so the FormField root carries data-comb-control.
 */
export function useCombField(
    name: string | undefined,
    control: CombControl,
    opts: { sensitive?: boolean; disabled?: boolean; readonly?: boolean; invalid?: boolean; required?: boolean } = {},
): CombAttrs {
    const ctx = useFormFieldContext();
    useCombRegister(ctx, { control, sensitive: opts.sensitive, disabled: opts.disabled, readonly: opts.readonly });
    if (ctx) return {};
    return combAttrs('field', name, {
        control,
        sensitive: opts.sensitive,
        state: { disabled: opts.disabled, readonly: opts.readonly, invalid: opts.invalid, required: opts.required },
    });
}

/** Reports a control to an enclosing FormField (no-op when ctx is null). */
export function useCombRegister(ctx: FormFieldContextValue | null, reg: CombFieldReg | undefined): void {
    const register = ctx?.registerComb;
    const control = reg?.control;
    const sensitive = reg?.sensitive;
    const disabled = reg?.disabled;
    const readonly = reg?.readonly;
    useLayoutEffect(() => {
        if (!register || !control) return;
        register({ control, sensitive, disabled, readonly });
        return () => register(null);
    }, [register, control, sensitive, disabled, readonly]);
}

export type FormFieldSize = 'sm' | 'md';

/** Shared token-only control chrome for text-like controls. */
export function fieldControlClass(invalid: boolean, size: FormFieldSize = 'md', multiline = false): string {
    // Single-line controls get an explicit control-height token; multiline (Textarea) keeps padding + min-height.
    const sizing = multiline
        ? size === 'sm' ? 'min-h-nb-control-sm px-2.5 py-1 text-sm' : 'min-h-nb-control-md px-3 py-2 text-sm'
        : size === 'sm' ? 'h-nb-control-sm px-2.5 text-sm' : 'h-nb-control-md px-3 text-sm';
    const border = invalid ? 'border-danger' : 'border-line hover:border-line-strong';
    return [
        'w-full items-center rounded-nb bg-surface text-fg placeholder:text-fg-subtle border transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizing,
        border,
    ].join(' ');
}

export interface FormFieldProps {
    label: string;
    name: string;
    /** Explicit control id; the wrapped control must use the same id. Defaults to a generated one. */
    id?: string;
    /** Helper text under the control; may hold links/inline markup. */
    hint?: React.ReactNode;
    error?: string;
    required?: boolean;
    /** An element, or a render-prop receiving the generated wiring. */
    children: React.ReactNode | ((ctx: FormFieldContextValue) => React.ReactNode);
    className?: string;
    /** Comb contract: control type of the wrapped input. Inputs nested directly may also report it via context. */
    comb?: CombFieldReg;
    'data-testid'?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
    label,
    name,
    hint,
    error,
    required = false,
    children,
    className = '',
    comb: combProp,
    id: idProp,
    ...rest
}) => {
    const uid = useId();
    const [registered, setComb] = useState<CombFieldReg | null>(null);
    const comb = combProp ?? registered;
    const id = idProp ?? `${uid}-control`;
    const hasHint = hint != null && hint !== false && hint !== '';
    const hintId = hasHint ? `${uid}-hint` : undefined;
    const errorId = error ? `${uid}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    // Comb 1.1: the field shakes once (300ms) when an error appears or changes.
    const shake = useReplay(error || null, { when: errorRaised });
    const ctx: FormFieldContextValue = { id, describedBy, invalid: Boolean(error), required, name, registerComb: setComb };

    return (
        <FormFieldContext.Provider value={ctx}>
            <div
                className={mergeClassName(`flex flex-col gap-1.5${shake.active ? ' animate-nb-shake' : ''}`, className)}
                onAnimationEnd={shake.onAnimationEnd}
                data-testid={rest['data-testid']}
                {...combAttrs('field', name, {
                    control: comb?.control,
                    sensitive: comb?.sensitive,
                    state: { invalid: Boolean(error), required, disabled: comb?.disabled, readonly: comb?.readonly },
                })}
            >
                <label htmlFor={id} className="text-sm font-medium text-fg [overflow-wrap:anywhere]">
                    {label}
                    {required && (
                        <>
                            <span aria-hidden="true" className="ml-0.5 text-danger">*</span>
                            <span className="sr-only"> required</span>
                        </>
                    )}
                </label>
                {typeof children === 'function' ? children(ctx) : children}
                {hasHint && (
                    <p id={hintId} className="text-xs text-fg-muted">
                        {hint}
                    </p>
                )}
                {error && (
                    <p id={errorId} role="alert" className="text-xs text-danger">
                        {error}
                    </p>
                )}
            </div>
        </FormFieldContext.Provider>
    );
};
