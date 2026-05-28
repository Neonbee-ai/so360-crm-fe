// Stub for @so360/design-system — vi.mock() in each test overrides these
import React from 'react';
export const Button = ({ children, onClick, type, disabled, ...rest }: any) =>
  React.createElement('button', { onClick, type, disabled, 'data-testid': rest['data-testid'] }, children);
export const Input = ({ onChange, value, placeholder, type, ...rest }: any) =>
  React.createElement('input', { onChange, value, placeholder, type, 'data-testid': rest['data-testid'] });
export const Select = ({ children, onChange, value, ...rest }: any) =>
  React.createElement('select', { onChange, value, 'data-testid': rest['data-testid'] }, children);
export const Modal = ({ children, isOpen }: any) =>
  isOpen ? React.createElement(React.Fragment, null, children) : null;
export const Card = ({ children }: any) => React.createElement('div', null, children);
export const Badge = ({ children }: any) => React.createElement('span', null, children);
export const Spinner = () => null;
export const Tooltip = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const QuotaGate = ({ children }: any) => React.createElement(React.Fragment, null, children);
export const QuotaBar = () => null;
export const Pagination = () => null;
export const DeleteConfirmDialog = () => null;
