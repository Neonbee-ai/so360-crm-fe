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
