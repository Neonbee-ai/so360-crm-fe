import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const svc = vi.hoisted(() => ({ getSettings: vi.fn(), compute: vi.fn() }));
const flag = vi.hoisted(() => ({ on: true }));

vi.mock('../../services/estimatorService', async () => {
  const actual = await vi.importActual<any>('../../services/estimatorService');
  return { ...actual, estimatorService: svc };
});
vi.mock('../../hooks/useCrmFeatureFlag', () => ({ useCrmFeatureFlag: () => flag.on }));
vi.mock('@so360/design-system', () => ({
  Card: ({ children, ...p }: any) => <section data-testid={p['data-testid']}>{children}</section>,
  Alert: ({ children, ...p }: any) => <div role="alert" data-testid={p['data-testid']}>{children}</div>,
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  NumberInput: ({ onChange, value, ...p }: any) => (
    <input data-testid={p['data-testid']} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
  ),
  Select: ({ options, value, onChange, ...p }: any) => (
    <select data-testid={p['data-testid']} value={value} onChange={onChange}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import { ProposalEstimatorPanel } from './ProposalEstimatorPanel';

const money = (n: number) => `$${n.toFixed(2)}`;
const settings = {
  industry_key: 'energy',
  finance_products: [{ id: 'loan', name: '10-year loan', is_active: true }, { id: 'old', name: 'Old', is_active: false }],
  incentive_rules: [],
  production: { enabled: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  flag.on = true;
  svc.getSettings.mockResolvedValue(settings);
  svc.compute.mockResolvedValue({
    incentives: [{ id: 'itc', name: 'Federal tax credit', amount: 300 }],
    incentives_total: 300, net_price: 700,
    financing: [{ product_id: 'loan', name: '10-year loan', down_payment: 0, principal: 700, monthly_payment: 8.1, total_paid: 972, total_interest: 272 }],
    production: { year1_kwh: 7000, lifetime_kwh: 1, year1_savings: 1, lifetime_savings: 5000, payback_years: 4.2, offset_pct: 70 },
  });
});

describe('Given the estimator flag is off', () => {
  it('When the panel renders Then nothing is shown and no API is called', () => {
    flag.on = false;
    const { container } = render(<ProposalEstimatorPanel price={1000} formatCurrency={money} />);
    expect(container.firstChild).toBeNull();
    expect(svc.getSettings).not.toHaveBeenCalled();
  });
});

describe('Given the flag is on', () => {
  it('When Calculate is pressed Then compute is called with the quote total and results use the org formatter', async () => {
    render(<ProposalEstimatorPanel price={1000} formatCurrency={money} />);
    await waitFor(() => expect(screen.getByTestId('estimator-size')).toBeTruthy());
    fireEvent.change(screen.getByTestId('estimator-size'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('estimator-run'));
    await waitFor(() => expect(screen.getByTestId('estimator-net').textContent).toContain('$700.00'));
    expect(svc.compute).toHaveBeenCalledWith({ price: 1000, system_size_kw: 7 });
    expect(screen.getByTestId('estimator-fin-loan').textContent).toContain('$8.10/mo');
    expect(screen.getByTestId('estimator-payback').textContent).toContain('4.2 yrs');
  });

  it('When settings disable production Then size inputs are hidden and inactive products are not offered', async () => {
    svc.getSettings.mockResolvedValue({ ...settings, production: { enabled: false } });
    render(<ProposalEstimatorPanel price={1000} formatCurrency={money} />);
    await waitFor(() => expect(screen.getByTestId('estimator-product')).toBeTruthy());
    expect(screen.queryByTestId('estimator-size')).toBeNull();
    expect(screen.queryByText('Old')).toBeNull();
  });

  it('When compute fails Then the error is shown and no result', async () => {
    svc.compute.mockRejectedValue(new Error('needs system_size_kw'));
    render(<ProposalEstimatorPanel price={1000} formatCurrency={money} />);
    await waitFor(() => expect(screen.getByTestId('estimator-run')).toBeTruthy());
    fireEvent.click(screen.getByTestId('estimator-run'));
    await waitFor(() => expect(screen.getByTestId('estimator-error').textContent).toContain('system_size_kw'));
    expect(screen.queryByTestId('estimator-result')).toBeNull();
  });
});
