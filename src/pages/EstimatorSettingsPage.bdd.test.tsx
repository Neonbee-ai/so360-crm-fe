import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({ getSettings: vi.fn(), saveSettings: vi.fn(), applyPreset: vi.fn() }));
const flag = vi.hoisted(() => ({ on: true }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../services/estimatorService', async () => {
  const actual = await vi.importActual<any>('../services/estimatorService');
  return { ...actual, estimatorService: svc };
});
vi.mock('../hooks/useCrmFeatureFlag', () => ({ useCrmFeatureFlag: () => flag.on }));
vi.mock('@so360/shell-context', () => ({
  useShellBridge: () => ({}),
  useOrganization: () => ({ currentOrg: { industry_key: 'energy' } }),
}));
vi.mock('@so360/design-system', () => ({
  FormPageTemplate: ({ children, primaryAction }: any) => <div>{primaryAction}{children}</div>,
  Card: ({ children, actions }: any) => <section>{actions}{children}</section>,
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  Spinner: () => <span>loading</span>,
  Switch: ({ checked, onCheckedChange, ...p }: any) => <input type="checkbox" data-testid={p['data-testid']} checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />,
  TextField: ({ value, onChange, ...p }: any) => <input data-testid={p['data-testid']} value={value} onChange={onChange} />,
  NumberInput: ({ value, onChange, ...p }: any) => <input data-testid={p['data-testid']} value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} />,
  Select: ({ options, value, onChange, ...p }: any) => (
    <select data-testid={p['data-testid']} value={value} onChange={onChange}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
  ),
  toast: toastMock,
}));

import EstimatorSettingsPage from './EstimatorSettingsPage';

const base = {
  industry_key: 'energy', is_default: true,
  finance_products: [{ id: 'cash', name: 'Cash', apr_pct: 0, term_months: 0, down_payment_pct: 100, dealer_fee_pct: 0, is_active: true }],
  incentive_rules: [{ id: 'itc', name: 'ITC', type: 'percent', value: 30, cap: null, applies_before_tax: false, is_active: true }],
  production: { enabled: true, specific_yield_kwh_per_kw_year: 1400, degradation_pct_per_year: 0.5, tariff_per_kwh: 0, tariff_escalation_pct: 0, lifetime_years: 25 },
};

beforeEach(() => {
  vi.clearAllMocks();
  flag.on = true;
  svc.getSettings.mockResolvedValue(base);
  svc.saveSettings.mockResolvedValue({ ...base, is_default: false });
  svc.applyPreset.mockResolvedValue({ ...base, industry_key: 'construction' });
});

describe('Given the estimator flag is off', () => {
  it('When the page renders Then nothing shows', () => {
    flag.on = false;
    const { container } = render(<EstimatorSettingsPage />);
    expect(container.firstChild).toBeNull();
  });
});

describe('Given the settings page', () => {
  it('When loaded Then the org industry seeds the default request and preset picker', async () => {
    render(<EstimatorSettingsPage />);
    await waitFor(() => expect(screen.getByTestId('estimator-save')).toBeTruthy());
    expect(svc.getSettings).toHaveBeenCalledWith('energy');
    expect((screen.getByTestId('estimator-preset') as HTMLSelectElement).value).toBe('energy');
  });

  it('When a tariff is edited and saved Then the full settings are PUT', async () => {
    render(<EstimatorSettingsPage />);
    await waitFor(() => expect(screen.getByTestId('estimator-tariff')).toBeTruthy());
    fireEvent.change(screen.getByTestId('estimator-tariff'), { target: { value: '0.15' } });
    fireEvent.click(screen.getByTestId('estimator-save'));
    await waitFor(() => expect(svc.saveSettings).toHaveBeenCalled());
    expect(svc.saveSettings.mock.calls[0][0].production.tariff_per_kwh).toBe(0.15);
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('When Apply industry preset is pressed Then the chosen preset is applied', async () => {
    render(<EstimatorSettingsPage />);
    await waitFor(() => expect(screen.getByTestId('estimator-apply-preset')).toBeTruthy());
    fireEvent.change(screen.getByTestId('estimator-preset'), { target: { value: 'construction' } });
    fireEvent.click(screen.getByTestId('estimator-apply-preset'));
    await waitFor(() => expect(svc.applyPreset).toHaveBeenCalledWith('construction'));
  });

  it('When Add product is pressed Then a new row appears', async () => {
    render(<EstimatorSettingsPage />);
    await waitFor(() => expect(screen.getByTestId('estimator-add-product')).toBeTruthy());
    fireEvent.click(screen.getByTestId('estimator-add-product'));
    expect(screen.getByTestId('estimator-product-1')).toBeTruthy();
  });

  it('When save fails Then an error toast shows', async () => {
    svc.saveSettings.mockRejectedValue(new Error('boom'));
    render(<EstimatorSettingsPage />);
    await waitFor(() => expect(screen.getByTestId('estimator-save')).toBeTruthy());
    fireEvent.click(screen.getByTestId('estimator-save'));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('boom'));
  });
});
