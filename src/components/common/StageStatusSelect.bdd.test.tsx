import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StageStatusSelect } from './StageStatusSelect';

describe('StageStatusSelect', () => {
  it('Given value OPEN / When rendered / Then the select shows Open', () => {
    render(<StageStatusSelect value="OPEN" onChange={vi.fn()} />);
    expect(screen.getByTestId('stage-status-select')).toHaveValue('OPEN');
  });

  it('Given the select / When rendered / Then offers Open, Won and Lost in sentence case', () => {
    render(<StageStatusSelect value="OPEN" onChange={vi.fn()} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Open', 'Won', 'Lost']);
  });

  it('Given value OPEN / When Lost is chosen / Then onChange fires with LOST', () => {
    const onChange = vi.fn();
    render(<StageStatusSelect value="OPEN" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('stage-status-select'), { target: { value: 'LOST' } });
    expect(onChange).toHaveBeenCalledWith('LOST');
  });
});
