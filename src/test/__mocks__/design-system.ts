// Stub for @so360/design-system — vi.mock() in each test overrides these
import React from 'react';
export const Button = ({ children, onClick, type, disabled, leftIcon: _l, rightIcon: _r, variant: _v, size: _s, loading: _ld, fullWidth: _f, ...rest }: any) =>
  React.createElement('button', { onClick, type, disabled, ...rest }, children);
export const Input = (props: any) => props;
// ---- Form primitives: render native elements carrying label, testid, value/onChange ----
const FieldWrap = ({ id, label, hint, error, children }: any) =>
  label || hint || error
    ? React.createElement('div', null,
        label ? React.createElement('label', { htmlFor: id }, label) : null,
        children,
        hint ? React.createElement('p', null, hint) : null,
        error ? React.createElement('p', { role: 'alert' }, error) : null)
    : children;
export const TextField = ({ label, hint, error, required, name, id, size: _s, leadingIcon: _li, 'data-testid': testId, ...rest }: any) => {
  const fid = label ? `f-${name}` : id;
  return React.createElement(FieldWrap, { id: fid, label, hint, error },
    React.createElement('input', { ...rest, id: fid, name, required, 'data-testid': testId, 'aria-invalid': error ? true : undefined }));
};
export const Textarea = ({ label, hint, error, required, name, id, size: _s, 'data-testid': testId, ...rest }: any) => {
  const fid = label ? `f-${name}` : id;
  return React.createElement(FieldWrap, { id: fid, label, hint, error },
    React.createElement('textarea', { ...rest, id: fid, name, required, 'data-testid': testId, 'aria-invalid': error ? true : undefined }));
};
export const Select = ({ value, onChange, options = [], placeholder, label, hint: _h, error, size: _sz, required, name, className: _c, ...rest }: any) => {
  const el = React.createElement('select', { id: rest.id ?? (label ? `f-${name}` : undefined), name, required, disabled: rest.disabled, value: value ?? '', onChange: (e: any) => onChange?.(e), 'aria-label': rest['aria-label'] ?? (label ? undefined : placeholder), 'data-testid': rest['data-testid'] },
    placeholder ? React.createElement('option', { key: '__ph', value: '', disabled: true }, placeholder) : null,
    options.map((o: any) => React.createElement('option', { key: String(o.value), value: o.value, disabled: o.disabled }, o.label)));
  return label || error ? React.createElement('div', null, label ? React.createElement('label', { htmlFor: el?.props?.id ?? `f-${name}` }, label) : null, el, error ? React.createElement('p', { role: 'alert' }, error) : null) : el;
};
export const Modal = ({ open, onClose, title, description, footer, children, dismissible = true, 'data-testid': testId }: any) =>
  open
    ? React.createElement('div', { role: 'dialog', 'aria-modal': 'true', 'data-testid': testId },
        React.createElement('h2', null, title),
        description ? React.createElement('div', null, description) : null,
        React.createElement('button', { type: 'button', 'aria-label': 'Close', disabled: !dismissible, onClick: dismissible ? onClose : undefined }, 'x'),
        React.createElement('div', null, children),
        footer ? React.createElement('div', null, footer) : null)
    : null;
export const Drawer = ({ isOpen, onClose, title, subtitle, footer, toolbar, children, 'data-testid': testId }: any) =>
  isOpen
    ? React.createElement('aside', { role: 'dialog', 'aria-label': typeof title === 'string' ? title : undefined, 'data-testid': testId },
        React.createElement('h2', null, title),
        subtitle ? React.createElement('p', null, subtitle) : null,
        React.createElement('button', { type: 'button', 'aria-label': 'Close', onClick: onClose }, 'x'),
        toolbar ?? null,
        React.createElement('div', null, children),
        footer ? React.createElement('div', null, footer) : null)
    : null;
export const PortalProvider = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const usePortalContainer = () => (typeof document !== 'undefined' ? document.body : null);
export const Card = ({ title, actions, footer, children, 'data-testid': testId }: any) =>
    React.createElement('div', { 'data-testid': testId }, title ? React.createElement('h3', null, title) : null, actions, children, footer);
export const Badge = ({ children, onClick, tone, size, 'data-testid': testId }: any) =>
  React.createElement('span', { onClick, 'data-testid': testId, 'data-tone': tone, 'data-size': size }, children);
export const Spinner = (props: any) => props;
export const Tooltip = (props: any) => props;
export const QuotaGate = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const QuotaBar = ({ used, limit, isUnlimited, label }: any) =>
  React.createElement('div', { 'data-testid': 'quota-bar', 'data-used': String(used ?? 0), 'data-unlimited': String(!!isUnlimited) }, `${label ?? ''}: ${used ?? 0}`);
export const Pagination = ({ page, currentPage, pageSize, pageSizeOptions, onPageSizeChange, total, totalItems, totalPages, onPageChange }: any) => {
  const cur = Number(page ?? currentPage ?? 1);
  const pages = totalPages ?? 1;
  return React.createElement('nav', { 'data-testid': 'pagination', 'data-page': String(page ?? currentPage ?? ''), 'data-size': String(pageSize ?? ''), 'data-total': String(total ?? totalItems ?? '') },
    onPageChange ? React.createElement('button', { type: 'button', disabled: cur <= 1, onClick: () => onPageChange(cur - 1) }, 'Previous') : null,
    onPageChange ? React.createElement('span', null, `Page ${cur} of ${pages}`) : null,
    onPageChange ? React.createElement('button', { type: 'button', disabled: cur >= pages, onClick: () => onPageChange(cur + 1) }, 'Next') : null,
    onPageSizeChange && pageSizeOptions ? React.createElement('select', { 'aria-label': 'Rows per page', value: String(pageSize), onChange: (e: any) => onPageSizeChange(Number(e.target.value)) }, ...pageSizeOptions.map((o: number) => React.createElement('option', { key: o, value: String(o) }, String(o)))) : null);
};
export const DeleteConfirmDialog = () => null;
export const CrossLinkChip = ({ label, id }: any) =>
  React.createElement('span', { 'data-testid': 'cross-link-chip' }, label ?? id ?? '');
export const RelatedRecordsPanel = () => null;

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

// useConfirm — specs control the answer via mockConfirm.mockResolvedValueOnce(false)
import { vi } from 'vitest';
export const mockConfirm = vi.fn(async (_opts?: any) => true);
export const useConfirm = () => [mockConfirm, null] as const;


// ListFilters stub — quick fields inline, `Filters · N` button toggles a drawer with all fields, chips for applied values.
const lfActive = (v: any) => v != null && v !== '' && v !== false && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'object' && !Array.isArray(v) && !Object.values(v).some((x) => x != null && x !== ''));
const lfControl = (f: any, values: any, onChange: (v: any) => void, setOne: (k: string, v: any) => void) => {
  const v = values[f.key];
  const name = `filter-${f.key}`;
  if (f.type === 'custom') return React.createElement('div', { key: f.key, 'data-testid': name }, f.render?.(v, (n: any) => setOne(f.key, n)));
  if (f.type === 'select')
    return React.createElement('select', { key: f.key, 'aria-label': f.label, 'data-testid': name, value: typeof v === 'string' ? v : '', onChange: (e: any) => setOne(f.key, e.target.value || null) },
      React.createElement('option', { value: '' }, f.label), (f.options ?? []).map((o: any) => React.createElement('option', { key: o.value, value: o.value }, o.label)));
  if (f.type === 'multiselect')
    return React.createElement('select', { key: f.key, multiple: true, 'aria-label': f.label, 'data-testid': name, value: Array.isArray(v) ? v : [], onChange: (e: any) => setOne(f.key, Array.from(e.target.selectedOptions).map((o: any) => o.value)) },
      (f.options ?? []).map((o: any) => React.createElement('option', { key: o.value, value: o.value }, o.label)));
  if (f.type === 'boolean')
    return React.createElement('input', { key: f.key, type: 'checkbox', 'aria-label': f.label, 'data-testid': name, checked: !!v, onChange: (e: any) => setOne(f.key, e.target.checked || null) });
  if (f.type === 'daterange')
    return React.createElement('span', { key: f.key }, ['start', 'end'].map((side) => React.createElement('input', { key: side, type: 'date', 'aria-label': `${f.label} ${side}`, 'data-testid': `${name}-${side}`, value: (v as any)?.[side] ?? '', onChange: (e: any) => setOne(f.key, { ...(v as any), [side]: e.target.value }) })));
  if (f.type === 'numberrange')
    return React.createElement('span', { key: f.key }, ['min', 'max'].map((side) => React.createElement('input', { key: side, type: 'number', 'aria-label': `${f.label} ${side}`, 'data-testid': `${name}-${side}`, value: (v as any)?.[side] ?? '', onChange: (e: any) => setOne(f.key, { ...(v as any), [side]: e.target.value === '' ? null : Number(e.target.value) }) })));
  return React.createElement('input', { key: f.key, type: f.type === 'date' ? 'date' : 'text', 'aria-label': f.label, 'data-testid': name, value: typeof v === 'string' ? v : '', onChange: (e: any) => setOne(f.key, e.target.value || null) });
};
export const ListFilters = ({ fields = [], values = {}, onChange, onClear }: any) => {
  const [open, setOpen] = React.useState(false);
  const setOne = (k: string, v: any) => onChange({ ...values, [k]: v });
  const quick = fields.filter((f: any) => f.quick).slice(0, 3);
  const activeFields = fields.filter((f: any) => lfActive(values[f.key]));
  const drawerCount = activeFields.filter((f: any) => !f.quick).length;
  return React.createElement(React.Fragment, null,
    quick.map((f: any) => lfControl(f, values, onChange, setOne)),
    React.createElement('button', { type: 'button', 'data-testid': 'filters-button', onClick: () => setOpen((o) => !o) }, drawerCount ? `Filters · ${drawerCount}` : 'Filters'),
    open ? React.createElement('div', { role: 'dialog', 'aria-label': 'Filters', 'data-testid': 'filters-drawer' },
      fields.filter((f: any) => !f.quick).map((f: any) => React.createElement('label', { key: f.key }, f.label, lfControl(f, values, onChange, setOne))),
      React.createElement('button', { type: 'button', onClick: onClear }, 'Clear'),
      React.createElement('button', { type: 'button', onClick: () => setOpen(false) }, 'Apply')) : null,
    activeFields.length ? React.createElement('div', { 'data-testid': 'filter-chips' },
      activeFields.map((f: any) => React.createElement('button', { key: f.key, type: 'button', 'aria-label': `Remove ${f.label} filter`, onClick: () => setOne(f.key, null) }, `${f.label}: ${f.formatValue ? f.formatValue(values[f.key]) : Array.isArray(values[f.key]) ? values[f.key].join(', ') : String(f.options?.find((o: any) => o.value === values[f.key])?.label ?? (typeof values[f.key] === 'object' ? '' : values[f.key]))}`)),
      React.createElement('button', { type: 'button', onClick: onClear }, 'Clear all')) : null);
};
export const SearchInput = ({ value, onChange, onSearch, onClear: _oc, debounceMs: _d, loading: _l, shortcutHint: _s, size: _sz, placeholder, 'data-testid': testId, ...rest }: any) =>
  React.createElement('input', { type: 'search', placeholder, 'aria-label': rest['aria-label'] ?? placeholder, 'data-testid': testId, value: value ?? '', onChange: (e: any) => { onChange?.(e.target.value); onSearch?.(e.target.value); } });

// Comb page templates — slots render in template order with data-slot markers so specs can assert layout contract.
const slot = (name: string, node: any) => (node ? React.createElement('div', { 'data-slot': name }, node) : null);
export const ListPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'list' },
    React.createElement('header', { 'data-slot': 'header' },
      React.createElement('h1', null, p.title), p.count != null ? React.createElement('span', { 'data-slot': 'count' }, p.count) : null,
      slot('primary', p.primaryAction), slot('secondary', p.headerSecondaryActions), slot('overflow', Array.isArray(p.overflowActions) ? p.overflowActions.map((a: any) => React.createElement('button', { key: a.label, onClick: a.onSelect }, a.label)) : p.overflowActions)),
    slot('kpis', p.kpis),
    React.createElement('div', { 'data-slot': 'toolbar' }, p.search, p.filterConfig ? React.createElement(ListFilters, p.filterConfig) : null, p.filters, p.toolbar, p.toolbarEnd),
    p.loading ? React.createElement('div', { 'data-slot': 'skeleton' }) : null,
    !p.loading && p.isEmpty ? React.createElement('div', { 'data-slot': 'empty' }, p.empty) : null,
    !p.loading && p.isFilteredEmpty ? React.createElement('div', { 'data-slot': 'filtered-empty' }, React.createElement('button', { onClick: p.onClearFilters }, 'Clear filters')) : null,
    !p.isEmpty ? p.children : null,
    slot('pagination', p.pagination));
export const DetailPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'detail' },
    React.createElement('header', { 'data-slot': 'header' },
      p.onBack ? React.createElement('button', { 'aria-label': p.backLabel ?? 'Back', onClick: p.onBack }) : null,
      React.createElement('h1', null, p.title), slot('status', p.status), slot('meta', p.meta),
      slot('secondary', p.secondaryActions && React.createElement(React.Fragment, null, ...p.secondaryActions)),
      slot('primary', p.primaryAction),
      slot('overflow', p.overflowActions && p.overflowActions.map((a: any) =>
        React.createElement('button', { key: a.label, onClick: a.onSelect, 'data-danger': String(!!a.danger) }, a.label)))),
    p.tabs ? React.createElement('div', { 'data-slot': 'tabs', role: 'tablist' }, p.tabs.map((t: any) =>
      React.createElement('button', { key: t.id, role: 'tab', 'aria-selected': t.id === p.activeTab, onClick: () => p.onTabChange?.(t.id) }, t.label))) : null,
    p.loading ? React.createElement('div', { 'data-slot': 'skeleton' }) : null,
    React.createElement('main', { 'data-slot': 'main' }, p.children),
    slot('rail', p.sidePanel));
export const FormPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'form' },
    React.createElement('header', { 'data-slot': 'header' }, React.createElement('h1', null, p.title)),
    (p.sections ?? []).map((sec: any) => React.createElement('section', { key: sec.id, 'data-slot': 'section' }, React.createElement('h2', null, sec.title), sec.content)),
    p.children,
    React.createElement('footer', { 'data-slot': 'footer' }, p.destructiveAction,
      p.onCancel ? React.createElement('button', { type: 'button', onClick: p.onCancel }, p.cancelLabel ?? 'Cancel') : null, p.secondaryAction, p.primaryAction));
export const EmptyState = ({ title, description, action }: any) =>
  React.createElement('div', { 'data-testid': 'empty-state' }, React.createElement('p', null, title), description ? React.createElement('p', null, description) : null,
    action ? (React.isValidElement(action) ? action : React.createElement('button', { onClick: (action as any).onClick }, (action as any).label)) : null);
export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: any) =>
  open ? React.createElement('div', { role: 'dialog' }, React.createElement('h2', null, title), React.createElement('p', null, message),
    React.createElement('button', { onClick: onCancel }, cancelLabel), React.createElement('button', { onClick: onConfirm }, confirmLabel)) : null;
export const Tabs = ({ items = [], value, onChange }: any) =>
  React.createElement('div', { role: 'tablist' }, items.map((t: any) =>
    React.createElement('button', { key: t.id, role: 'tab', 'aria-selected': t.id === value, onClick: () => onChange?.(t.id) }, t.label)));
export const Skeleton = () => React.createElement('div', { 'data-testid': 'skeleton' });
export const DashboardPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'dashboard' },
    React.createElement('header', { 'data-slot': 'header' },
      React.createElement('h1', null, p.title), p.description ? React.createElement('p', null, p.description) : null,
      slot('meta', p.meta), slot('secondary-actions', p.secondaryActions), slot('primary-action', p.primaryAction)),
    slot('filters', p.filters), slot('toolbar-end', p.toolbarEnd),
    slot('kpis', p.kpis), slot('primary', p.primary), slot('secondary', p.secondary), slot('bottom', p.bottom), p.children);
export const SettingsPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'settings' },
    React.createElement('header', { 'data-slot': 'header' }, React.createElement('h1', null, p.title),
      p.description ? React.createElement('p', null, p.description) : null, slot('primary-action', p.primaryAction)),
    React.createElement('nav', { 'data-slot': 'sections', role: 'tablist' }, (p.sections ?? []).map((s: any) =>
      React.createElement('button', { key: s.id, role: 'tab', 'aria-selected': s.id === p.activeSection, onClick: () => p.onSectionChange?.(s.id) }, s.label))),
    React.createElement('main', { 'data-slot': 'main' }, p.children));
export const SettingsCard = (p: any) =>
  React.createElement('section', null, p.title ? React.createElement('h2', null, p.title) : null, p.children);
const slugifyId = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Mirrors the real Menu: items render only while open; ids derive from `name`.
export const Menu = ({ trigger, items = [], name, 'data-testid': testId }: any) => {
    const [open, setOpen] = React.useState(false);
    const id = testId ?? (name ? name : 'menu');
    const trig = React.cloneElement(trigger, {
        onClick: (e: any) => { trigger.props?.onClick?.(e); setOpen((o: boolean) => !o); },
        'aria-haspopup': 'menu', 'aria-expanded': open,
    });
    return React.createElement(React.Fragment, null, trig, open ? React.createElement('div', { role: 'menu', 'data-testid': id },
        items.map((it: any, i: number) => React.createElement('button', {
            key: `${it.label}-${i}`, role: 'menuitem', 'data-testid': `${id}-${slugifyId(it.label)}`, 'aria-disabled': it.disabled ? 'true' : undefined,
            onClick: (e: any) => { e.stopPropagation(); if (it.disabled) return; it.onSelect(); setOpen(false); },
        }, it.label))) : null);
};
export const KpiCard = ({ label, value, hint, onClick, 'data-testid': testId }: any) =>
    React.createElement('div', { 'data-testid': testId, onClick }, React.createElement('span', null, label), React.createElement('span', null, value),
        hint != null && hint !== false ? React.createElement('span', { 'data-slot': 'kpi-hint' }, hint) : null);
export const StatusBadge = ({ status, 'data-testid': testId }: any) => React.createElement('span', { 'data-testid': testId }, status);
export const Alert = ({ title, children, variant, action, 'data-testid': testId }: any) =>
    React.createElement('div', { role: 'alert', 'data-variant': variant, 'data-testid': testId }, title ? React.createElement('p', null, title) : null, children,
        action ? React.createElement('button', { type: 'button', onClick: action.onClick }, action.label) : null);

export const SegmentedControl = ({ options = [], value, onChange, 'data-testid': testId, 'aria-label': ariaLabel }: any) =>
  React.createElement(
    'div',
    { role: 'radiogroup', 'aria-label': ariaLabel, 'data-testid': testId },
    options.map((o: any) =>
      React.createElement(
        'button',
        { key: o.value, type: 'button', role: 'radio', 'aria-checked': value === o.value, 'aria-pressed': value === o.value, disabled: o.disabled, onClick: () => onChange?.(o.value) },
        o.label,
      ),
    ),
  );

// Form primitive stubs — native elements carrying label, testid, value/onChange.
const fieldWrap = (name: any, label: any, error: any, el: any, id?: any) =>
  label || error ? React.createElement('div', null, label ? React.createElement('label', { htmlFor: el?.props?.id ?? `f-${name}` }, label) : null, el, error ? React.createElement('p', { role: 'alert' }, error) : null) : el;
const numberStub = (kind: string) => ({ label, hint: _h, error, size: _sz, name, value, onChange, currency: _cur, locale: _loc, fractionDigits: _fd, allowNegative: _an, defaultValue, ...rest }: any) =>
  fieldWrap(name, label, error, React.createElement('input', {
    id: rest.id ?? (label ? `f-${name}` : undefined), name, type: 'number', 'data-kind': kind,
    ...(value !== undefined ? { value: value ?? '' } : { defaultValue: defaultValue ?? '' }),
    onChange: (e: any) => onChange?.(e.target.value === '' ? null : Number(e.target.value)), ...rest }));
export const NumberInput = numberStub('number');
export const CurrencyInput = numberStub('currency');
export const DatePicker = ({ label, hint: _h, error, size: _sz, name, onChange, weekStartsOn: _w, isDateDisabled: _d, today: _t, trailing: _tr, ...rest }: any) =>
  fieldWrap(name, label, error, React.createElement('input', { id: rest.id ?? (label ? `f-${name}` : undefined), name, type: 'date', onChange: (e: any) => onChange?.(e.target.value), ...rest }));
export const TimePicker = ({ label, hint: _h, error, size: _sz, name, onChange, format: _f, step: _st, minTime: _mi, maxTime: _ma, ...rest }: any) =>
  fieldWrap(name, label, error, React.createElement('input', { id: rest.id ?? (label ? `f-${name}` : undefined), name, type: 'time', onChange: (e: any) => onChange?.(e.target.value), ...rest }));
export const Checkbox = ({ label, description: _d, indeterminate: _i, name, ...rest }: any) =>
  React.createElement('label', null, React.createElement('input', { type: 'checkbox', name, ...rest }), label);
export const Switch = ({ label, name, checked, onCheckedChange, disabled, 'data-testid': testId, ...rest }: any) =>
  React.createElement('button', { type: 'button', role: 'switch', name, 'aria-checked': !!checked, 'aria-label': label, disabled, 'data-testid': testId, onClick: () => onCheckedChange?.(!checked), ...rest });
export const RadioGroup = ({ name, label, options = [], value, onChange, disabled, 'data-testid': testId }: any) =>
  React.createElement('div', { role: 'radiogroup', 'aria-label': label, 'data-testid': testId ?? `radio-${name}` },
    options.map((o: any) => React.createElement('label', { key: o.value }, React.createElement('input', { type: 'radio', name, value: o.value, checked: value === o.value, disabled: disabled || o.disabled, 'data-testid': `radio-${name}-${o.value}`, onChange: () => onChange?.(o.value) }), o.label)));
export const IconButton = ({ label, icon, variant: _v, size: _s, tooltipSide: _t, hideTooltip: _h, ...rest }: any) =>
  React.createElement('button', { type: 'button', 'aria-label': label, title: label, ...rest }, icon);
export const ColumnsMenu = ({ label = 'Columns' }: any) => React.createElement('button', { type: 'button', 'aria-label': label }, label);
export const DataTable = ({ columns = [], rows = [], rowKey, loading, emptyState, onRowClick, rowActions, getRowProps, hiddenColumns, sortKey, sortDir, onSortChange, footer, selectedKeys, onSelectionChange, 'data-testid': testId }: any) => {
  const [open, setOpen] = React.useState<string | null>(null);
  if (loading) return React.createElement('div', { 'data-testid': 'datatable-loading' });
  if (rows.length === 0) return React.createElement('div', null, emptyState);
  const hid = new Set(hiddenColumns ?? []);
  const cols = columns.filter((c: any) => !hid.has(c.key));
  return React.createElement('table', { 'data-testid': testId },
    React.createElement('thead', null, React.createElement('tr', null,
      onSelectionChange ? React.createElement('th', { key: '__sel' }) : null,
      cols.map((c: any) => React.createElement('th', { key: c.key, 'aria-sort': sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined },
        c.sortable && onSortChange
          ? React.createElement('button', { type: 'button', 'data-testid': `${testId ?? 'datatable'}-sort-${c.key}`, onClick: () => onSortChange(c.key, sortKey === c.key && sortDir === 'asc' ? 'desc' : 'asc') }, c.header)
          : c.header)),
      rowActions ? React.createElement('th', { key: '__act' }) : null)),
    React.createElement('tbody', null, rows.map((r: any) => {
      const key = rowKey(r);
      const { className: _cn, ...rp } = getRowProps?.(r) ?? {};
      return React.createElement('tr', { key, ...rp, onClick: onRowClick ? () => onRowClick(r) : undefined },
        onSelectionChange ? React.createElement('td', { key: '__sel' }, React.createElement('input', { type: 'checkbox', 'aria-label': 'Select row', checked: !!selectedKeys?.has(key), onClick: (e: any) => e.stopPropagation(), onChange: () => { const n = new Set(selectedKeys ?? []); n.has(key) ? n.delete(key) : n.add(key); onSelectionChange(n); } })) : null,
        cols.map((c: any) => React.createElement('td', { key: c.key, 'data-align': c.align }, c.render ? c.render(r) : String(r[c.key] ?? ''))),
        rowActions ? React.createElement('td', { key: '__act', onClick: (e: any) => e.stopPropagation() },
          React.createElement('button', { type: 'button', 'aria-label': 'Row actions', 'data-testid': `${testId ?? 'datatable'}-actions-${key}`, onClick: () => setOpen(open === key ? null : key) }, 'Actions'),
          open === key ? React.createElement('div', { role: 'menu' }, rowActions(r).map((it: any, i: number) => React.createElement('button', { key: `${it.label}-${i}`, role: 'menuitem', disabled: it.disabled, onClick: () => { it.onSelect(); setOpen(null); } }, it.label))) : null) : null);
    })),
    footer ? React.createElement('tfoot', null, React.createElement('tr', null, React.createElement('td', { colSpan: cols.length + 2 }, footer))) : null);
};
export const DateTimePicker = ({ label, hint: _h, error, name, onChange, defaultTime: _dt, minDate: _mi, maxDate: _ma, format: _f, step: _st, today: _t, ...rest }: any) =>
  fieldWrap(name, label, error, React.createElement('input', { id: rest.id ?? (label ? `f-${name}` : undefined), name, type: 'datetime-local', onChange: (e: any) => onChange?.(e.target.value), ...rest }));
