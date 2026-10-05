// Stub for @so360/design-system — vi.mock() in each test overrides these
import React from 'react';
export const Button = ({ children, onClick, type, disabled }: any) =>
  React.createElement('button', { onClick, type, disabled }, children);
export const Input = (props: any) => props;
export const Select = (props: any) => props;
export const Modal = (props: any) => props;
export const Card = (props: any) => props;
export const Badge = (props: any) => props;
export const Spinner = (props: any) => props;
export const Tooltip = (props: any) => props;
export const QuotaGate = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const QuotaBar = ({ used, limit, isUnlimited, label }: any) =>
  React.createElement('div', { 'data-testid': 'quota-bar', 'data-used': String(used ?? 0), 'data-unlimited': String(!!isUnlimited) }, `${label ?? ''}: ${used ?? 0}`);
export const Pagination = () => null;
export const DeleteConfirmDialog = () => null;
export const CrossLinkChip = ({ label, id }: any) =>
  React.createElement('span', { 'data-testid': 'cross-link-chip' }, label ?? id ?? '');
export const RelatedRecordsPanel = () => null;

// SortableHeader — same contract as the real <th> header (label + onSort).
export const SortableHeader = ({ label, field, currentSort, onSort, sortable = true }: any) => {
  const active = currentSort?.field === field ? currentSort.direction : null;
  return React.createElement(
    'th',
    { onClick: () => { if (sortable) onSort(field); }, 'data-sortable': String(sortable), 'data-sort': active ?? '' },
    label,
  );
};

// FilterBar — mirrors the real component's observable behaviour: search box,
// select / multiselect filters, "Clear (n)" and removable "Label: value" chips.
export const FilterBar = ({ filters, activeFilters, onFilterChange, onClearAll, searchPlaceholder = 'Search...', searchValue = '', onSearchChange }: any) => {
  const [open, setOpen] = React.useState<string | null>(null);
  const count =
    Object.values(activeFilters as Record<string, string | string[]>).reduce<number>(
      (n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0),
      0,
    ) + (searchValue ? 1 : 0);
  const labelOf = (f: any, v: string) => f.options?.find((o: any) => o.value === v)?.label || v;
  return React.createElement(
    'div',
    { 'data-testid': 'filter-bar' },
    onSearchChange &&
      React.createElement('input', { type: 'text', value: searchValue, placeholder: searchPlaceholder, onChange: (e: any) => onSearchChange(e.target.value) }),
    ...filters.map((f: any) => {
      const value = activeFilters[f.key];
      if (f.type === 'multiselect') {
        const selected: string[] = value || [];
        return React.createElement(
          'div',
          { key: f.key },
          React.createElement('button', { onClick: () => setOpen(open === f.key ? null : f.key) }, selected.length ? `${f.label} (${selected.length})` : f.placeholder || f.label),
          open === f.key &&
            f.options.map((o: any) =>
              React.createElement(
                'label',
                { key: o.value },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: selected.includes(o.value),
                  onChange: (e: any) => {
                    const next = e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value);
                    onFilterChange(f.key, next.length ? next : null);
                  },
                }),
                o.label,
              ),
            ),
        );
      }
      return React.createElement(
        'select',
        { key: f.key, 'aria-label': f.label, value: value || '', onChange: (e: any) => onFilterChange(f.key, e.target.value || null) },
        React.createElement('option', { value: '' }, f.placeholder || `All ${f.label}`),
        ...f.options.map((o: any) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
      );
    }),
    count > 0 && React.createElement('button', { onClick: onClearAll }, `Clear (${count})`),
    searchValue &&
      React.createElement('span', { 'data-testid': 'chip' }, `Search: ${searchValue}`, React.createElement('button', { 'aria-label': 'Remove Search', onClick: () => onSearchChange?.('') }, 'x')),
    ...Object.entries(activeFilters as Record<string, string | string[]>).map(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return null;
      const f = filters.find((x: any) => x.key === key);
      if (!f) return null;
      const text = Array.isArray(value) ? value.map((v) => labelOf(f, v)).join(', ') : labelOf(f, value);
      return React.createElement('span', { key, 'data-testid': 'chip' }, `${f.label}: ${text}`, React.createElement('button', { 'aria-label': `Remove ${f.label}`, onClick: () => onFilterChange(key, null) }, 'x'));
    }),
  );
};

// FeatureGate / FeatureRoute — 5-state model
export type FeatureState = 'enabled' | 'read_only' | 'locked' | 'disabled' | 'hidden';
export interface FeatureRouteProps {
  state: string;
  loading?: boolean;
  children: React.ReactNode;
  hiddenFallback?: React.ReactNode;
  lockedFallback?: React.ReactNode;
  disabledFallback?: React.ReactNode;
}
export const FeatureRoute = ({ state, loading, children, hiddenFallback = null, lockedFallback, disabledFallback }: FeatureRouteProps): React.ReactElement | null => {
  if (loading) return null;
  if (state === 'hidden') return (hiddenFallback as React.ReactElement) ?? null;
  if (state === 'locked') return (lockedFallback as React.ReactElement) ?? null;
  if (state === 'disabled') return (disabledFallback as React.ReactElement) ?? null;
  return React.createElement(React.Fragment, null, children);
};
export interface FeatureGateProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
export const FeatureGate = ({ loading, children }: any): any => loading ? null : React.createElement(React.Fragment, null, children);

// Universal toast — plain functions so specs can vi.spyOn(toast, 'success') etc.
export const toast = {
  success: (_message: string, _opts?: any) => 'toast-id',
  error: (_message: string, _opts?: any) => 'toast-id',
  warning: (_message: string, _opts?: any) => 'toast-id',
  info: (_message: string, _opts?: any) => 'toast-id',
  promise: (p: any, _msgs?: any) => p,
  dismiss: (_id?: string) => {},
};
export const useToast = () => toast;
export const getErrorMessage = (_e: any, fallback?: string) => fallback ?? 'error';
export const attachToastErrorHandler = () => 0;
export const toastBus = {
  show: () => {},
  dismiss: () => {},
  subscribe: () => () => {},
  getToasts: () => [],
};

// People Connect selectors — clicking the stub picks fixed ids so specs can
// drive onChange without the real dropdown.
export const DepartmentSelector = ({ value, onChange, placeholder }: any) =>
  React.createElement('button', { type: 'button', 'data-testid': 'department-selector', 'data-value': value ?? '', onClick: () => onChange('dept-1') }, placeholder ?? 'Department');
export const UserSelector = ({ value, onChange, multiSelect, placeholder }: any) =>
  React.createElement('button', {
    type: 'button',
    'data-testid': 'user-selector',
    'data-value': Array.isArray(value) ? value.join(',') : (value ?? ''),
    onClick: () => onChange(multiSelect ? ['user-1', 'user-2'] : 'user-1'),
  }, placeholder ?? 'User');
