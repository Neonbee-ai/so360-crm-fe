import React from 'react';
import { type CombAttrs, type CombControl } from '../utils/comb';
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
/** Returns the enclosing FormField's wiring, or null when used standalone. */
export declare const useFormFieldContext: () => FormFieldContextValue | null;
/**
 * Comb contract hook for every field input. Standalone → the input root gets kind `field` + control.
 * Inside a FormField → FormField owns `field` (no double-stamp); the input reports its control/state to it
 * through context and returns {} so the FormField root carries data-comb-control.
 */
export declare function useCombField(name: string | undefined, control: CombControl, opts?: {
    sensitive?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    invalid?: boolean;
    required?: boolean;
}): CombAttrs;
/** Reports a control to an enclosing FormField (no-op when ctx is null). */
export declare function useCombRegister(ctx: FormFieldContextValue | null, reg: CombFieldReg | undefined): void;
export type FormFieldSize = 'sm' | 'md';
/** Shared token-only control chrome for text-like controls. */
export declare function fieldControlClass(invalid: boolean, size?: FormFieldSize, multiline?: boolean): string;
export interface FormFieldProps {
    label: string;
    name: string;
    hint?: string;
    error?: string;
    required?: boolean;
    /** An element, or a render-prop receiving the generated wiring. */
    children: React.ReactNode | ((ctx: FormFieldContextValue) => React.ReactNode);
    className?: string;
    /** Comb contract: control type of the wrapped input. Inputs nested directly may also report it via context. */
    comb?: CombFieldReg;
    'data-testid'?: string;
}
export declare const FormField: React.FC<FormFieldProps>;
