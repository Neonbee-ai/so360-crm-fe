// Stub for @so360/design-system — vi.mock() in each test overrides these
import React from 'react';
export const Button = ({ children, onClick, type, disabled, leftIcon: _l, rightIcon: _r, variant: _v, size: _s, loading: _ld, fullWidth: _f, ...rest }: any) =>
  React.createElement('button', { onClick, type, disabled, ...rest }, children);
export const Input = (props: any) => props;
export const Select = ({ value, onChange, options = [], placeholder, ...rest }: any) =>
  React.createElement('select', { value: value ?? '', onChange: (e: any) => onChange?.(e.target.value), 'aria-label': rest['aria-label'] ?? placeholder, 'data-testid': rest['data-testid'] },
    options.map((o: any) => React.createElement('option', { key: String(o.value), value: o.value }, o.label)));
export const Modal = (props: any) => props;
export const Card = ({ title, actions, footer, children, 'data-testid': testId }: any) =>
    React.createElement('div', { 'data-testid': testId }, title ? React.createElement('h3', null, title) : null, actions, children, footer);
export const Badge = ({ children, onClick, tone, size, 'data-testid': testId }: any) =>
  React.createElement('span', { onClick, 'data-testid': testId, 'data-tone': tone, 'data-size': size }, children);
export const Spinner = (props: any) => props;
export const Tooltip = (props: any) => props;
export const QuotaGate = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const QuotaBar = ({ used, limit, isUnlimited, label }: any) =>
  React.createElement('div', { 'data-testid': 'quota-bar', 'data-used': String(used ?? 0), 'data-unlimited': String(!!isUnlimited) }, `${label ?? ''}: ${used ?? 0}`);
export const Pagination = ({ page, currentPage, pageSize, total, totalItems }: any) =>
  React.createElement('nav', { 'data-testid': 'pagination', 'data-page': String(page ?? currentPage ?? ''), 'data-size': String(pageSize ?? ''), 'data-total': String(total ?? totalItems ?? '') });
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


// Comb page templates — slots render in template order with data-slot markers so specs can assert layout contract.
const slot = (name: string, node: any) => (node ? React.createElement('div', { 'data-slot': name }, node) : null);
export const ListPageTemplate = (p: any) =>
  React.createElement('div', { 'data-template': 'list' },
    React.createElement('header', { 'data-slot': 'header' },
      React.createElement('h1', null, p.title), p.count != null ? React.createElement('span', { 'data-slot': 'count' }, p.count) : null,
      slot('primary', p.primaryAction), slot('secondary', p.headerSecondaryActions), slot('overflow', Array.isArray(p.overflowActions) ? p.overflowActions.map((a: any) => React.createElement('button', { key: a.label, onClick: a.onSelect }, a.label)) : p.overflowActions)),
    slot('kpis', p.kpis),
    React.createElement('div', { 'data-slot': 'toolbar' }, p.search, p.filters, p.toolbarEnd),
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
