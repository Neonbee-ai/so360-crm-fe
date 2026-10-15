import React from 'react';
import { vi } from 'vitest';

/** Minimal Comb stand-ins for the ICP pages' BDD specs. */
export const confirmResult = { value: true };
export const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

export const Button = ({ children, onClick, disabled, type = 'button', ...p }: any) => (
  <button type={type} onClick={onClick} disabled={disabled} aria-label={p['aria-label']} data-testid={p['data-testid']}>{children}</button>
);
export const Badge = ({ children }: any) => <span data-testid="badge">{children}</span>;
export const Spinner = () => <span data-testid="spinner" />;
export const Card = ({ title, children }: any) => <section aria-label={title}><h2>{title}</h2>{children}</section>;
export const EmptyState = ({ title, description, action }: any) => (
  <div role="status"><h3>{title}</h3><p>{description}</p>{action && <button type="button" onClick={action.onClick}>{action.label}</button>}</div>
);
export const ListPageTemplate = ({ title, description, primaryAction, children }: any) => (
  <section><h1>{title}</h1><p>{description}</p>{primaryAction}{children}</section>
);
export const DetailPageTemplate = ({ title, onBack, children, sidePanel }: any) => (
  <section><h1>{title}</h1><button type="button" onClick={onBack}>Back</button><div>{children}</div><aside>{sidePanel}</aside></section>
);
export const FormSection = ({ title, children }: any) => <fieldset><legend>{title}</legend>{children}</fieldset>;
export const Menu = ({ items, trigger }: any) => (
  <div>{trigger}{items.map((i: any) => <button key={i.label} type="button" onClick={i.onSelect}>{i.label}</button>)}</div>
);
export const useConfirm = () => [
  async () => confirmResult.value,
  null,
] as const;
export const TextField = ({ label, value, onChange, error, name, ...p }: any) => (
  <label>{label}<input name={name} value={value ?? ''} onChange={onChange} data-testid={p['data-testid']} />{error && <span role="alert">{error}</span>}</label>
);
export const Textarea = ({ label, value, onChange, name, ...p }: any) => (
  <label>{label}<textarea name={name} value={value ?? ''} onChange={onChange} data-testid={p['data-testid']} /></label>
);
export const Select = ({ label, value, onChange, options, name, ...p }: any) => (
  <label>{label}<select name={name} value={value ?? ''} onChange={onChange} data-testid={p['data-testid']}>
    {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select></label>
);
export const NumberInput = ({ label, value, onChange, name, ...p }: any) => (
  <label>{label}<input type="number" name={name} value={value ?? ''} data-testid={p['data-testid']}
    onChange={(e) => onChange?.(e.target.value === '' ? null : Number(e.target.value))} /></label>
);
export const Switch = ({ label, checked, onCheckedChange, ...p }: any) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} data-testid={p['data-testid']}
    onClick={() => onCheckedChange(!checked)}>{label}</button>
);
/** Comma-separated text stands in for the chip input. */
export const TagInput = ({ label, value, onChange, ...p }: any) => (
  <label>{label}<input value={(value ?? []).join(',')} data-testid={p['data-testid']}
    onChange={(e) => onChange(e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean))} /></label>
);
