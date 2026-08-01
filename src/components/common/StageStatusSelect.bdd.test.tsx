import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StageStatusSelect } from './StageStatusSelect';

describe('StageStatusSelect', () => {
  describe('Given a collapsed dropdown', () => {
    it('When rendered with value OPEN / Then shows the OPEN label', () => {
      render(<StageStatusSelect value="OPEN" onChange={vi.fn()} />);
      expect(screen.getByTestId('stage-status-trigger')).toHaveTextContent('OPEN');
    });
  });

  describe('Given the dropdown is opened', () => {
    it('When opened / Then shows all three status options with a neutral text style and no per-option color classes', () => {
      render(<StageStatusSelect value="OPEN" onChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('stage-status-trigger'));
      expect(screen.getByTestId('stage-status-option-OPEN')).toBeInTheDocument();
      expect(screen.getByTestId('stage-status-option-WON')).toBeInTheDocument();
      expect(screen.getByTestId('stage-status-option-LOST')).toBeInTheDocument();
    });

    it('When opened with value WON / Then only the WON option carries the shared blue selection highlight', () => {
      render(<StageStatusSelect value="WON" onChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('stage-status-trigger'));
      expect(screen.getByTestId('stage-status-option-WON').className).toContain('bg-blue-600');
      expect(screen.getByTestId('stage-status-option-OPEN').className).not.toContain('bg-blue-600');
      expect(screen.getByTestId('stage-status-option-LOST').className).not.toContain('bg-blue-600');
    });
  });

  describe('Given the user selects an option', () => {
    it('When an option is clicked / Then onChange fires with that value and the menu closes', () => {
      const onChange = vi.fn();
      render(<StageStatusSelect value="OPEN" onChange={onChange} />);
      fireEvent.click(screen.getByTestId('stage-status-trigger'));
      fireEvent.click(screen.getByTestId('stage-status-option-LOST'));
      expect(onChange).toHaveBeenCalledWith('LOST');
      expect(screen.queryByTestId('stage-status-list')).not.toBeInTheDocument();
    });
  });

  describe('Given the dropdown is open', () => {
    it('When Escape is pressed / Then the menu closes', () => {
      render(<StageStatusSelect value="OPEN" onChange={vi.fn()} />);
      fireEvent.click(screen.getByTestId('stage-status-trigger'));
      expect(screen.getByTestId('stage-status-list')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('stage-status-list')).not.toBeInTheDocument();
    });

    it('When clicking outside / Then the menu closes', () => {
      render(
        <div>
          <StageStatusSelect value="OPEN" onChange={vi.fn()} />
          <button data-testid="outside">Outside</button>
        </div>,
      );
      fireEvent.click(screen.getByTestId('stage-status-trigger'));
      expect(screen.getByTestId('stage-status-list')).toBeInTheDocument();
      fireEvent.mouseDown(screen.getByTestId('outside'));
      expect(screen.queryByTestId('stage-status-list')).not.toBeInTheDocument();
    });
  });
});
