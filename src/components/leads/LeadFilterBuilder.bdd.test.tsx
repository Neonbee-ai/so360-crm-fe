import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import LeadFilterBuilder from './LeadFilterBuilder';
import type { FilterGroup } from './leadFilterModel';

const setup = (value?: FilterGroup | null) => {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<LeadFilterBuilder value={value} onApply={onApply} onClose={onClose} />);
  return { onApply, onClose };
};

describe('LeadFilterBuilder', () => {
  it('starts empty with a prompt and no active count', () => {
    setup();
    expect(screen.getByText(/no conditions yet/i)).toBeTruthy();
    expect(screen.queryByTestId('filter-rule')).toBeNull();
  });

  it('adds a condition when "Add condition" is clicked', () => {
    setup();
    fireEvent.click(screen.getByText(/add condition/i));
    expect(screen.getByTestId('filter-rule')).toBeTruthy();
  });

  it('applies null when no complete rule exists', () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByText(/^apply/i));
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('serializes a completed rule on Apply', () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByText(/add condition/i));
    const rule = screen.getByTestId('filter-rule');
    fireEvent.change(within(rule).getByLabelText('Value'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByText(/^apply/i));
    expect(onApply).toHaveBeenCalledWith({
      combinator: 'and',
      rules: [{ field: 'company_name', op: 'contains', value: 'Acme' }],
    });
  });

  it('hides the value input for value-less operators', () => {
    setup();
    fireEvent.click(screen.getByText(/add condition/i));
    const rule = screen.getByTestId('filter-rule');
    fireEvent.change(within(rule).getByLabelText('Operator'), { target: { value: 'is_null' } });
    expect(within(rule).queryByLabelText('Value')).toBeNull();
  });

  it('shows two inputs for a between operator on a numeric field', () => {
    setup();
    fireEvent.click(screen.getByText(/add condition/i));
    const rule = screen.getByTestId('filter-rule');
    fireEvent.change(within(rule).getByLabelText('Field'), { target: { value: 'score' } });
    fireEvent.change(within(rule).getByLabelText('Operator'), { target: { value: 'between' } });
    expect(within(rule).getByLabelText('From')).toBeTruthy();
    expect(within(rule).getByLabelText('To')).toBeTruthy();
  });

  it('removes a rule via its trash button', () => {
    setup();
    fireEvent.click(screen.getByText(/add condition/i));
    expect(screen.getByTestId('filter-rule')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove rule'));
    expect(screen.queryByTestId('filter-rule')).toBeNull();
  });

  it('adds and removes a nested group', () => {
    setup();
    fireEvent.click(screen.getByText(/add group/i));
    expect(screen.getByTestId('filter-group')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove group'));
    expect(screen.queryByTestId('filter-group')).toBeNull();
  });

  it('flips the root combinator to OR', () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByText(/add condition/i));
    fireEvent.click(screen.getByText('OR'));
    const rule = screen.getByTestId('filter-rule');
    fireEvent.change(within(rule).getByLabelText('Value'), { target: { value: 'x' } });
    fireEvent.click(screen.getByText(/^apply/i));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ combinator: 'or' }),
    );
  });

  it('hydrates from an incoming value tree', () => {
    setup({ combinator: 'and', rules: [{ field: 'email', op: 'contains', value: 'a' }] });
    expect(screen.getByTestId('filter-rule')).toBeTruthy();
    expect((screen.getByLabelText('Value') as HTMLInputElement).value).toBe('a');
  });

  it('Clear all empties the tree', () => {
    setup({ combinator: 'and', rules: [{ field: 'email', op: 'contains', value: 'a' }] });
    fireEvent.click(screen.getByText(/clear all/i));
    expect(screen.queryByTestId('filter-rule')).toBeNull();
  });

  it('Close and Cancel both call onClose', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
