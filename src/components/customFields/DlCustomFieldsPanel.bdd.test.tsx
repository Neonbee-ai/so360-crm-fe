/**
 * BDD specs for DlCustomFieldsPanel (CRM lead/deal custom fields on the Core data layer).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const schemaState = vi.hoisted(() => ({
  value: { fields: [] as any[], isLoading: false, error: null as any },
  code: '' as string,
}));
const panelProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('@so360/shell-context', () => ({
  useDatasetSchema: (code: string) => {
    schemaState.code = code;
    return schemaState.value;
  },
}));

vi.mock('@so360/design-system', () => ({
  Banner: ({ children, ...p }: any) => <div role="alert" data-testid={p['data-testid']}>{children}</div>,
  CustomFieldsPanel: (p: any) => {
    panelProps.current = p;
    return <div data-testid="cf-panel">{p.fields.map((f: any) => f.field_key).join(',')}</div>;
  },
}));

import { DlCustomFieldsPanel, VALIDATION_UNAVAILABLE_MSG } from './DlCustomFieldsPanel';

const FIELDS = [
  { field_key: 'budget', label: 'Budget', field_type: 'number' },
  { field_key: 'sys', label: 'System', field_type: 'text', is_system: true },
];

function renderPanel(over: Partial<React.ComponentProps<typeof DlCustomFieldsPanel>> = {}) {
  const save = vi.fn().mockResolvedValue({});
  const reload = vi.fn();
  render(
    <DlCustomFieldsPanel
      entity="lead" recordId="l1" values={{ budget: 5 }} version={3}
      save={save} reload={reload} {...over}
    />,
  );
  return { save, reload };
}

beforeEach(() => {
  schemaState.value = { fields: FIELDS, isLoading: false, error: null };
  panelProps.current = null;
});

describe('DlCustomFieldsPanel', () => {
  it('Given a lead / When rendered / Then it reads dataset crm.lead and hides system fields', () => {
    renderPanel();
    expect(schemaState.code).toBe('crm.lead');
    expect(screen.getByTestId('cf-panel').textContent).toBe('budget');
    expect(panelProps.current.valuesKey).toBe('custom_fields');
    expect(panelProps.current.record.custom_fields).toEqual({ budget: 5 });
    expect(panelProps.current.version).toBe(3);
  });

  it('Given a deal / When rendered / Then it reads dataset crm.deal', () => {
    renderPanel({ entity: 'deal' });
    expect(schemaState.code).toBe('crm.deal');
  });

  it('Given the schema is loading / Then a loading hint shows and no panel', () => {
    schemaState.value = { fields: [], isLoading: true, error: null };
    renderPanel();
    expect(screen.getByTestId('dl-cf-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('cf-panel')).toBeNull();
  });

  it('Given the schema fails to load / Then a danger banner shows', () => {
    schemaState.value = { fields: [], isLoading: false, error: new Error('x') };
    renderPanel();
    expect(screen.getByTestId('dl-cf-schema-error')).toBeInTheDocument();
  });

  it('When the user saves / Then changed keys and the version are sent and ok is returned', async () => {
    const { save } = renderPanel();
    const res = await panelProps.current.onSave({ budget: 9 }, 3);
    expect(save).toHaveBeenCalledWith({ budget: 9 }, 3);
    expect(res).toEqual({ ok: true });
  });

  it('Given the server answers 409 / Then a conflict result is returned for the reload banner', async () => {
    const err = Object.assign(new Error('stale'), { status: 409 });
    renderPanel({ save: vi.fn().mockRejectedValue(err) });
    const res = await panelProps.current.onSave({ budget: 9 }, 3);
    expect(res.ok).toBe(false);
    expect(res.conflict).toBe(true);
  });

  it('Given the server answers 503 / Then the validation-unavailable message is returned', async () => {
    const err = Object.assign(new Error('Core down'), { status: 503 });
    renderPanel({ save: vi.fn().mockRejectedValue(err) });
    const res = await panelProps.current.onSave({ budget: 9 }, 3);
    expect(res.ok).toBe(false);
    expect(res.conflict).toBeUndefined();
    expect(res.error.message).toBe(VALIDATION_UNAVAILABLE_MSG);
  });

  it('Given another failure / Then the original error is surfaced', async () => {
    const err = Object.assign(new Error('Invalid custom fields'), { status: 400 });
    renderPanel({ save: vi.fn().mockRejectedValue(err) });
    const res = await panelProps.current.onSave({ budget: 'x' }, 3);
    expect(res.error).toBe(err);
  });

  it('When saved or a reload is requested / Then the host record is refetched', async () => {
    const { reload } = renderPanel();
    panelProps.current.onSaved();
    panelProps.current.onReloadRequest();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(2));
  });

  it('Given a missing version / Then null is sent', async () => {
    const { save } = renderPanel({ version: undefined });
    await panelProps.current.onSave({ budget: 1 }, null);
    expect(save).toHaveBeenCalledWith({ budget: 1 }, null);
  });
});
