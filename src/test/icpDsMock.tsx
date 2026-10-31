import React from 'react';
import { vi } from 'vitest';
import { Trail } from './__mocks__/design-system';

/** Shared Comb stub + ICP-specific stand-ins (form controls, flat row menu, toast spies, confirm dialog). */
export * from './__mocks__/design-system';
export const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

export const Spinner = () => <span aria-label="Loading" />;
export const Skeleton = (_p: Record<string, unknown>) => <div data-testid="skeleton" />;

/** Row menu rendered flat (items always present) so specs can click actions without opening a popover. */
export const Menu = ({ trigger, items = [] }: any) => (
  <>
    {trigger}
    {items.map((it: any) => <button key={it.label} type="button" onClick={it.onSelect}>{it.label}</button>)}
  </>
);

export const ListPageTemplate = (p: any) => (
  <div data-template="list">
    <header data-slot="header">
      <h1>{p.title}</h1>
      {p.description ? <p>{p.description}</p> : null}
      {p.primaryAction}
    </header>
    {p.isEmpty ? p.empty : p.children}
  </div>
);

export const FormPageTemplate = (p: any) => (
  <div data-template="form">
    <header data-slot="header">
      <Trail {...p} />
      <h1>{p.title}</h1>
    </header>
    {p.children}
    <footer data-slot="footer">{p.secondaryAction}{p.primaryAction}</footer>
  </div>
);

export const FormSection = ({ title, description, children }: any) => (
  <fieldset><legend>{title}</legend>{description ? <p>{description}</p> : null}{children}</fieldset>
);

export const TextField = ({ label, name, error, value, onChange, required, 'data-testid': testId }: any) => (
  <label>{label}<input name={name} required={required} value={value ?? ''} onChange={onChange} data-testid={testId} />{error ? <span role="alert">{error}</span> : null}</label>
);

export const Textarea = ({ label, name, rows, value, onChange, 'data-testid': testId }: any) => (
  <label>{label}<textarea name={name} rows={rows} value={value ?? ''} onChange={onChange} data-testid={testId} /></label>
);

export const Switch = ({ label, checked, onCheckedChange, 'data-testid': testId }: any) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} data-testid={testId} onClick={() => onCheckedChange(!checked)}>{label}</button>
);

export const NumberInput = ({ label, name, value, onChange, min, max, 'data-testid': testId }: any) => (
  <label>{label}
    <input
      type="number" name={name} min={min} max={max} value={value ?? ''} data-testid={testId}
      onChange={(e: any) => onChange?.(e.target.value === '' ? null : Number(e.target.value))}
    />
  </label>
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

