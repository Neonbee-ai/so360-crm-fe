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
export const DepartmentSelector: any = _any;
export const UserSelector: any = _any;

// Comb page templates + primitives (type-only fallback; real implementations live in the design-system package)
export const ListPageTemplate: any = _any;
export const DetailPageTemplate: any = _any;
export const FormPageTemplate: any = _any;
export const PageHeader: any = _any;
export const PageContainer: any = _any;
export const Tabs: any = _any;
export const DataTable: any = _any;
export const EmptyState: any = _any;
export const ConfirmDialog: any = _any;
export const Skeleton: any = _any;
export const Menu: any = _any;
export const SearchInput: any = _any;
export const StatusBadge: any = _any;
export const Drawer: any = _any;
export const Textarea: any = _any;

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
export const useConfirm: () => readonly [(opts: { title?: string; message?: string; intent?: 'default' | 'danger'; confirmLabel?: string }) => Promise<boolean>, any] = () => [async () => false, null] as const;
