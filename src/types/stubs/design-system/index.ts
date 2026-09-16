/* eslint-disable */
// Fallback stub — used when @so360/design-system is not resolvable at the real path
const _any: any = undefined;
export default _any;
export const Button: any = _any;
export const Input: any = _any;
export const Modal: any = _any;
export const Table: any = _any;
export const Badge: any = _any;
export const Card: any = _any;
export const Select: any = _any;
export const Checkbox: any = _any;
export const DatePicker: any = _any;
export const Spinner: any = _any;
export const Toast: any = _any;
export const Tooltip: any = _any;
export const Dropdown: any = _any;
export const Pagination: any = _any;
export const QuotaBar: any = _any;
export const QuotaGate: any = _any;

// Universal toast surface
export const toast: {
    success: (message: string, opts?: any) => string;
    error: (message: string, opts?: any) => string;
    warning: (message: string, opts?: any) => string;
    info: (message: string, opts?: any) => string;
    promise: <T>(p: Promise<T>, msgs?: any) => Promise<T>;
    dismiss: (id?: string) => void;
} = {
    success: () => 'toast-id',
    error: () => 'toast-id',
    warning: () => 'toast-id',
    info: () => 'toast-id',
    promise: (p) => p,
    dismiss: () => {},
};
export const useToast: () => typeof toast = () => toast;
export const getErrorMessage: (e: unknown, fallback?: string) => string = (_e, fallback) => fallback ?? 'error';
export const attachToastErrorHandler: (instance?: any) => number = () => 0;
export const toastBus: {
    show: (...args: any[]) => void;
    dismiss: (id?: string) => void;
    subscribe: (fn: any) => () => void;
    getToasts: () => any[];
} = {
    show: () => {},
    dismiss: () => {},
    subscribe: () => () => {},
    getToasts: () => [],
};
