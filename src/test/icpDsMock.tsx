import React from 'react';
import { vi } from 'vitest';

/** Minimal stand-ins for the develop `@so360/design-system` exports the ICP pages use. */
export const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

export const Button = ({ children, onClick, disabled, type = 'button', ...p }: any) => (
  <button type={type} onClick={onClick} disabled={disabled} aria-label={p['aria-label']} data-testid={p['data-testid']}>{children}</button>
);

/** Renders only while open; confirm-yes / confirm-no stand in for the confirm and cancel buttons. */
export const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText }: any) =>
  isOpen ? (
    <div role="dialog" aria-label={title}>
      <p>{message}</p>
      <button type="button" data-testid="confirm-yes" onClick={onConfirm}>{confirmText}</button>
      <button type="button" data-testid="confirm-no" onClick={onClose}>Cancel</button>
    </div>
  ) : null;
