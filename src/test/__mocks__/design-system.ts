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
export const QuotaBar = () => null;
export const Pagination = () => null;
export const DeleteConfirmDialog = () => null;
